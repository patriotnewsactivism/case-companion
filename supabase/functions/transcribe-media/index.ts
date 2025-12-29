import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscribeRequest {
  documentId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role for full access
    );

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { documentId }: TranscribeRequest = await req.json();

    // Get document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Check file size (Whisper API has a 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      // For large files, we would need to implement chunking or compression
      // For now, return an error
      return new Response(
        JSON.stringify({
          error: `File too large for transcription. Maximum size: 25MB, file size: ${Math.round(file.size / 1024 / 1024)}MB`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transcribe using OpenAI Whisper API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
