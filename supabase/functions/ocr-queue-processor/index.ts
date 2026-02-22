import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, validateInteger } from '../_shared/validation.ts';

const STORAGE_BUCKET = 'case-documents';
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

type OcrQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';
type QueueAction = 'process' | 'status' | 'enqueue';

interface OcrQueueJob {
  id: string;
  document_id: string;
  case_id: string;
  user_id: string;
  status: OcrQueueStatus;
  priority: number;
  attempts: number;
  retry_after: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface QueueRequest {
  action: QueueAction;
  caseId?: string;
  documentIds?: string[];
  priority?: number;
}

interface QueueJobResult {
  id: string;
  documentId: string;
  status: OcrQueueStatus;
  error?: string;
}

interface QueueResponse {
  processed: number;
  remaining: number;
  failed: number;
  jobs: QueueJobResult[];
}

interface OcrSpaceParsedResult {
  ParsedText?: string;
}

interface OcrSpaceResponse {
  OCRExitCode?: number;
  ParsedResults?: OcrSpaceParsedResult[];
  ErrorMessage?: string | string[];
}

interface AzureOcrRegion {
  lines?: Array<{ words?: Array<{ text?: string }> }>;
}

interface AzureOcrResult {
  regions?: AzureOcrRegion[];
}

interface AzureReadResult {
  analyzeResult?: {
    readResults?: Array<{ lines?: Array<{ text?: string }> }>;
  };
}

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

async function loadFileBlob(
  supabase: SupabaseClient,
  fileUrl: string
): Promise<{ blob: Blob; contentType: string }> {
  const storagePath = extractStoragePath(fileUrl);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (!error && data) {
      return { blob: data, contentType: data.type || '' };
    }
  }

  if (!fileUrl.startsWith('http')) {
    throw new Error('File URL is not a valid URL');
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const blob = await response.blob();
  return { blob, contentType };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

const normalizeExtractedText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

const extractGeminiText = (payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }) => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => String(part?.text || '')).join('').trim();
};

const extractAzureText = (result: AzureOcrResult): string => {
  const lines: string[] = [];
  const regions = result.regions || [];
  for (const region of regions) {
    for (const line of region.lines || []) {
      const lineText = (line.words || []).map((w) => w.text || '').join(' ');
      if (lineText) lines.push(lineText);
    }
  }
  return lines.join('\n');
};

const extractAzureReadResult = (result: AzureReadResult): string => {
  const pages: string[] = [];
  const analyzeResult = result.analyzeResult || {};
  const readResults = analyzeResult.readResults || [];

  for (let i = 0; i < readResults.length; i += 1) {
    const page = readResults[i];
    const pageLines: string[] = [];
    for (const line of page.lines || []) {
      if (line.text) pageLines.push(line.text);
    }
    if (readResults.length > 1) {
      pages.push(`=== PAGE ${i + 1} ===\n${pageLines.join('\n')}`);
    } else {
      pages.push(pageLines.join('\n'));
    }
  }
  return pages.join('\n\n');
};

async function azureOcr(
  azureVisionKey: string,
  azureVisionEndpoint: string,
  fileBlob: Blob,
  isImage: boolean
): Promise<string> {
  const endpoint = azureVisionEndpoint.endsWith('/')
    ? azureVisionEndpoint.slice(0, -1)
    : azureVisionEndpoint;

  let allText = '';

  if (isImage) {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const response = await fetch(`${endpoint}/vision/v3.2/ocr?detectOrientation=true`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureVisionKey,
        'Content-Type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error('Azure rate limit exceeded');
      }
      throw new Error(`Azure OCR failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    allText = extractAzureText(result);
  } else {
    const formData = new FormData();
    formData.append('file', fileBlob, 'document.pdf');

    const response = await fetch(`${endpoint}/vision/v3.2/read/analyze`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureVisionKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error('Azure rate limit exceeded');
      }
      throw new Error(`Azure PDF OCR failed: ${response.status} ${errorText}`);
    }

    const operationLocation = response.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('Azure did not return Operation-Location header');
    }

    let attempts = 0;
    let readResult = null;
    while (attempts < 30) {
      await delay(1000);
      const statusResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': azureVisionKey },
      });
      const statusData = await statusResponse.json();
      if (statusData.status === 'succeeded') {
        readResult = statusData;
        break;
      }
      if (statusData.status === 'failed') {
        throw new Error('Azure PDF OCR analysis failed');
      }
      attempts += 1;
    }

    if (!readResult) {
      throw new Error('Azure PDF OCR timed out');
    }

    allText = extractAzureReadResult(readResult);
  }

  if (!allText || allText.trim().length === 0) {
    throw new Error('Azure returned empty text');
  }

  return allText;
}

async function ocrSpaceExtract(
  ocrSpaceApiKey: string,
  fileBlob: Blob,
  isImage: boolean,
  contentType?: string
): Promise<string> {
  const extension = isImage ? 'jpg' : 'pdf';
  const fileName = `document.${extension}`;
  const file = new File([fileBlob], fileName, {
    type: contentType || (isImage ? 'image/jpeg' : 'application/pdf')
  });

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('apikey', ocrSpaceApiKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  formData.append('filetype', extension.toUpperCase());

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR.space API failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as OcrSpaceResponse;

  if (result.OCRExitCode !== 1 || !result.ParsedResults || result.ParsedResults.length === 0) {
    const errorMessage = Array.isArray(result.ErrorMessage)
      ? result.ErrorMessage.join(', ')
      : (result.ErrorMessage || 'Unknown error');
    throw new Error(`OCR.space parsing failed: ${errorMessage}`);
  }

  const extractedText = result.ParsedResults
    .map((page, idx: number) => {
      const pageText = page.ParsedText || '';
      return result.ParsedResults!.length > 1 ? `=== PAGE ${idx + 1} ===\n${pageText}` : pageText;
    })
    .join('\n\n');

  return extractedText;
}

async function geminiOcr(
  googleApiKey: string,
  fileBlob: Blob,
  mimeType: string,
  isImage: boolean
): Promise<string> {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  const prompt = isImage
    ? `You are a professional legal document OCR system. Extract ALL text from this image with maximum accuracy.

EXTRACTION REQUIREMENTS:
1. Extract EVERY word, number, date, signature, stamp, and annotation visible
2. Preserve document structure: headings, paragraphs, lists, tables
3. For tables: use pipe (|) separators and preserve column alignment
4. Include ALL metadata: dates, case numbers, file stamps, Bates numbers, exhibit numbers
5. Preserve legal citations exactly as written (case names, statute numbers, etc.)
6. Include handwritten notes and marginalia if visible
7. Mark unclear text with [UNCLEAR: your best guess]
8. Note document quality issues: [FADED], [SMUDGED], [REDACTED], [WATERMARK], etc.
9. If text is rotated or upside down, still extract it
10. Extract text from headers, footers, and page numbers

OUTPUT FORMAT:
- Plain text only, no markdown formatting
- Preserve original line breaks and paragraph spacing
- Use "---" to separate distinct sections
- Start with any document identifiers found (Bates #, Exhibit #, file #, date)

Extract now:`
    : `You are a professional legal document OCR system. Extract ALL text from this PDF with maximum accuracy.

EXTRACTION REQUIREMENTS:
1. Process EVERY page of the PDF
2. Extract EVERY word, number, date, signature, stamp, and annotation
3. Preserve document structure: headings, paragraphs, lists, tables
4. For tables: use pipe (|) separators and preserve alignment
5. Include ALL metadata: dates, case numbers, file stamps, Bates numbers, exhibit numbers
6. Preserve legal citations exactly as written
7. Include handwritten notes and marginalia if visible
8. Mark unclear text with [UNCLEAR: best guess]
9. Note document quality issues: [FADED], [SMUDGED], [REDACTED]
10. Extract headers, footers, and page numbers

OUTPUT FORMAT:
- Plain text only, no markdown
- Preserve line breaks and spacing
- Use "=== PAGE X ===" to separate pages
- Use "---" to separate sections within a page
- Start each page with any identifiers (Bates #, page #)

Extract now:`;

  const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
      }
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    if (aiResponse.status === 429) {
      throw new Error('Gemini rate limit exceeded');
    }
    throw new Error(`Gemini OCR failed: ${errorText}`);
  }

  const aiData = await aiResponse.json();
  const text = extractGeminiText(aiData);

  if (!text || text.trim().length === 0) {
    throw new Error('Gemini returned empty text');
  }

  return text;
}

async function analyzeWithAI(
  extractedText: string,
  openaiApiKey: string | undefined,
  aiGatewayUrl: string | undefined,
  googleApiKey: string | undefined
): Promise<{
  summary: string;
  keyFacts: string[];
  favorableFindings: string[];
  adverseFindings: string[];
  actionItems: string[];
  timelineEvents: unknown[];
}> {
  let summary = '';
  let keyFacts: string[] = [];
  let favorableFindings: string[] = [];
  let adverseFindings: string[] = [];
  let actionItems: string[] = [];
  let timelineEvents: unknown[] = [];

  const hasOpenAI = !!openaiApiKey;
  const hasGemini = !!googleApiKey;

  if (extractedText.length <= 50) {
    return { summary, keyFacts, favorableFindings, adverseFindings, actionItems, timelineEvents };
  }

  const analysisPrompt = `You are an expert legal document analyst specializing in litigation support. Analyze documents with precision and identify strategic insights for case preparation.

Analyze this legal document and provide a JSON response with comprehensive legal analysis, including chronological timeline events.

ANALYSIS REQUIREMENTS:
1. SUMMARY: 2-4 sentence executive summary of the document's content and significance
2. KEY_FACTS: 5-10 specific factual findings (dates, events, statements, numbers)
3. FAVORABLE_FINDINGS: 3-5 findings that could support the case (admissions, favorable testimony, helpful evidence)
4. ADVERSE_FINDINGS: 3-5 findings that could hurt the case (contradictions, damaging statements, weaknesses)
5. ACTION_ITEMS: 3-5 specific follow-up actions (witnesses to interview, documents to request, issues to research)
6. TIMELINE_EVENTS: Extract chronological events found in the document. For each event provide:
   - "event_date": YYYY-MM-DD format (if approximate, use first of month/year)
   - "title": Short title (5-10 words)
   - "description": Detailed description (1-2 sentences)
   - "importance": "high", "medium", or "low"
   - "event_type": e.g., "communication", "filing", "incident", "meeting"

Be thorough, precise, and strategic. Focus on facts that matter for litigation.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "key_facts": ["fact1", "fact2", ...],
  "favorable_findings": ["finding1", "finding2", ...],
  "adverse_findings": ["finding1", "finding2", ...],
  "action_items": ["action1", "action2", ...],
  "timeline_events": [
    { "event_date": "2023-01-01", "title": "...", "description": "...", "importance": "high", "event_type": "..." }
  ]
}

Document text:
${extractedText.substring(0, 20000)}`;

  let content = '';

  if (hasOpenAI) {
    try {
      const apiUrl = aiGatewayUrl || 'https://api.openai.com/v1/chat/completions';
      const analysisResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.2,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        content = analysisData.choices?.[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('OpenAI analysis error:', error);
    }
  }

  if (!content && hasGemini) {
    try {
      const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: analysisPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          }
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        content = extractGeminiText(analysisData);
      }
    } catch (error) {
      console.error('Gemini analysis error:', error);
    }
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      summary = analysis.summary || '';
      keyFacts = Array.isArray(analysis.key_facts) ? analysis.key_facts : [];
      favorableFindings = Array.isArray(analysis.favorable_findings) ? analysis.favorable_findings : [];
      adverseFindings = Array.isArray(analysis.adverse_findings) ? analysis.adverse_findings : [];
      actionItems = Array.isArray(analysis.action_items) ? analysis.action_items : [];
      timelineEvents = Array.isArray(analysis.timeline_events) ? analysis.timeline_events : [];
    }
  } catch (parseError) {
    console.error('Failed to parse analysis JSON:', parseError);
    summary = content.substring(0, 500);
  }

  return { summary, keyFacts, favorableFindings, adverseFindings, actionItems, timelineEvents };
}

async function processOcrJob(
  supabase: SupabaseClient,
  job: OcrQueueJob,
  azureVisionKey: string | undefined,
  azureVisionEndpoint: string | undefined,
  ocrSpaceApiKey: string | undefined,
  googleApiKey: string | undefined,
  openaiApiKey: string | undefined,
  aiGatewayUrl: string | undefined
): Promise<{ success: boolean; error?: string }> {
  const hasAzure = !!(azureVisionKey && azureVisionEndpoint);
  const hasOcrSpace = !!ocrSpaceApiKey;
  const hasGemini = !!googleApiKey;

  if (!hasAzure && !hasOcrSpace && !hasGemini) {
    return { success: false, error: 'No OCR service configured' };
  }

  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('id, name, file_url, case_id')
    .eq('id', job.document_id)
    .single();

  if (docError || !document) {
    return { success: false, error: 'Document not found' };
  }

  const doc = document as { id: string; name: string; file_url: string | null; case_id: string };
  if (!doc.file_url) {
    return { success: false, error: 'Document has no file URL' };
  }

  let extractedText = '';

  try {
    const { blob: fileBlob, contentType } = await loadFileBlob(supabase, doc.file_url);
    const resolvedContentType = contentType || fileBlob.type || '';
    const isImage = resolvedContentType.includes('image') || doc.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i);
    const isPdf = resolvedContentType.includes('pdf') || doc.file_url.match(/\.pdf$/i);

    if (isImage || isPdf) {
      const errors: string[] = [];
      const mimeType = resolvedContentType || (isImage ? 'image/jpeg' : 'application/pdf');

      if (hasAzure) {
        try {
          extractedText = await azureOcr(azureVisionKey!, azureVisionEndpoint!, fileBlob, !!isImage);
          console.log(`Azure extracted ${extractedText.length} characters`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Azure: ${msg}`);
          console.error('Azure OCR error:', msg);
        }
      }

      if (!extractedText && hasOcrSpace) {
        try {
          extractedText = await ocrSpaceExtract(ocrSpaceApiKey!, fileBlob, !!isImage, mimeType);
          console.log(`OCR.space extracted ${extractedText.length} characters`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`OCR.space: ${msg}`);
          console.error('OCR.space OCR error:', msg);
        }
      }

      if (!extractedText && hasGemini) {
        try {
          extractedText = await geminiOcr(googleApiKey!, fileBlob, mimeType, !!isImage);
          console.log(`Gemini extracted ${extractedText.length} characters`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Gemini: ${msg}`);
          console.error('Gemini OCR error:', msg);
        }
      }

      if (!extractedText) {
        return { success: false, error: `All OCR providers failed. ${errors.join('; ')}` };
      }
    } else if (resolvedContentType.includes('text') || doc.file_url.match(/\.(txt|doc|docx)$/i)) {
      extractedText = await fileBlob.text();
    } else {
      extractedText = `[File type ${resolvedContentType || 'unknown'} - OCR not available for this format]`;
    }

    extractedText = normalizeExtractedText(extractedText);

    const isOcrTarget = isImage || isPdf;
    if (isOcrTarget && extractedText.length < 30) {
      return { success: false, error: 'OCR extraction returned too little text' };
    }

    const { summary, keyFacts, favorableFindings, adverseFindings, actionItems, timelineEvents } = 
      await analyzeWithAI(extractedText, openaiApiKey, aiGatewayUrl, googleApiKey);

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ocr_text: extractedText,
        ocr_processed_at: new Date().toISOString(),
        ai_analyzed: !!summary,
        summary: summary || null,
        key_facts: keyFacts.length > 0 ? keyFacts : null,
        favorable_findings: favorableFindings.length > 0 ? favorableFindings : null,
        adverse_findings: adverseFindings.length > 0 ? adverseFindings : null,
        action_items: actionItems.length > 0 ? actionItems : null,
      })
      .eq('id', doc.id);

    if (updateError) {
      return { success: false, error: `Failed to update document: ${updateError.message}` };
    }

    if (timelineEvents.length > 0) {
      const eventsToInsert = (timelineEvents as Array<{
        event_date?: string;
        title?: string;
        description?: string;
        importance?: string;
        event_type?: string;
      }>).map((event) => ({
        case_id: doc.case_id,
        user_id: job.user_id,
        linked_document_id: doc.id,
        event_date: event.event_date || new Date().toISOString().split('T')[0],
        title: event.title || 'Untitled Event',
        description: event.description || '',
        importance: event.importance || 'medium',
        event_type: event.event_type || 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      await supabase.from('timeline_events').insert(eventsToInsert);
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

async function handleProcessAction(
  supabase: SupabaseClient,
  azureVisionKey: string | undefined,
  azureVisionEndpoint: string | undefined,
  ocrSpaceApiKey: string | undefined,
  googleApiKey: string | undefined,
  openaiApiKey: string | undefined,
  aiGatewayUrl: string | undefined
): Promise<QueueResponse> {
  const now = new Date().toISOString();

  const { data: pendingJobs, error: fetchError } = await supabase
    .from('ocr_queue')
    .select('*')
    .eq('status', 'pending')
    .or(`retry_after.is.null,retry_after.lte.${now}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(5);

  if (fetchError) {
    console.error('Failed to fetch pending jobs:', fetchError);
    throw new Error(`Failed to fetch pending jobs: ${fetchError.message}`);
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    const { count } = await supabase
      .from('ocr_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return {
      processed: 0,
      remaining: count || 0,
      failed: 0,
      jobs: []
    };
  }

  const jobs: QueueJobResult[] = [];
  let processed = 0;
  let failed = 0;

  for (const jobData of pendingJobs) {
    const job = jobData as OcrQueueJob;

    await supabase
      .from('ocr_queue')
      .update({ status: 'processing', updated_at: now })
      .eq('id', job.id);

    const result = await processOcrJob(
      supabase,
      job,
      azureVisionKey,
      azureVisionEndpoint,
      ocrSpaceApiKey,
      googleApiKey,
      openaiApiKey,
      aiGatewayUrl
    );

    if (result.success) {
      await supabase
        .from('ocr_queue')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      jobs.push({ id: job.id, documentId: job.document_id, status: 'completed' });
      processed += 1;
    } else {
      const newAttempts = job.attempts + 1;
      const isRateLimit = result.error?.includes('rate limit') || result.error?.includes('Rate limit');

      if (newAttempts >= MAX_ATTEMPTS || !isRateLimit) {
        await supabase
          .from('ocr_queue')
          .update({
            status: 'failed',
            attempts: newAttempts,
            error_message: result.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        jobs.push({ id: job.id, documentId: job.document_id, status: 'failed', error: result.error });
        failed += 1;
      } else {
        const backoffIndex = Math.min(job.attempts, BACKOFF_DELAYS.length - 1);
        const retryAfter = new Date(Date.now() + BACKOFF_DELAYS[backoffIndex]).toISOString();

        await supabase
          .from('ocr_queue')
          .update({
            status: 'pending',
            attempts: newAttempts,
            retry_after: retryAfter,
            error_message: result.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        jobs.push({
          id: job.id,
          documentId: job.document_id,
          status: 'pending',
          error: `Rate limited, retry at ${retryAfter}`
        });
      }
    }
  }

  const { count: remaining } = await supabase
    .from('ocr_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return {
    processed,
    remaining: remaining || 0,
    failed,
    jobs
  };
}

async function handleStatusAction(
  supabase: SupabaseClient,
  userId: string,
  caseId?: string
): Promise<QueueResponse> {
  let query = supabase
    .from('ocr_queue')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  const { data: jobs, count, error } = await query;

  if (error) {
    throw new Error(`Failed to get queue status: ${error.message}`);
  }

  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };

  const jobResults: QueueJobResult[] = [];

  for (const jobData of (jobs || []) as OcrQueueJob[]) {
    statusCounts[jobData.status] += 1;
    jobResults.push({
      id: jobData.id,
      documentId: jobData.document_id,
      status: jobData.status,
      error: jobData.error_message || undefined
    });
  }

  return {
    processed: statusCounts.completed,
    remaining: statusCounts.pending + statusCounts.processing,
    failed: statusCounts.failed,
    jobs: jobResults
  };
}

async function handleEnqueueAction(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
  documentIds: string[],
  priority: number
): Promise<QueueResponse> {
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('user_id')
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    throw new Error('Case not found');
  }

  if ((caseData as { user_id: string }).user_id !== userId) {
    throw new Error('You do not have access to this case');
  }

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, file_url')
    .eq('case_id', caseId)
    .in('id', documentIds)
    .is('ocr_processed_at', null);

  if (docError) {
    throw new Error(`Failed to fetch documents: ${docError.message}`);
  }

  const docs = (documents || []) as Array<{ id: string; file_url: string | null }>;
  const validDocs = docs.filter(d => d.file_url);

  if (validDocs.length === 0) {
    return {
      processed: 0,
      remaining: 0,
      failed: 0,
      jobs: []
    };
  }

  const { data: existingJobs } = await supabase
    .from('ocr_queue')
    .select('document_id')
    .in('document_id', validDocs.map(d => d.id))
    .in('status', ['pending', 'processing']);

  const existingDocIds = new Set((existingJobs || []).map((j: { document_id: string }) => j.document_id));
  const newDocs = validDocs.filter(d => !existingDocIds.has(d.id));

  if (newDocs.length === 0) {
    return {
      processed: 0,
      remaining: existingDocIds.size,
      failed: 0,
      jobs: []
    };
  }

  const now = new Date().toISOString();
  const jobsToInsert = newDocs.map(doc => ({
    document_id: doc.id,
    case_id: caseId,
    user_id: userId,
    status: 'pending' as OcrQueueStatus,
    priority,
    attempts: 0,
    created_at: now,
    updated_at: now
  }));

  const { error: insertError } = await supabase
    .from('ocr_queue')
    .insert(jobsToInsert);

  if (insertError) {
    throw new Error(`Failed to enqueue jobs: ${insertError.message}`);
  }

  const jobResults: QueueJobResult[] = newDocs.map(doc => ({
    id: 'new',
    documentId: doc.id,
    status: 'pending' as OcrQueueStatus
  }));

  return {
    processed: 0,
    remaining: newDocs.length,
    failed: 0,
    jobs: jobResults
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const azureVisionKey = Deno.env.get('AZURE_VISION_API_KEY');
    const azureVisionEndpoint = Deno.env.get('AZURE_VISION_ENDPOINT');
    const ocrSpaceApiKey = Deno.env.get('OCR_SPACE_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const aiGatewayUrl = Deno.env.get('AI_GATEWAY_URL');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let supabase: SupabaseClient;
    let userId: string;
    let isServiceRole = false;

    const authHeader = req.headers.get('Authorization') || '';

    if (serviceRoleKey && authHeader.includes(serviceRoleKey)) {
      isServiceRole = true;
      supabase = createClient(supabaseUrl, serviceRoleKey);
      userId = 'service-role';
    } else {
      const authResult = await verifyAuth(req);
      if (!authResult.authorized || !authResult.user || !authResult.supabase) {
        return createErrorResponse(
          new Error(authResult.error || 'Unauthorized'),
          401,
          'ocr-queue-processor',
          corsHeaders
        );
      }
      supabase = authResult.supabase;
      userId = authResult.user.id;
    }

    if (!isServiceRole) {
      const rateLimitCheck = checkRateLimit(`ocr-queue:${userId}`, 20, 60000);
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
    }

    const requestBody = (await req.json()) as QueueRequest;

    if (!requestBody.action) {
      throw new Error('Missing required field: action');
    }

    const action = requestBody.action;

    if (action === 'process') {
      if (!isServiceRole) {
        return forbiddenResponse('Only service role can process queue', corsHeaders);
      }

      const result = await handleProcessAction(
        supabase,
        azureVisionKey,
        azureVisionEndpoint,
        ocrSpaceApiKey,
        googleApiKey,
        openaiApiKey,
        aiGatewayUrl
      );

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      const result = await handleStatusAction(supabase, userId, requestBody.caseId);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'enqueue') {
      if (!requestBody.caseId) {
        throw new Error('Missing required field: caseId');
      }
      if (!requestBody.documentIds || requestBody.documentIds.length === 0) {
        throw new Error('Missing required field: documentIds');
      }

      const validatedCaseId = validateUUID(requestBody.caseId, 'caseId');
      const validatedDocIds = requestBody.documentIds.map(id => validateUUID(id, 'documentId'));
      const priority = requestBody.priority !== undefined
        ? validateInteger(requestBody.priority, 'priority', 1, 10)
        : 5;

      const result = await handleEnqueueAction(
        supabase,
        userId,
        validatedCaseId,
        validatedDocIds,
        priority
      );

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    console.error('OCR Queue Processor Error:', error);
    if (error instanceof Error) {
      return createErrorResponse(error, 500, 'ocr-queue-processor', corsHeaders);
    }
    return createErrorResponse(new Error('An unknown error occurred'), 500, 'ocr-queue-processor', corsHeaders);
  }
});
