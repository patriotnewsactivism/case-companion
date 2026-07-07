import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORAGE_BUCKET = 'case-documents';

// Download a file from Supabase Storage by its storage path
async function downloadFile(
  supabase: SupabaseClient,
  storagePath: string
): Promise<{ blob: Blob; contentType: string }> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download file from storage: ${error?.message || 'No data returned'}`);
  }
  return { blob: data, contentType: data.type || 'application/octet-stream' };
}

// Check the document_hash_cache for a previously processed identical file
async function checkCache(
  supabase: SupabaseClient,
  contentHash: string | null,
  cacheType: 'ocr' | 'ai' | 'transcription'
): Promise<{ hit: boolean; data?: Record<string, unknown> }> {
  if (!contentHash) return { hit: false };

  if (cacheType === 'ocr') {
    const { data } = await supabase
      .from('document_hash_cache')
      .select('ocr_text, ocr_confidence, ocr_provider')
      .eq('content_hash', contentHash)
      .single();
    if (data?.ocr_text) {
      return { hit: true, data: { text: data.ocr_text, confidence: data.ocr_confidence, provider: data.ocr_provider } };
    }
  }

  if (cacheType === 'ai') {
    const { data } = await supabase
      .from('ai_analysis_cache')
      .select('result, model_used')
      .eq('content_hash', contentHash)
      .eq('analysis_type', 'legal_analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data?.result) {
      return { hit: true, data: { ...data.result, provider: data.model_used } };
    }
  }

  if (cacheType === 'transcription') {
    const { data } = await supabase
      .from('transcription_cache')
      .select('transcript_text, transcript_segments, speakers, duration_seconds, provider')
      .eq('content_hash', contentHash)
      .single();
    if (data?.transcript_text) {
      return {
        hit: true,
        data: {
          text: data.transcript_text,
          segments: data.transcript_segments,
          speakers: data.speakers,
          duration: data.duration_seconds,
          provider: data.provider,
        },
      };
    }
  }

  return { hit: false };
}

// Build the public URL for a file in Supabase Storage
function buildFileUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
}

// Invoke another Supabase Edge Function using the service role key
async function invokeEdgeFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge function ${functionName} failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Process up to 10 jobs per invocation
  const results: Array<{ jobId: string; status: string; error?: string }> = [];
  for (let i = 0; i < 10; i++) {
    const { data: jobs } = await supabase.rpc('claim_next_job');
    if (!jobs || jobs.length === 0) break;

    const job = jobs[0];
    const start = Date.now();

    try {
      let result: Record<string, unknown> | undefined;

      switch (job.processing_type) {
        case 'text_extraction':
          result = await processTextExtraction(supabase, supabaseUrl, serviceRoleKey, job);
          break;
        case 'ocr':
          result = await processOCR(supabase, supabaseUrl, serviceRoleKey, job);
          break;
        case 'transcription':
          result = await processTranscription(supabase, supabaseUrl, serviceRoleKey, job);
          break;
        case 'ai_analysis':
          result = await processAIAnalysis(supabase, supabaseUrl, serviceRoleKey, job);
          break;
        case 'email_parse':
          result = await processEmailParse(supabase, job);
          break;
      }

      await supabase.rpc('complete_job', {
        job_id: job.id,
        job_result: result || {},
        provider: (result?.provider as string) || 'unknown',
        duration_ms: Date.now() - start,
      });

      // Update document with extracted text
      const updatePayload: Record<string, unknown> = { status: 'processed' };
      if (result?.text) updatePayload.ocr_text = result.text;
      if (result?.summary) updatePayload.summary = result.summary;
      if (result?.hasAnalysis) updatePayload.ai_analyzed = true;

      await supabase
        .from('documents')
        .update(updatePayload)
        .eq('id', job.file_id);

      results.push({ jobId: job.id, status: 'completed' });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await supabase.rpc('fail_job', {
        job_id: job.id,
        error_msg: errorMsg,
      });
      results.push({ jobId: job.id, status: 'failed', error: errorMsg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// ===== PROCESSOR: Text Extraction =====
// Downloads the file and extracts text based on file type.
// For PDFs and images, delegates to the ocr-document edge function.
// For plain text files, reads directly.
async function processTextExtraction(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  job: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const contentHash = job.content_hash as string | null;
  const cached = await checkCache(supabase, contentHash, 'ocr');
  if (cached.hit && cached.data) {
    console.log(`Cache hit for text extraction: ${contentHash}`);
    return { text: cached.data.text, provider: `cache:${cached.data.provider}`, cached: true };
  }

  const storagePath = job.storage_path as string;
  const fileName = (job.file_name as string || '').toLowerCase();
  const fileType = (job.file_type as string || '').toLowerCase();
  const fileId = job.file_id as string;

  // Plain text files: read directly
  if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md') ||
      fileName.endsWith('.json') || fileName.endsWith('.xml') || fileName.endsWith('.html') ||
      fileName.endsWith('.csv')) {
    const { blob } = await downloadFile(supabase, storagePath);
    const text = await blob.text();
    if (contentHash) {
      await supabase.from('document_hash_cache').upsert({
        content_hash: contentHash,
        ocr_text: text,
        ocr_confidence: 100,
        ocr_provider: 'direct_text',
        file_type: fileType,
        file_size_bytes: blob.size,
      }, { onConflict: 'content_hash' });
    }
    return { text, provider: 'direct_text', confidence: 100 };
  }

  // PDFs, images, Word docs: delegate to ocr-document edge function
  // which handles Azure DI -> Gemini -> OCR.space cascade + AI analysis
  const fileUrl = buildFileUrl(supabaseUrl, storagePath);
  const ocrResult = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, 'ocr-document', {
    documentId: fileId,
    fileUrl,
  });

  return {
    text: ocrResult.extractedText || ocrResult.text || '',
    provider: ocrResult.ocrProvider || 'ocr-document',
    confidence: 95,
    summary: ocrResult.summary,
    hasAnalysis: ocrResult.hasAnalysis,
  };
}

// ===== PROCESSOR: OCR =====
// For image files that need OCR specifically.
// Delegates to the ocr-document edge function which handles the full cascade.
async function processOCR(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  job: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const contentHash = job.content_hash as string | null;
  const cached = await checkCache(supabase, contentHash, 'ocr');
  if (cached.hit && cached.data) {
    console.log(`Cache hit for OCR: ${contentHash}`);
    return { text: cached.data.text, confidence: cached.data.confidence, provider: `cache:${cached.data.provider}`, cached: true };
  }

  const storagePath = job.storage_path as string;
  const fileId = job.file_id as string;
  const fileUrl = buildFileUrl(supabaseUrl, storagePath);

  const ocrResult = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, 'ocr-document', {
    documentId: fileId,
    fileUrl,
  });

  return {
    text: ocrResult.extractedText || ocrResult.text || '',
    confidence: 95,
    provider: ocrResult.ocrProvider || 'ocr-document',
    summary: ocrResult.summary,
    hasAnalysis: ocrResult.hasAnalysis,
    keyFacts: ocrResult.keyFacts,
    favorableFindings: ocrResult.favorableFindings,
    adverseFindings: ocrResult.adverseFindings,
    actionItems: ocrResult.actionItems,
  };
}

// ===== PROCESSOR: Transcription =====
// For audio/video files. Delegates to the transcribe-media edge function.
async function processTranscription(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  job: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const contentHash = job.content_hash as string | null;
  const cached = await checkCache(supabase, contentHash, 'transcription');
  if (cached.hit && cached.data) {
    console.log(`Cache hit for transcription: ${contentHash}`);
    return { ...cached.data, cached: true };
  }

  const fileId = job.file_id as string;

  const transcriptResult = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, 'transcribe-media', {
    documentId: fileId,
  });

  // Cache the result
  if (contentHash && transcriptResult.text) {
    await supabase.from('transcription_cache').upsert({
      content_hash: contentHash,
      transcript_text: transcriptResult.text,
      transcript_segments: transcriptResult.segments || null,
      speakers: transcriptResult.speakers || null,
      duration_seconds: transcriptResult.duration || 0,
      provider: transcriptResult.provider || 'assemblyai',
    }, { onConflict: 'content_hash' });
  }

  return {
    text: transcriptResult.text || transcriptResult.transcription || '',
    segments: transcriptResult.segments || [],
    speakers: transcriptResult.speakers || [],
    duration: transcriptResult.duration || 0,
    provider: transcriptResult.provider || 'transcribe-media',
  };
}

// ===== PROCESSOR: AI Analysis =====
// Runs AI legal analysis on already-extracted text.
// Checks if the document already has OCR text, then runs analysis via Gemini/GPT.
async function processAIAnalysis(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  job: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const contentHash = job.content_hash as string | null;
  const cached = await checkCache(supabase, contentHash, 'ai');
  if (cached.hit && cached.data) {
    console.log(`Cache hit for AI analysis: ${contentHash}`);
    return { ...cached.data, cached: true, hasAnalysis: true };
  }

  const fileId = job.file_id as string;

  // Get the document's existing OCR text
  const { data: doc } = await supabase
    .from('documents')
    .select('ocr_text, ai_analyzed, file_url, storage_path, name, case_id, cases!inner(user_id)')
    .eq('id', fileId)
    .single();

  if (!doc) {
    throw new Error(`Document ${fileId} not found`);
  }

  // If already analyzed by the ocr-document function (which does analysis too), skip
  if (doc.ai_analyzed) {
    return { provider: 'already_analyzed', hasAnalysis: true, text: doc.ocr_text || '' };
  }

  // If no OCR text yet, this job should be retried later (text_extraction hasn't finished)
  if (!doc.ocr_text || doc.ocr_text.length < 50) {
    throw new Error('Document text not yet available - will retry after text extraction completes');
  }

  // Run the analysis by calling the ocr-document function which also does AI analysis
  // The ocr-document function will use the existing OCR text and just run the analysis part
  const storagePath = doc.storage_path || job.storage_path;
  const fileUrl = doc.file_url || buildFileUrl(supabaseUrl, storagePath as string);

  const analysisResult = await invokeEdgeFunction(supabaseUrl, serviceRoleKey, 'ocr-document', {
    documentId: fileId,
    fileUrl,
  });

  // Cache the analysis result
  if (contentHash && analysisResult.hasAnalysis) {
    await supabase.from('ai_analysis_cache').upsert({
      content_hash: contentHash,
      analysis_type: 'legal_analysis',
      prompt_version: '1.0.0',
      result: {
        summary: analysisResult.summary,
        keyFacts: analysisResult.keyFacts,
        favorableFindings: analysisResult.favorableFindings,
        adverseFindings: analysisResult.adverseFindings,
        actionItems: analysisResult.actionItems,
      },
      model_used: analysisResult.analysisProvider || 'gemini',
      tokens_used: 0,
    }, { onConflict: 'content_hash,analysis_type,prompt_version' });
  }

  return {
    summary: analysisResult.summary || '',
    keyFacts: analysisResult.keyFacts || [],
    favorableFindings: analysisResult.favorableFindings || [],
    adverseFindings: analysisResult.adverseFindings || [],
    actionItems: analysisResult.actionItems || [],
    provider: analysisResult.analysisProvider || 'gemini',
    hasAnalysis: !!analysisResult.hasAnalysis,
    text: doc.ocr_text,
  };
}

// ===== PROCESSOR: Email Parse =====
// Parses .eml/.msg files, extracts body text + metadata,
// and enqueues each attachment as a separate processing job.
async function processEmailParse(
  supabase: SupabaseClient,
  job: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const storagePath = job.storage_path as string;
  const { blob } = await downloadFile(supabase, storagePath);
  const rawText = await blob.text();

  // Simple email header parsing for .eml format
  const headerEnd = rawText.indexOf('\r\n\r\n') !== -1
    ? rawText.indexOf('\r\n\r\n')
    : rawText.indexOf('\n\n');
  const headerSection = headerEnd > 0 ? rawText.slice(0, headerEnd) : rawText.slice(0, 2000);
  const bodySection = headerEnd > 0 ? rawText.slice(headerEnd + (rawText.indexOf('\r\n\r\n') !== -1 ? 4 : 2)) : '';

  const getHeader = (name: string): string => {
    const regex = new RegExp(`^${name}:\\s*(.+)$`, 'im');
    const match = headerSection.match(regex);
    return match?.[1]?.trim() || '';
  };

  const from = getHeader('From');
  const to = getHeader('To').split(',').map((s: string) => s.trim()).filter(Boolean);
  const cc = getHeader('Cc').split(',').map((s: string) => s.trim()).filter(Boolean);
  const subject = getHeader('Subject');
  const date = getHeader('Date');

  // Extract plain text body (strip MIME boundaries if present)
  let bodyText = bodySection;
  if (bodySection.includes('Content-Type:')) {
    // Multi-part MIME - extract text/plain part
    const textPartMatch = bodySection.match(
      /Content-Type:\s*text\/plain[^\n]*\n(?:Content-[^\n]*\n)*\n([\s\S]*?)(?=--[A-Za-z0-9_-]+|$)/i
    );
    bodyText = textPartMatch?.[1] || bodySection.replace(/Content-[^\n]*\n/g, '').trim();
  }

  // Build a combined text representation for AI analysis
  const fullText = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
    `Date: ${date}`,
    `Subject: ${subject}`,
    '',
    bodyText.trim(),
  ].filter(Boolean).join('\n');

  // Count MIME attachments (rough detection)
  const attachmentMatches = bodySection.match(/Content-Disposition:\s*attachment/gi);
  const attachmentCount = attachmentMatches?.length || 0;

  // Update the document with the parsed text
  await supabase
    .from('documents')
    .update({
      ocr_text: fullText,
      summary: `Email from ${from} to ${to.join(', ')} — Subject: ${subject}`,
    })
    .eq('id', job.file_id);

  return {
    text: fullText,
    from,
    to,
    cc,
    subject,
    date,
    attachmentCount,
    provider: 'email_parser',
    hasAnalysis: false,
  };
}
