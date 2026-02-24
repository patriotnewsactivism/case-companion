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
  if (!fileUrl || typeof fileUrl !== 'string') {
    return null;
  }

  if (!fileUrl.startsWith('http')) {
    return fileUrl.replace(/^\/+/, '');
  }

  const lower = fileUrl.toLowerCase();
  if (!lower.includes('/storage/v1/object/')) {
    return null;
  }

  const marker = `/${STORAGE_BUCKET}/`;
  const markerIndex = lower.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

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
  if (lower.match(/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/)) return 'audio';
  if (lower.match(/\.(mp4|mpeg|mpg|mov|avi|webm|mkv|3gp|flv)$/)) return 'video';
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
  audio_duration?: number;
  utterances?: unknown[];
  auto_highlights_result?: { results?: unknown[] };
  entities?: unknown[];
  confidence?: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'transcribe-media',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    // Rate limiting: 5 transcriptions per minute per user (transcription is resource-intensive)
    const rateLimitCheck = checkRateLimit(`transcribe:${user.id}`, 5, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse and validate request body
    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<TranscribeRequest>(requestBody, ['documentId']);

    const documentId = validateUUID(requestBody.documentId, 'documentId');

    // Get document record and verify ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*, cases!inner(user_id)')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return createErrorResponse(
        new Error('Document not found'),
        404,
        'transcribe-media',
        corsHeaders
      );
    }

    // Check if user owns the case
    const ownerId = (document as { cases?: { user_id?: string } }).cases?.user_id;
    if (ownerId !== user.id) {
      console.error('User does not own this document');
      return forbiddenResponse(
        'You do not have access to this document',
        corsHeaders
      );
    }

    console.log(`User verified as owner of document ${documentId}`);

    const mediaType = document.media_type || inferMediaType(document.file_type, document.file_url);

    // Check if document is audio or video
    if (!mediaType || !['audio', 'video'].includes(mediaType)) {
      return new Response(
        JSON.stringify({ error: 'Document is not audio or video' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Transcribing ${mediaType} file: ${document.name} using AssemblyAI Universal-3 Pro`);

    // Download file from storage
    const fileUrl = document.file_url;
    if (!fileUrl) {
      throw new Error('File URL not found');
    }

    const storagePath = extractStoragePath(fileUrl);

    let fileBlob: Blob | null = null;
    if (storagePath) {
      const { data, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(storagePath);

      if (!downloadError && data) {
        fileBlob = data;
      }
    }

    if (!fileBlob) {
      if (!fileUrl.startsWith('http')) {
        throw new Error('File URL is not a valid URL');
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      fileBlob = await response.blob();
    }

    console.log(`Downloaded file, size: ${(fileBlob.size / 1024 / 1024).toFixed(2)} MB`);

    const assemblyAiApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyAiApiKey) {
      return createErrorResponse(
        new Error('ASSEMBLYAI_API_KEY is not configured'),
        500,
        'transcribe-media',
        corsHeaders
      );
    }

    // Step 1: Upload file to AssemblyAI
    console.log('Uploading file to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyAiApiKey,
      },
      body: fileBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('AssemblyAI upload error:', errorText);
      throw new Error(`Failed to upload file to AssemblyAI: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;

    console.log('File uploaded successfully, starting transcription...');

    // Step 2: Submit transcription request with Universal-3 Pro model
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyAiApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speech_model: 'best', // Uses Universal-3 Pro (best quality)
        language_detection: true, // Auto-detect language
        punctuate: true,
        format_text: true,
        speaker_labels: true, // Enable speaker diarization
        auto_highlights: true, // Extract key phrases
        entity_detection: true, // Detect names, dates, etc.
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('AssemblyAI transcription submission error:', errorText);
      throw new Error(`Failed to submit transcription: ${errorText}`);
    }

    const transcriptData = (await transcriptResponse.json()) as AssemblyAiTranscript;
    const transcriptId = transcriptData.id;

    console.log(`Transcription submitted with ID: ${transcriptId}, polling for results...`);

    // Step 3: Poll for transcription completion (max 10 minutes)
    let attempts = 0;
    const maxAttempts = 120; // 120 attempts * 5 seconds = 10 minutes
    let transcript: AssemblyAiTranscript | null = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'authorization': assemblyAiApiKey,
        },
      });

      if (!pollingResponse.ok) {
        throw new Error(`Failed to poll transcription status: ${pollingResponse.status}`);
      }

      transcript = (await pollingResponse.json()) as AssemblyAiTranscript;

      if (transcript.status === 'completed') {
        console.log(`Transcription completed in ${attempts * 5} seconds`);
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }

      // Status is still "queued" or "processing", continue polling
      if (attempts % 12 === 0) {
        console.log(`Still processing... (${attempts * 5}s elapsed, status: ${transcript.status})`);
      }
    }

    if (!transcript || transcript.status !== 'completed') {
      throw new Error('Transcription timed out after 10 minutes');
    }

    const transcriptionText = transcript.text;
    const duration = transcript.audio_duration; // Duration in seconds

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      throw new Error('AssemblyAI returned empty transcription');
    }

    console.log(`Transcription completed. Duration: ${duration}s, Text length: ${transcriptionText.length} characters`);

    // Extract additional insights from AssemblyAI
    const speakers = transcript.utterances || [];
    const highlights = transcript.auto_highlights_result?.results || [];
    const entities = transcript.entities || [];

    console.log(`Extracted ${speakers.length} speaker segments, ${highlights.length} highlights, ${entities.length} entities`);

    // Update document with transcription and metadata
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        transcription_text: transcriptionText,
        transcription_processed_at: new Date().toISOString(),
        duration_seconds: Math.round(duration),
        // Store additional metadata if columns exist
        // speaker_count: speakers.length,
        // key_phrases: highlights.map((h: { text?: string }) => h.text).slice(0, 10),
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
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
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in transcribe-media function:', error);
    return createErrorResponse(error, 500, 'transcribe-media', corsHeaders);
  }
});
