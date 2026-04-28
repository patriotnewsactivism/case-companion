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
import { getGenerateContentCapableGeminiModels, getPreferredGeminiCandidates, rankGeminiModels } from '../_shared/gemini-model-utils.ts';

const STORAGE_BUCKET = 'case-documents';
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min
const DEFAULT_GEMINI_MODELS = getPreferredGeminiCandidates(Deno.env.get('GOOGLE_AI_MODEL'));


type TimelineImportance = 'low' | 'medium' | 'high';

interface TimelineEventCandidate {
  event_date?: string;
  title?: string;
  description?: string;
  importance?: string;
  event_type?: string;
}

interface ChunkAnalysisResult {
  summary: string;
  keyFacts: string[];
  favorableFindings: string[];
  adverseFindings: string[];
  actionItems: string[];
  timelineEvents: TimelineEventCandidate[];
}

const ANALYSIS_CHUNK_CHAR_LIMIT = 12000;
const ANALYSIS_CHUNK_OVERLAP = 500;

const importanceRank: Record<TimelineImportance, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const normalizeImportance = (value: string | undefined): TimelineImportance => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
};

const normalizeTitleKey = (value: string | undefined): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toDateOnlyString = (value: string | undefined): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
};

const uniqueTrimmed = (items: string[], maxItems: number): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = item.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }

  return result;
};

const buildTextChunks = (text: string, maxChars: number, overlapChars: number): string[] => {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < cleaned.length) {
    let end = Math.min(cursor + maxChars, cleaned.length);
    if (end < cleaned.length) {
      const breakIdx = cleaned.lastIndexOf('\n\n', end);
      if (breakIdx > cursor + Math.floor(maxChars * 0.6)) {
        end = breakIdx;
      }
    }

    const chunk = cleaned.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) break;
    cursor = Math.max(end - overlapChars, cursor + 1);
  }

  return chunks;
};

const mergeChunkAnalyses = (analyses: ChunkAnalysisResult[]): ChunkAnalysisResult => {
  const timelineMap = new Map<string, TimelineEventCandidate>();
  const summaryParts: string[] = [];

  for (const analysis of analyses) {
    if (analysis.summary.trim()) {
      summaryParts.push(analysis.summary.trim());
    }

    for (const event of analysis.timelineEvents || []) {
      const normalizedDate = toDateOnlyString(event.event_date);
      const normalizedTitle = normalizeTitleKey(event.title);
      if (!normalizedDate || !normalizedTitle) continue;

      const key = `${normalizedDate}|${normalizedTitle}`;
      const existing = timelineMap.get(key);
      if (!existing) {
        timelineMap.set(key, {
          ...event,
          event_date: normalizedDate,
          title: event.title?.trim() || 'Untitled Event',
          description: (event.description || '').trim(),
          importance: normalizeImportance(event.importance),
        });
        continue;
      }

      const existingImportance = normalizeImportance(existing.importance);
      const candidateImportance = normalizeImportance(event.importance);
      const strongerImportance =
        importanceRank[candidateImportance] > importanceRank[existingImportance]
          ? candidateImportance
          : existingImportance;

      timelineMap.set(key, {
        ...existing,
        description:
          (event.description || '').length > (existing.description || '').length
            ? (event.description || '').trim()
            : (existing.description || '').trim(),
        importance: strongerImportance,
      });
    }
  }

  return {
    summary: uniqueTrimmed(summaryParts, 3).join(' '),
    keyFacts: uniqueTrimmed(analyses.flatMap((analysis) => analysis.keyFacts || []), 12),
    favorableFindings: uniqueTrimmed(analyses.flatMap((analysis) => analysis.favorableFindings || []), 8),
    adverseFindings: uniqueTrimmed(analyses.flatMap((analysis) => analysis.adverseFindings || []), 8),
    actionItems: uniqueTrimmed(analyses.flatMap((analysis) => analysis.actionItems || []), 8),
    timelineEvents: Array.from(timelineMap.values()).sort((a, b) =>
      (toDateOnlyString(a.event_date) || '9999-12-31').localeCompare(toDateOnlyString(b.event_date) || '9999-12-31')
    ),
  };
};


type OcrQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';
type QueueAction = 'process' | 'status' | 'enqueue' | 'retry';

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
  jobId?: string;
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

let resolvedGeminiModels: string[] | null = null;

async function resolveGeminiModels(googleApiKey: string): Promise<string[]> {
  if (resolvedGeminiModels) return resolvedGeminiModels;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleApiKey}`);
    if (!response.ok) {
      resolvedGeminiModels = DEFAULT_GEMINI_MODELS;
      return resolvedGeminiModels;
    }

    const payload = await response.json();
    const availableModels = getGenerateContentCapableGeminiModels(payload);
    if (availableModels.length === 0) {
      resolvedGeminiModels = DEFAULT_GEMINI_MODELS;
      return resolvedGeminiModels;
    }

    resolvedGeminiModels = rankGeminiModels(DEFAULT_GEMINI_MODELS, availableModels);
    return resolvedGeminiModels;
  } catch (_error) {
    resolvedGeminiModels = DEFAULT_GEMINI_MODELS;
    return resolvedGeminiModels;
  }
}

async function invokeGeminiWithFallback(
  googleApiKey: string,
  body: Record<string, unknown>,
  purpose: 'OCR' | 'analysis'
): Promise<{ payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }; model: string }> {
  const candidateModels = await resolveGeminiModels(googleApiKey);
  let lastError = 'No Gemini models attempted';

  for (const model of candidateModels) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const payload = await response.json();
      return { payload, model };
    }

    const errorText = await response.text();
    const unavailableModel =
      (response.status === 404 || response.status === 400) &&
      /model|not found|not supported/i.test(errorText);

    if (response.status === 429) {
      throw new Error(`Gemini ${purpose} rate limit exceeded (${model})`);
    }

    if (unavailableModel) {
      lastError = `${model}: ${errorText}`;
      continue;
    }

    throw new Error(`Gemini ${purpose} failed (${model}, ${response.status}): ${errorText}`);
  }

  throw new Error(`Gemini ${purpose} failed for all models: ${lastError}`);
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

  const { payload: aiData } = await invokeGeminiWithFallback(
    googleApiKey,
    {
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
    },
    'OCR'
  );

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
  timelineEvents: TimelineEventCandidate[];
}> {
  const hasOpenAI = !!openaiApiKey;
  const hasGemini = !!googleApiKey;

  const emptyResult: ChunkAnalysisResult = {
    summary: '',
    keyFacts: [],
    favorableFindings: [],
    adverseFindings: [],
    actionItems: [],
    timelineEvents: [],
  };

  if (extractedText.length <= 50 || (!hasOpenAI && !hasGemini)) {
    return emptyResult;
  }

  const chunks = buildTextChunks(extractedText, ANALYSIS_CHUNK_CHAR_LIMIT, ANALYSIS_CHUNK_OVERLAP);
  const chunkResults: ChunkAnalysisResult[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const analysisPrompt = `You are an expert legal document analyst specializing in litigation support. Analyze documents with precision and identify strategic insights for case preparation.

Analyze this legal document chunk and provide JSON output for this chunk only.

ANALYSIS REQUIREMENTS:
1. SUMMARY: 1-2 sentence chunk summary
2. KEY_FACTS: up to 6 factual findings
3. FAVORABLE_FINDINGS: up to 4 helpful findings
4. ADVERSE_FINDINGS: up to 4 harmful findings
5. ACTION_ITEMS: up to 4 follow-up actions
6. TIMELINE_EVENTS: Extract chronological events from this chunk. For each event provide:
   - "event_date": YYYY-MM-DD format (if approximate, use first of month/year)
   - "title": Short title (5-10 words)
   - "description": Detailed description (1-2 sentences)
   - "importance": "high", "medium", or "low"
   - "event_type": e.g., "communication", "filing", "incident", "meeting"

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "key_facts": ["fact1", "fact2"],
  "favorable_findings": ["finding1", "finding2"],
  "adverse_findings": ["finding1", "finding2"],
  "action_items": ["action1", "action2"],
  "timeline_events": [
    { "event_date": "2023-01-01", "title": "...", "description": "...", "importance": "high", "event_type": "..." }
  ]
}

Chunk ${index + 1} of ${chunks.length}:
${chunk}`;

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
            temperature: 0.1,
            max_tokens: 2500,
            response_format: { type: 'json_object' },
          }),
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          content = analysisData.choices?.[0]?.message?.content || '';
        }
      } catch (error) {
        console.error(`OpenAI analysis error (chunk ${index + 1}):`, error);
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
              temperature: 0.1,
              maxOutputTokens: 2500,
              responseMimeType: 'application/json',
            }
          }),
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          content = extractGeminiText(analysisData);
        }
      } catch (error) {
        console.error(`Gemini analysis error (chunk ${index + 1}):`, error);
      }
    }

    if (!content) continue;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const analysis = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      chunkResults.push({
        summary: String(analysis.summary || ''),
        keyFacts: Array.isArray(analysis.key_facts) ? analysis.key_facts.map((item) => String(item)) : [],
        favorableFindings: Array.isArray(analysis.favorable_findings)
          ? analysis.favorable_findings.map((item) => String(item))
          : [],
        adverseFindings: Array.isArray(analysis.adverse_findings)
          ? analysis.adverse_findings.map((item) => String(item))
          : [],
        actionItems: Array.isArray(analysis.action_items)
          ? analysis.action_items.map((item) => String(item))
          : [],
        timelineEvents: Array.isArray(analysis.timeline_events)
          ? (analysis.timeline_events as TimelineEventCandidate[])
          : [],
      });
    } catch (parseError) {
      console.error(`Failed to parse analysis JSON (chunk ${index + 1}):`, parseError);
    }
  }

  if (chunkResults.length === 0) {
    return emptyResult;
  }

  return mergeChunkAnalyses(chunkResults);
}


async function processOcrJob(
  supabase: SupabaseClient,
  job: OcrQueueJob,
  ocrSpaceApiKey: string | undefined,
  googleApiKey: string | undefined,
  openaiApiKey: string | undefined,
  aiGatewayUrl: string | undefined
): Promise<{ success: boolean; error?: string }> {
  const hasOcrSpace = !!ocrSpaceApiKey;
  const hasGemini = !!googleApiKey;

  if (!hasGemini && !hasOcrSpace) {
    return {
      success: false,
      error: 'No OCR providers configured. Please set GOOGLE_AI_API_KEY or OCR_SPACE_API_KEY.',
    };
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

      if (hasGemini) {
        try {
          extractedText = await geminiOcr(googleApiKey!, fileBlob, mimeType, !!isImage);
          console.log(`Gemini extracted ${extractedText.length} characters`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Gemini: ${msg}`);
          console.error('Gemini OCR error:', msg);
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

      if (!extractedText) {
        const modePrefix = 'All OCR providers failed.';
        return { success: false, error: `${modePrefix} ${errors.join('; ')}`.trim() };
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

    const hasAnalysis =
      summary.length > 0 ||
      keyFacts.length > 0 ||
      favorableFindings.length > 0 ||
      adverseFindings.length > 0 ||
      actionItems.length > 0 ||
      timelineEvents.length > 0;

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ocr_text: extractedText,
        ocr_processed_at: new Date().toISOString(),
        ai_analyzed: hasAnalysis,
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

    const normalizedEvents = timelineEvents
      .map((event) => {
        const normalizedDate = toDateOnlyString(event.event_date);
        const normalizedTitle = (event.title || '').trim();
        if (!normalizedDate || !normalizedTitle) return null;

        const nowIso = new Date().toISOString();
        return {
          case_id: doc.case_id,
          user_id: job.user_id,
          linked_document_id: doc.id,
          event_date: new Date(`${normalizedDate}T00:00:00.000Z`).toISOString(),
          title: normalizedTitle.slice(0, 180),
          description: (event.description || '').trim().slice(0, 2000),
          importance: normalizeImportance(event.importance),
          event_type: (event.event_type || 'general').trim().slice(0, 100),
          created_at: nowIso,
          updated_at: nowIso,
        };
      })
      .filter((event): event is {
        case_id: string;
        user_id: string;
        linked_document_id: string;
        event_date: string;
        title: string;
        description: string;
        importance: TimelineImportance;
        event_type: string;
        created_at: string;
        updated_at: string;
      } => !!event)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .filter((event, index, arr) => {
        const dedupeKey = `${event.event_date.slice(0, 10)}|${normalizeTitleKey(event.title)}`;
        return (
          arr.findIndex(
            (candidate) =>
              `${candidate.event_date.slice(0, 10)}|${normalizeTitleKey(candidate.title)}` === dedupeKey
          ) === index
        );
      })
      .slice(0, 10);

    if (normalizedEvents.length > 0) {
      const { error: clearError } = await supabase
        .from('timeline_events')
        .delete()
        .eq('linked_document_id', doc.id);

      if (clearError) {
        return { success: false, error: `Failed to clear prior timeline events: ${clearError.message}` };
      }

      const { error: insertError } = await supabase
        .from('timeline_events')
        .insert(normalizedEvents);

      if (insertError) {
        return { success: false, error: `Failed to insert timeline events: ${insertError.message}` };
      }
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

async function handleProcessAction(
  supabase: SupabaseClient,
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

async function handleRetryAction(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
  jobId: string
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

  const { data: jobData, error: jobError } = await supabase
    .from('ocr_queue')
    .select('id, document_id, status, case_id, user_id')
    .eq('id', jobId)
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single();

  if (jobError || !jobData) {
    throw new Error('Queue job not found');
  }

  if ((jobData as { status: OcrQueueStatus }).status !== 'failed') {
    throw new Error('Only failed jobs can be retried');
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('ocr_queue')
    .update({
      status: 'pending',
      attempts: 0,
      retry_after: null,
      error_message: null,
      updated_at: now,
      started_at: null,
      completed_at: null
    })
    .eq('id', jobId)
    .eq('case_id', caseId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to retry queue job: ${updateError.message}`);
  }

  return {
    processed: 0,
    remaining: 1,
    failed: 0,
    jobs: [{
      id: (jobData as { id: string }).id,
      documentId: (jobData as { document_id: string }).document_id,
      status: 'pending'
    }]
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
      const rateLimitCheck = checkRateLimit(`ocr-queue:${userId}`, 60, 60000);
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

    if (action === 'retry') {
      if (!requestBody.caseId) {
        throw new Error('Missing required field: caseId');
      }
      if (!requestBody.jobId) {
        throw new Error('Missing required field: jobId');
      }

      const validatedCaseId = validateUUID(requestBody.caseId, 'caseId');
      const validatedJobId = validateUUID(requestBody.jobId, 'jobId');

      const result = await handleRetryAction(
        supabase,
        userId,
        validatedCaseId,
        validatedJobId
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
