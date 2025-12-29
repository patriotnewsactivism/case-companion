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
        'transcribe-media'
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
    const requestBody = await req.json();
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
        'transcribe-media'
      );
    }

    // Check if user owns the case
    if ((document.cases as any).user_id !== user.id) {
      console.error('User does not own this document');
      return forbiddenResponse(
        'You do not have access to this document',
        corsHeaders
      );
    }

    console.log(`User verified as owner of document ${documentId}`);

    // Check if document is audio or video
    if (!document.media_type || !['audio', 'video'].includes(document.media_type)) {
      return new Response(
        JSON.stringify({ error: 'Document is not audio or video' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Transcribing ${document.media_type} file: ${document.name}`);

    // Download file from storage
    const fileUrl = document.file_url;
    if (!fileUrl) {
      throw new Error('File URL not found');
    }

    // Extract storage path from URL
    const urlParts = fileUrl.split('/storage/v1/object/public/case-documents/');
    const storagePath = urlParts[1];

    // Download file
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('case-documents')
      .download(storagePath);

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log(`Downloaded file, size: ${fileBlob.size} bytes`);

    // Convert blob to File object for OpenAI API
    const file = new File([fileBlob], document.name, { type: document.file_type || 'audio/mpeg' });

    // Validate file size (Whisper API has a 25MB limit)
    try {
      validateFileSize(file.size, 25); // 25MB max for Whisper API
    } catch (sizeError) {
      return createErrorResponse(sizeError, 400, 'transcribe-media');
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
    return createErrorResponse(error, 500, 'transcribe-media');
  }
});
