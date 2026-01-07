import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, validateFileSize } from '../_shared/validation.ts';

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY']);

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

    console.log(`Transcribing ${mediaType} file: ${document.name}`);

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

    console.log(`Downloaded file, size: ${fileBlob.size} bytes`);

    // Convert blob to File object for OpenAI API
    const fileName = document.name || 'media';
    const file = new File([fileBlob], fileName, { type: document.file_type || fileBlob.type || 'audio/mpeg' });

    // Validate file size (Whisper API has a 25MB limit)
    try {
      validateFileSize(file.size, 25); // 25MB max for Whisper API
    } catch (sizeError) {
      return createErrorResponse(sizeError, 400, 'transcribe-media', corsHeaders);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json'); // Get timestamps and metadata

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcriptionText = transcriptionData.text;
    const duration = transcriptionData.duration;

    console.log(`Transcription completed. Duration: ${duration}s, Text length: ${transcriptionText.length}`);

    // Update document with transcription
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        transcription_text: transcriptionText,
        transcription_processed_at: new Date().toISOString(),
        duration_seconds: Math.round(duration),
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    // Optionally: Generate AI summary of transcription
    // This could use the same AI analysis as documents
    // For now, we'll skip this to keep the function simple

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        transcriptionLength: transcriptionText.length,
        duration: Math.round(duration),
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
