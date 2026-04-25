import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';

const STORAGE_BUCKET = 'case-documents';

function extractStoragePath(fileUrl: string): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  if (!fileUrl.startsWith('http')) return fileUrl.replace(/^\/+/, '');
  const lower = fileUrl.toLowerCase();
  if (!lower.includes('/storage/v1/object/')) return null;
  const marker = `/${STORAGE_BUCKET}/`;
  const markerIndex = lower.indexOf(marker);
  if (markerIndex === -1) return null;
  const pathWithQuery = fileUrl.slice(markerIndex + marker.length);
  return pathWithQuery.split('?')[0];
}

function inferMediaType(
  fileType: string | null,
  fileUrl: string | null
): 'audio' | 'video' | null {
  if (fileType?.startsWith('audio/')) return 'audio';
  if (fileType?.startsWith('video/')) return 'video';
  if (!fileUrl) return null;
  const lower = fileUrl.toLowerCase();
  if (lower.match(/\.(mp3|wav|m4a|aac|ogg|flac|wma)$/)) return 'audio';
  if (lower.match(/\.(mp4|mpeg|mpg|mov|avi|webm|mkv|3gp|flv|wmv)$/)) return 'video';
  return null;
}

interface TranscribeRequest {
  documentId: string;
}

type AssemblyAiTranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

interface AssemblyAiTranscript {
  id: string;
  status: AssemblyAiTranscriptStatus;
  text?: string;
  error?: string;
  speech_model_used?: string;
  audio_duration?: number;
  utterances?: unknown[];
  auto_highlights_result?: { results?: unknown[] };
  entities?: unknown[];
  confidence?: number;
}

/**
 * Extract audio from video using ffmpeg to reduce upload size.
 * Converts to mono 16kHz WAV for optimal transcription quality.
 * Falls back to original file if ffmpeg is unavailable.
 */
async function extractAudioFromVideo(videoBlob: Blob, fileName: string): Promise<{ blob: Blob; wasConverted: boolean }> {
  try {
    // Write video to temp file
    const tempDir = '/tmp';
    const inputPath = `${tempDir}/input_${Date.now()}_${fileName}`;
    const outputPath = `${tempDir}/audio_${Date.now()}.wav`;

    const videoBuffer = await videoBlob.arrayBuffer();
    await Deno.writeFile(inputPath, new Uint8Array(videoBuffer));

    console.log(`Extracting audio from video (${(videoBlob.size / 1024 / 1024).toFixed(2)}MB) using ffmpeg...`);

    // Use ffmpeg to extract audio: mono, 16kHz, WAV format for best transcription
    const process = new Deno.Command('ffmpeg', {
      args: [
        '-i', inputPath,
        '-vn',                    // No video
        '-acodec', 'pcm_s16le',   // 16-bit PCM
        '-ar', '16000',           // 16kHz sample rate
        '-ac', '1',               // Mono
        '-y',                     // Overwrite output
        outputPath,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stderr } = await process.output();

    // Clean up input file
    try { await Deno.remove(inputPath); } catch { /* ignore */ }

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      console.warn(`ffmpeg extraction failed (code ${code}): ${errorText.slice(-200)}`);
      // Try simpler extraction as fallback
      return await extractAudioSimple(videoBlob, fileName);
    }

    // Read the extracted audio
    const audioData = await Deno.readFile(outputPath);
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });

    // Clean up output file
    try { await Deno.remove(outputPath); } catch { /* ignore */ }

    const reduction = ((1 - audioBlob.size / videoBlob.size) * 100).toFixed(1);
    console.log(`Audio extracted: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB (${reduction}% size reduction)`);

    return { blob: audioBlob, wasConverted: true };
  } catch (error) {
    console.warn('ffmpeg not available, falling back to direct upload:', error instanceof Error ? error.message : error);
    return { blob: videoBlob, wasConverted: false };
  }
}

/**
 * Simpler audio extraction fallback - just strip video, keep original audio codec
 */
async function extractAudioSimple(videoBlob: Blob, fileName: string): Promise<{ blob: Blob; wasConverted: boolean }> {
  try {
    const tempDir = '/tmp';
    const inputPath = `${tempDir}/input2_${Date.now()}_${fileName}`;
    const outputPath = `${tempDir}/audio2_${Date.now()}.mp3`;

    const videoBuffer = await videoBlob.arrayBuffer();
    await Deno.writeFile(inputPath, new Uint8Array(videoBuffer));

    const process = new Deno.Command('ffmpeg', {
      args: ['-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', '-y', outputPath],
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code } = await process.output();
    try { await Deno.remove(inputPath); } catch { /* ignore */ }

    if (code !== 0) {
      console.warn('Simple ffmpeg extraction also failed');
      return { blob: videoBlob, wasConverted: false };
    }

    const audioData = await Deno.readFile(outputPath);
    const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
    try { await Deno.remove(outputPath); } catch { /* ignore */ }

    console.log(`Simple audio extraction: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
    return { blob: audioBlob, wasConverted: true };
  } catch {
    return { blob: videoBlob, wasConverted: false };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'transcribe-media', corsHeaders);
    }

    const { user, supabase } = authResult;

    // Higher rate limit: 15 per minute (was 5)
    const rateLimitCheck = checkRateLimit(`transcribe:${user.id}`, 15, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<TranscribeRequest>(requestBody, ['documentId']);
    const documentId = validateUUID(requestBody.documentId, 'documentId');

    // Get document and verify ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*, cases!inner(user_id)')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return createErrorResponse(new Error('Document not found'), 404, 'transcribe-media', corsHeaders);
    }

    const ownerId = (document as { cases?: { user_id?: string } }).cases?.user_id;
    if (ownerId !== user.id) {
      return forbiddenResponse('You do not have access to this document', corsHeaders);
    }

    const mediaType = document.media_type || inferMediaType(document.file_type, document.file_url);

    if (!mediaType || !['audio', 'video'].includes(mediaType)) {
      return new Response(
        JSON.stringify({ error: 'Document is not audio or video' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing ${mediaType} file: ${document.name}`);

    const fileUrl = document.file_url;
    if (!fileUrl) throw new Error('File URL not found');

    const storagePath = extractStoragePath(fileUrl);
    let fileBlob: Blob | null = null;

    if (storagePath) {
      const { data, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
      if (!downloadError && data) fileBlob = data;
    }

    if (!fileBlob) {
      if (!fileUrl.startsWith('http')) throw new Error('File URL is not a valid URL');
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
      fileBlob = await response.blob();
    }

    console.log(`Downloaded file, size: ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB`);

    // For video files: extract audio using ffmpeg to reduce upload size dramatically
    let uploadBlob = fileBlob;
    let audioExtracted = false;

    if (mediaType === 'video') {
      const { blob: audioBlob, wasConverted } = await extractAudioFromVideo(fileBlob, document.name || 'video');
      uploadBlob = audioBlob;
      audioExtracted = wasConverted;
    }

    const assemblyAiApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyAiApiKey) {
      return createErrorResponse(new Error('ASSEMBLYAI_API_KEY is not configured'), 500, 'transcribe-media', corsHeaders);
    }

    // Upload to AssemblyAI
    console.log(`Uploading ${audioExtracted ? 'extracted audio' : 'file'} to AssemblyAI (${(uploadBlob.size / 1024 / 1024).toFixed(2)}MB)...`);
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { 'authorization': assemblyAiApiKey },
      body: uploadBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`AssemblyAI upload failed: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;

    console.log('File uploaded, starting transcription with Universal-3 Pro...');

    // Submit transcription with best settings
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyAiApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speech_models: ['universal-3-pro', 'universal-2'],
        language_detection: true,
        punctuate: true,
        format_text: true,
        speaker_labels: true,
        auto_highlights: true,
        entity_detection: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(`AssemblyAI transcription submission failed: ${errorText}`);
    }

    const transcriptData = (await transcriptResponse.json()) as AssemblyAiTranscript;
    const transcriptId = transcriptData.id;

    console.log(`Transcription ID: ${transcriptId}, polling...`);

    // Poll for completion (max 15 minutes for large files)
    let transcript: AssemblyAiTranscript | null = null;
    const maxAttempts = 180; // 15 minutes

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': assemblyAiApiKey },
      });

      if (!pollingResponse.ok) throw new Error(`Poll failed: ${pollingResponse.status}`);

      transcript = (await pollingResponse.json()) as AssemblyAiTranscript;

      if (transcript.status === 'completed') {
        console.log(`Transcription completed in ${(attempts + 1) * 5}s`);
        break;
      }
      if (transcript.status === 'error') throw new Error(`Transcription failed: ${transcript.error}`);

      if ((attempts + 1) % 12 === 0) {
        console.log(`Still processing... (${(attempts + 1) * 5}s, status: ${transcript.status})`);
      }
    }

    if (!transcript || transcript.status !== 'completed') {
      throw new Error('Transcription timed out after 15 minutes');
    }

    const transcriptionText = transcript.text;
    const duration = transcript.audio_duration || 0;

    if (!transcriptionText?.trim()) {
      throw new Error('AssemblyAI returned empty transcription');
    }

    console.log(`Done. Duration: ${duration}s, Text: ${transcriptionText.length} chars, Model: ${transcript.speech_model_used}`);

    const speakers = transcript.utterances || [];
    const highlights = transcript.auto_highlights_result?.results || [];
    const entities = transcript.entities || [];

    // Update document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        transcription_text: transcriptionText,
        transcription_processed_at: new Date().toISOString(),
        duration_seconds: Math.round(duration),
      })
      .eq('id', documentId);

    if (updateError) {
      console.warn('Primary update failed, trying legacy...', updateError);
      const { error: legacyError } = await supabase
        .from('documents')
        .update({ transcription: transcriptionText, updated_at: new Date().toISOString() })
        .eq('id', documentId);
      if (legacyError) throw legacyError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        transcriptionLength: transcriptionText.length,
        duration: Math.round(duration),
        speakers: speakers.length,
        highlights: highlights.length,
        entities: entities.length,
        confidence: transcript.confidence,
        speechModelUsed: transcript.speech_model_used,
        audioExtracted,
        originalSize: fileBlob.size,
        uploadSize: uploadBlob.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in transcribe-media:', error);
    return createErrorResponse(error, 500, 'transcribe-media', corsHeaders);
  }
});
