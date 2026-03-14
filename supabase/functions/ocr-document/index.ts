import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, validateURL } from '../_shared/validation.ts';

const STORAGE_BUCKET = 'case-documents';

interface GeminiContentPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiContentPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

type TimelineImportance = 'low' | 'medium' | 'high';
type TimelinePhase = 'pre-suit' | 'pleadings' | 'discovery' | 'dispositive' | 'trial' | 'post-trial';

const DEFAULT_TIMELINE_EVENT_CAP = 30;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_TIMELINE_EVENTS = parsePositiveInt(Deno.env.get('TIMELINE_EVENT_CAP'), DEFAULT_TIMELINE_EVENT_CAP);

interface TimelineEventCandidate {
  date?: string;
  event_title?: string;
  description?: string;
  importance?: string;
  event_type?: string;
  phase?: string;
  next_required_action?: string;
  entities?: string[];
}

interface TimelineEventInsertRow {
  case_id: string;
  user_id: string;
  linked_document_id: string;
  event_date: string;
  title: string;
  description: string;
  importance: TimelineImportance;
  event_type: string;
  phase: TimelinePhase;
  next_required_action: string | null;
  entities: string[];
  created_at: string;
  updated_at: string;
}

interface HeuristicAnalysisResult {
  summary: string;
  keyFacts: string[];
  favorableFindings: string[];
  adverseFindings: string[];
  actionItems: string[];
  timelineEvents: TimelineEventCandidate[];
}

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

async function loadFileBlob(
  supabase: SupabaseClient,
  fileUrl: string
): Promise<{ blob: Blob; contentType: string }> {
  const storagePath = extractStoragePath(fileUrl);
  if (storagePath) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
    if (!error && data) return { blob: data, contentType: data.type || '' };
  }
  if (!fileUrl.startsWith('http')) throw new Error('File URL is not a valid URL');
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
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
  text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();

const extractGeminiText = (payload: GeminiResponse): string => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => String(part?.text || '')).join('').trim();
};

const toDateOnlyString = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
};

const normalizeImportance = (value: string | undefined): TimelineImportance => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') return normalized;
  return 'medium';
};

const normalizePhase = (value: string | undefined, fallbackContent: string): TimelinePhase => {
  const normalized = (value || '').trim().toLowerCase();
  if (['pre-suit', 'pleadings', 'discovery', 'dispositive', 'trial', 'post-trial'].includes(normalized)) return normalized as TimelinePhase;
  if (/\b(incident|accident|injury|demand|notice of claim|retainer|investigation|preservation)\b/i.test(fallbackContent)) return 'pre-suit';
  if (/\b(complaint|answer|counterclaim|service|summons|amended complaint|pleading)\b/i.test(fallbackContent)) return 'pleadings';
  if (/\b(interrogator|request for production|request for admission|deposition|subpoena|expert disclosure|discovery)\b/i.test(fallbackContent)) return 'discovery';
  if (/\b(summary judgment|dismiss|dispositive|daubert|in limine|motion to strike|motion for judgment)\b/i.test(fallbackContent)) return 'dispositive';
  if (/\b(trial|voir dire|jury|verdict|testimony|exhibit list|pretrial conference)\b/i.test(fallbackContent)) return 'trial';
  if (/\b(appeal|post-trial|new trial|remittitur|enforcement|collection|satisfaction of judgment)\b/i.test(fallbackContent)) return 'post-trial';
  return 'discovery';
};

const inferNextRequiredAction = (phase: TimelinePhase, content: string): string => {
  if (phase === 'pre-suit') return /\b(statute|limitations)\b/i.test(content) ? 'Confirm statute of limitations and file suit before deadline.' : 'Collect foundational records and preserve evidence relevant to claims.';
  if (phase === 'pleadings') return 'Calendar responsive pleading and service deadlines for all parties.';
  if (phase === 'discovery') return /\b(deposition)\b/i.test(content) ? 'Prepare deposition outlines and circulate witness document sets.' : 'Track discovery responses and schedule follow-up meet-and-confer items.';
  if (phase === 'dispositive') return 'Assemble evidentiary record and briefing schedule for dispositive motions.';
  if (phase === 'trial') return 'Finalize trial preparation checklist: exhibits, witnesses, and motions in limine.';
  return 'Evaluate post-trial motions, appellate deadlines, and enforcement strategy.';
};

const normalizeTimelineEvent = (
  event: TimelineEventCandidate,
  caseId: string,
  documentId: string,
  ownerUserId: string
): TimelineEventInsertRow | null => {
  const nowIso = new Date().toISOString();
  const dateOnly = toDateOnlyString(event.date);
  if (!dateOnly) return null;
  const title = (event.event_title || '').trim();
  const description = (event.description || '').trim();
  const eventType = (event.event_type || '').trim();
  const content = `${title} ${description} ${eventType}`.toLowerCase();
  const entities = Array.isArray(event.entities) ? event.entities : [];
  const importance = normalizeImportance(event.importance);
  const phase = normalizePhase(event.phase, content);
  const nextRequiredAction = (event.next_required_action || '').trim() || inferNextRequiredAction(phase, content);
  if (!title && description.length < 20) return null;
  return {
    case_id: caseId,
    user_id: ownerUserId,
    linked_document_id: documentId,
    event_date: new Date(`${dateOnly}T00:00:00.000Z`).toISOString(),
    title: title.length > 0 ? title.slice(0, 180) : 'Untitled Event',
    description: description.slice(0, 2000),
    importance,
    event_type: eventType.length > 0 ? eventType.slice(0, 100) : 'general',
    phase,
    next_required_action: nextRequiredAction.slice(0, 240) || null,
    entities,
    created_at: nowIso,
    updated_at: nowIso,
  };
};

const sentenceSplitRegex = /[^.!?\\n]+[.!?]?/g;

const extractSentences = (text: string): string[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return normalized.match(sentenceSplitRegex)?.map((s) => s.trim()).filter(Boolean) || [];
};

// Send the FULL document to the AI model - Gemini 2.5 supports 1M+ tokens
const buildAnalysisDocumentContext = (text: string, maxChars = 120000): string => {
  const normalized = normalizeExtractedText(text);
  if (normalized.length <= maxChars) return normalized;
  // For extremely long documents, keep head + tail + key sentences
  const head = normalized.slice(0, maxChars * 0.7);
  const tail = normalized.slice(-maxChars * 0.2);
  return `${head}\n\n[... document continues ...]\n\n${tail}`;
};

const monthNames = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';

const dateTokenMatchers = [
  new RegExp(`\\b${monthNames}\\s+\\d{1,2},\\s+\\d{4}\\b`, 'i'),
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  new RegExp(`\\b${monthNames}\\s+\\d{4}\\b`, 'i'),
] as const;

const extractDateToken = (sentence: string): string | null => {
  for (const matcher of dateTokenMatchers) {
    const match = sentence.match(matcher);
    if (match?.[0]) return match[0];
  }
  return null;
};

const buildTimelineTitle = (sentence: string, dateToken: string | null): string => {
  const withoutDate = dateToken ? sentence.replace(dateToken, ' ') : sentence;
  const words = withoutDate.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 8);
  if (words.length === 0) return 'Document event';
  const base = words.join(' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const inferEventType = (sentence: string): string => {
  if (/\b(filed|motion|complaint|petition|answer|brief|order)\b/i.test(sentence)) return 'filing';
  if (/\b(hearing|trial|deposition|mediation|conference|meeting)\b/i.test(sentence)) return 'meeting';
  if (/\b(email|letter|call|message|notice|response)\b/i.test(sentence)) return 'communication';
  if (/\b(incident|accident|collision|injury|damage)\b/i.test(sentence)) return 'incident';
  return 'general';
};

const inferImportance = (sentence: string): TimelineImportance => {
  if (/\b(trial|hearing|deadline|deposition|filed|served|breach|injury|accident|default|termination)\b/i.test(sentence)) return 'high';
  if (/\b(meeting|mediation|response|notice|email|letter|call)\b/i.test(sentence)) return 'medium';
  return 'low';
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

const buildHeuristicAnalysis = (text: string): HeuristicAnalysisResult => {
  const sentences = extractSentences(text).slice(0, 100);
  const timelineEvents: TimelineEventCandidate[] = [];
  for (const sentence of sentences) {
    const dateToken = extractDateToken(sentence);
    if (!dateToken) continue;
    if (!/\b(filed|served|hearing|trial|deposition|meeting|conference|incident|accident|injury|deadline|notice|email|letter|call|agreement|contract|payment|settlement|judgment|order|motion|complaint)\b/i.test(sentence)) continue;
    timelineEvents.push({
      date: toDateOnlyString(dateToken) || undefined,
      event_title: buildTimelineTitle(sentence, dateToken),
      description: sentence.slice(0, 280),
      importance: inferImportance(sentence),
      event_type: inferEventType(sentence),
      phase: normalizePhase(undefined, sentence),
    });
    if (timelineEvents.length >= MAX_TIMELINE_EVENTS) break;
  }
  const factCandidates = sentences.filter((s) => /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\$|\d{2,}|agreement|demand|response|meeting|incident|email|letter)\b/i.test(s));
  const favorableCandidates = sentences.filter((s) => /\b(admit|confirmed|supports|favorable|complied|approved|paid|received|signed)\b/i.test(s));
  const adverseCandidates = sentences.filter((s) => /\b(deny|denied|dispute|late|overdue|breach|damaging|adverse|inconsistent|liability|default|failed)\b/i.test(s));
  return {
    summary: uniqueTrimmed(sentences.slice(0, 3), 3).join(' '),
    keyFacts: uniqueTrimmed(factCandidates, 10),
    favorableFindings: uniqueTrimmed(favorableCandidates, 5),
    adverseFindings: uniqueTrimmed(adverseCandidates, 5),
    actionItems: uniqueTrimmed([
      timelineEvents.length > 0 ? 'Validate timeline events against the source document and related exhibits.' : '',
      adverseCandidates.length > 0 ? 'Address adverse statements with corroborating evidence and witness preparation.' : '',
      factCandidates.length > 0 ? 'Link key factual statements to Bates-numbered exhibits for trial use.' : '',
      'Review OCR output for any transcription issues before filing or strategy use.',
    ], 4),
    timelineEvents: timelineEvents.sort((a, b) => {
      const aDate = toDateOnlyString(a.date) || '9999-12-31';
      const bDate = toDateOnlyString(b.date) || '9999-12-31';
      return aDate.localeCompare(bDate);
    }),
  };
};

// ===== Azure Document Intelligence OCR =====
async function azureDocumentIntelligenceOcr(fileBlob: Blob, contentType: string): Promise<string> {
  const endpoint = Deno.env.get('AZURE_DOC_INTELLIGENCE_ENDPOINT') || Deno.env.get('AZURE_VISION_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_DOC_INTELLIGENCE_KEY') || Deno.env.get('AZURE_VISION_API_KEY');
  
  if (!endpoint || !apiKey) throw new Error('Azure Document Intelligence not configured');
  
  const baseUrl = endpoint.replace(/\/+$/, '');
  // Use the prebuilt-read model for best OCR quality
  const analyzeUrl = `${baseUrl}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`;
  
  console.log(`Azure Document Intelligence: Submitting ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB document...`);
  
  const submitResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: fileBlob,
  });
  
  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Azure DI submit failed (${submitResponse.status}): ${errorText}`);
  }
  
  const operationLocation = submitResponse.headers.get('Operation-Location');
  if (!operationLocation) throw new Error('Azure DI: No Operation-Location header returned');
  
  // Poll for results - Azure DI is fast, usually <10s
  let result: any = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    await delay(attempt < 5 ? 1000 : 2000);
    
    const pollResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    
    if (!pollResponse.ok) {
      throw new Error(`Azure DI poll failed: ${pollResponse.status}`);
    }
    
    result = await pollResponse.json();
    
    if (result.status === 'succeeded') break;
    if (result.status === 'failed') throw new Error(`Azure DI analysis failed: ${JSON.stringify(result.error)}`);
    // still running, continue polling
  }
  
  if (!result || result.status !== 'succeeded') {
    throw new Error('Azure DI: Timed out waiting for results');
  }
  
  // Extract text from all pages
  const pages = result.analyzeResult?.pages || [];
  const content = result.analyzeResult?.content || '';
  
  if (content && content.trim().length > 0) {
    console.log(`Azure DI extracted ${content.length} chars from ${pages.length} pages`);
    return content;
  }
  
  // Fallback: build from pages
  const pageTexts: string[] = [];
  for (const page of pages) {
    const lines = page.lines || [];
    const pageText = lines.map((l: any) => l.content || '').join('\n');
    if (pages.length > 1) {
      pageTexts.push(`=== PAGE ${page.pageNumber} ===\n${pageText}`);
    } else {
      pageTexts.push(pageText);
    }
  }
  
  const extracted = pageTexts.join('\n\n');
  if (!extracted.trim()) throw new Error('Azure DI returned empty text');
  
  console.log(`Azure DI extracted ${extracted.length} chars from ${pages.length} pages (line-level)`);
  return extracted;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const azureEndpoint = Deno.env.get('AZURE_DOC_INTELLIGENCE_ENDPOINT') || Deno.env.get('AZURE_VISION_ENDPOINT');
    const azureKey = Deno.env.get('AZURE_DOC_INTELLIGENCE_KEY') || Deno.env.get('AZURE_VISION_API_KEY');

    const hasAzure = !!(azureEndpoint && azureKey);
    const hasGemini = !!googleApiKey;
    const configuredGeminiModel = (Deno.env.get('GOOGLE_AI_MODEL') || '').trim();
    const geminiModelCandidates = Array.from(new Set([
      configuredGeminiModel,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean)));

    console.log(`OCR providers: Azure=${hasAzure}, Gemini=${hasGemini}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    type AuthUser = { id: string };
    type DocumentOwner = { cases?: { user_id?: string } | Array<{ user_id?: string }> };

    let user: AuthUser;
    let supabase: SupabaseClient;
    let isServiceRole = false;

    if (serviceRoleKey && bearerToken === serviceRoleKey) {
      console.log('Service role authentication detected');
      isServiceRole = true;
      supabase = createClient(supabaseUrl, serviceRoleKey);
      user = { id: 'service-role' };
    } else {
      const authResult = await verifyAuth(req);
      if (!authResult.authorized || !authResult.user || !authResult.supabase) {
        return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'ocr-document', corsHeaders);
      }
      user = authResult.user;
      supabase = authResult.supabase;
    }

    // Higher rate limit - 60 per minute to support batch processing
    if (!isServiceRole) {
      const rateLimitCheck = checkRateLimit(`ocr:${user.id}`, 60, 60000);
      if (!rateLimitCheck.allowed) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<{ documentId: string; fileUrl: string }>(requestBody, ['documentId', 'fileUrl']);

    const { documentId, fileUrl } = requestBody;
    const validatedDocumentId = validateUUID(documentId as string, 'documentId');
    const validatedFileUrl = validateURL(fileUrl as string);

    console.log(`Processing OCR for document: ${validatedDocumentId}`);

    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('case_id, name, cases!inner(user_id)')
      .eq('id', validatedDocumentId)
      .single();

    if (docError || !documentData) {
      return createErrorResponse(new Error('Document not found'), 404, 'ocr-document', corsHeaders);
    }

    const caseRelation = (documentData as DocumentOwner).cases;
    const ownerId = Array.isArray(caseRelation) ? caseRelation[0]?.user_id : caseRelation?.user_id;

    if (!ownerId) {
      return createErrorResponse(new Error('Document owner could not be resolved'), 500, 'ocr-document', corsHeaders);
    }

    if (!isServiceRole && ownerId !== user.id) {
      return forbiddenResponse('You do not have access to this document', corsHeaders);
    }

    console.log(`Processing: ${documentData.name}`);

    const { blob: fileBlob, contentType } = await loadFileBlob(supabase, validatedFileUrl);
    const resolvedContentType = contentType || fileBlob.type || '';
    let extractedText = '';
    const extractedTables: unknown[] = [];
    let ocrProvider = '';

    // ===== OCR EXTRACTION - Triple-tier with Azure as primary =====
    const invokeGeminiWithFallback = async (
      body: Record<string, unknown>,
      purpose: 'OCR' | 'analysis'
    ): Promise<{ payload: GeminiResponse; model: string }> => {
      if (!googleApiKey) throw new Error('Google AI API key not configured');

      let lastError = 'No Gemini models attempted';

      for (const model of geminiModelCandidates) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );

        if (response.ok) {
          const payload = (await response.json()) as GeminiResponse;
          return { payload, model };
        }

        const errorText = await response.text();
        const unavailableModel =
          (response.status === 404 || response.status === 400) &&
          /model|not found|not supported/i.test(errorText);

        if (response.status === 429) {
          lastError = `${model}: rate limit exceeded`;
          console.warn(`Gemini ${purpose} rate limit on ${model}, trying next model...`);
          continue;
        }

        if (unavailableModel) {
          lastError = `${model}: ${errorText}`;
          console.warn(`Gemini model unavailable for ${purpose}, trying next model: ${model}`);
          continue;
        }

        throw new Error(`Gemini ${purpose} failed (${model}, ${response.status}): ${errorText}`);
      }

      throw new Error(`Gemini ${purpose} failed for all models: ${lastError}`);
    };

    const geminiOcr = async (fileBlob: Blob, mimeType: string, isImage: boolean): Promise<string> => {
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);

      const prompt = isImage
        ? `You are a professional legal document OCR system. Extract ALL text from this image with the highest possible accuracy. Preserve exact formatting, line breaks, headings, tables, stamps, dates, signatures, marginalia, Bates numbers, exhibit numbers, and document identifiers. Return plain text only.`
        : `You are a professional legal document OCR system. Extract ALL text from every page of this PDF with the highest possible accuracy. Preserve exact formatting, line breaks, headings, tables, stamps, dates, signatures, marginalia, Bates numbers, exhibit numbers, and document identifiers. Prefix each page with "=== PAGE X ===". Return plain text only.`;

      const { payload, model } = await invokeGeminiWithFallback(
        {
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 65536 },
        },
        'OCR'
      );

      const text = extractGeminiText(payload);
      if (!text?.trim()) throw new Error(`Gemini returned empty OCR text (${model})`);
      console.log(`Gemini OCR succeeded with model: ${model}`);
      return text;
    };

    const isOcrTarget =
      resolvedContentType.includes('image') ||
      resolvedContentType.includes('pdf') ||
      !!validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|pdf)$/i);

    if (isOcrTarget) {
      if (!hasAzure && !hasGemini) {
        throw new Error('No OCR providers configured. Set Azure Document Intelligence or Google AI API key.');
      }

      const isImage = resolvedContentType.includes('image') || !!validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i);
      console.log(`Document: ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB, MIME: ${resolvedContentType}, isImage: ${isImage}`);

      const errors: string[] = [];

      // Tier 1: Azure Document Intelligence (best quality, handles large multi-page docs)
      if (hasAzure) {
        try {
          console.log('Attempting Azure Document Intelligence (primary - best quality)...');
          const mimeType = resolvedContentType || (isImage ? 'image/jpeg' : 'application/pdf');
          extractedText = await azureDocumentIntelligenceOcr(fileBlob, mimeType);
          ocrProvider = 'azure_di';
          console.log(`Azure DI extracted ${extractedText.length} characters`);
        } catch (error) {
          console.error('Azure DI error:', error);
          errors.push(`Azure: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Tier 2: Gemini Flash (AI-powered OCR, handles multi-page PDFs natively)
      if (!extractedText && hasGemini) {
        try {
          console.log('Attempting Gemini Flash OCR...');
          const mimeType = resolvedContentType || (isImage ? 'image/jpeg' : 'application/pdf');
          extractedText = await geminiOcr(fileBlob, mimeType, isImage);
          ocrProvider = 'gemini';
          console.log(`Gemini OCR extracted ${extractedText.length} characters`);
        } catch (error) {
          console.error('Gemini OCR error:', error);
          errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!extractedText) {
        throw new Error(`All OCR providers failed. ${errors.join('; ')}`);
      }
    } else if (resolvedContentType.includes('text') || !!validatedFileUrl.match(/\.(txt|doc|docx)$/i)) {
      extractedText = await fileBlob.text();
      ocrProvider = 'direct-text';
      console.log(`Read ${extractedText.length} characters from text file`);
    } else {
      extractedText = `[File type ${resolvedContentType || 'unknown'} - OCR not available for this format]`;
      ocrProvider = 'none';
    }

    extractedText = normalizeExtractedText(extractedText);

    if (isOcrTarget && extractedText.length < 30) {
      throw new Error('OCR extraction returned too little text. The file may be corrupted or heavily redacted.');
    }

    // ===== AI ANALYSIS - Use Gemini 2.5 Flash for best speed+quality =====
    let keyFacts: string[] = [];
    let favorableFindings: string[] = [];
    let adverseFindings: string[] = [];
    let actionItems: string[] = [];
    let summary = '';
    let timelineEvents: unknown[] = [];
    let extractedEntities: unknown[] = [];
    let analysisProvider: 'gemini' | 'heuristic' | 'none' = 'none';

    if (extractedText && extractedText.length > 50 && !extractedText.startsWith('[File type') && hasGemini) {
      console.log('Analyzing extracted text with Gemini 2.5 Flash...');

      // Send the FULL document text - Gemini 2.5 Flash handles 1M+ tokens
      const analysisContext = buildAnalysisDocumentContext(extractedText);

      const analysisPrompt = `You are an expert legal document analyst specializing in litigation support. Analyze this document with maximum precision and extract every strategically relevant detail.
      
ANALYSIS REQUIREMENTS:
1. SUMMARY: 3-5 sentence executive summary covering the document's content, significance, and strategic implications
2. KEY_FACTS: 8-15 specific factual findings (dates, events, statements, amounts, names, locations)
3. FAVORABLE_FINDINGS: 5-8 findings supporting the case (admissions, favorable testimony, helpful evidence, compliance, corroboration)
4. ADVERSE_FINDINGS: 5-8 findings that could hurt the case (contradictions, damaging statements, weaknesses, non-compliance)
5. ACTION_ITEMS: 5-8 specific follow-up actions (witnesses to interview, documents to request, issues to research, deadlines to calendar)
6. TIMELINE_EVENTS: Extract ALL chronological events (up to ${MAX_TIMELINE_EVENTS}). For each:
   - "date": YYYY-MM-DD (approximate if needed)
   - "event_title": Short title (5-10 words)
   - "description": Detailed description (1-3 sentences)
   - "importance": "high", "medium", or "low"
   - "event_type": "communication", "filing", "incident", "meeting", "deadline", "medical", "financial", "contractual"
   - "entities": Array of key people/orgs involved
   - "phase": "pre-suit", "pleadings", "discovery", "dispositive", "trial", or "post-trial"
   - "next_required_action": Practical next step for litigation planning
7. ENTITIES: Extract ALL key entities (people, organizations, locations) with their roles and relationships

Be exhaustive. Extract every date, every person mentioned, every significant fact. This analysis drives the entire case strategy.

Respond ONLY with valid JSON:
{
  "summary": "string",
  "key_facts": ["fact1", ...],
  "favorable_findings": ["finding1", ...],
  "adverse_findings": ["finding1", ...],
  "action_items": ["action1", ...],
  "timeline_events": [{ "date": "2023-01-01", "event_title": "...", "description": "...", "importance": "high", "event_type": "...", "phase": "...", "next_required_action": "...", "entities": ["Person A"] }],
  "entities": [{ "name": "...", "type": "person/organization/location", "role": "..." }]
}

Document text:
${analysisContext}`;

      let content = '';

      try {
        const { payload: analysisData, model } = await invokeGeminiWithFallback(
          {
            contents: [{ parts: [{ text: analysisPrompt }] }],
            generationConfig: {
              temperature: 0.15,
              maxOutputTokens: 16384,
              responseMimeType: 'application/json',
            },
          },
          'analysis'
        );

        content = extractGeminiText(analysisData);
        if (content) analysisProvider = 'gemini';
        console.log(`Gemini analysis completed with model: ${model}`);
      } catch (geminiError) {
        console.error('Gemini analysis error:', geminiError);
      }

      try {
        const jsonMatch = content.match(/{[\s\S]*}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          summary = analysis.summary || '';
          keyFacts = Array.isArray(analysis.key_facts) ? analysis.key_facts : [];
          favorableFindings = Array.isArray(analysis.favorable_findings) ? analysis.favorable_findings : [];
          adverseFindings = Array.isArray(analysis.adverse_findings) ? analysis.adverse_findings : [];
          actionItems = Array.isArray(analysis.action_items) ? analysis.action_items : [];
          timelineEvents = Array.isArray(analysis.timeline_events) ? analysis.timeline_events : [];
          extractedEntities = Array.isArray(analysis.entities) ? analysis.entities : [];
          console.log(`Analysis: ${keyFacts.length} facts, ${timelineEvents.length} events, ${extractedEntities.length} entities`);
        }
      } catch (parseError) {
        console.error('Failed to parse analysis JSON:', parseError);
        summary = content.substring(0, 500);
      }
    }

    // Heuristic fallback
    if (extractedText && extractedText.length > 80 && summary.length === 0 && keyFacts.length === 0) {
      console.log('AI analysis unavailable. Falling back to heuristic extraction...');
      const heuristic = buildHeuristicAnalysis(extractedText);
      analysisProvider = 'heuristic';
      summary = heuristic.summary;
      keyFacts = heuristic.keyFacts;
      favorableFindings = heuristic.favorableFindings;
      adverseFindings = heuristic.adverseFindings;
      actionItems = heuristic.actionItems;
      timelineEvents = heuristic.timelineEvents;
    }

    const hasAnalysis = summary.length > 0 || keyFacts.length > 0 || favorableFindings.length > 0 || adverseFindings.length > 0 || actionItems.length > 0 || timelineEvents.length > 0;

    const updateData: Record<string, unknown> = {
      ocr_text: extractedText,
      ocr_processed_at: new Date().toISOString(),
      ocr_provider: ocrProvider,
      ai_analyzed: hasAnalysis,
      summary: summary || null,
      key_facts: keyFacts.length > 0 ? keyFacts : null,
      favorable_findings: favorableFindings.length > 0 ? favorableFindings : null,
      adverse_findings: adverseFindings.length > 0 ? adverseFindings : null,
      action_items: actionItems.length > 0 ? actionItems : null,
      entities: extractedEntities.length > 0 ? extractedEntities : null,
    };

    if (extractedTables.length > 0) updateData.extracted_tables = extractedTables;

    const { error: updateError } = await supabase.from('documents').update(updateData).eq('id', validatedDocumentId);

    if (updateError) {
      console.warn('Primary update failed, trying legacy...', updateError);
      const legacyData: Record<string, unknown> = {
        ocr_text: extractedText,
        ai_analyzed: hasAnalysis,
        summary: summary || null,
        key_facts: keyFacts.length > 0 ? keyFacts : null,
        favorable_findings: favorableFindings.length > 0 ? favorableFindings : null,
        adverse_findings: adverseFindings.length > 0 ? adverseFindings : null,
        action_items: actionItems.length > 0 ? actionItems : null,
      };
      const { error: legacyError } = await supabase.from('documents').update(legacyData).eq('id', validatedDocumentId);
      if (legacyError) throw new Error(`Failed to update document: ${legacyError.message}`);
    }

    // ===== Timeline events insertion =====
    let timelineEventsInserted = 0;
    let timelineInsertWarning: string | null = null;

    if (timelineEvents.length > 0) {
      console.log(`Inserting ${timelineEvents.length} timeline events...`);
      const caseId = (documentData as { case_id: string }).case_id;

      const dedupedEvents = new Map<string, TimelineEventInsertRow[]>();
      const normalizedEvents = (timelineEvents as TimelineEventCandidate[])
        .map((event) => normalizeTimelineEvent(event, caseId, validatedDocumentId, ownerId))
        .filter((event): event is TimelineEventInsertRow => !!event)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
        .filter((event) => {
          const dedupeKey = `${event.event_date.slice(0, 10)}|${event.title.trim().toLowerCase()}`;
          const existing = dedupedEvents.get(dedupeKey) || [];
          if (existing.length === 0) { dedupedEvents.set(dedupeKey, [event]); return true; }
          const hasDiffType = existing.some((c) => c.event_type !== event.event_type);
          if (existing.length === 1 && hasDiffType) { dedupedEvents.set(dedupeKey, [...existing, event]); return true; }
          return false;
        })
        .slice(0, MAX_TIMELINE_EVENTS);

      if (normalizedEvents.length > 0) {
        const { error: clearError } = await supabase.from('timeline_events').delete().eq('linked_document_id', validatedDocumentId);
        if (clearError) { timelineInsertWarning = `Failed clearing old events: ${clearError.message}`; console.warn(timelineInsertWarning); }

        const { data: insertedRows, error: timelineError } = await supabase.from('timeline_events').insert(normalizedEvents).select('id');
        if (timelineError) {
          timelineInsertWarning = `Failed to insert timeline events: ${timelineError.message}`;
          console.error(timelineInsertWarning);
        } else {
          timelineEventsInserted = insertedRows?.length ?? normalizedEvents.length;
          console.log(`Timeline events inserted: ${timelineEventsInserted}`);
        }
      }
    }

    console.log('Document processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        textLength: extractedText.length,
        ocrProvider,
        analysisProvider,
        hasAnalysis,
        summary,
        keyFacts,
        favorableFindings,
        adverseFindings,
        actionItems,
        requestedTimelineEvents: timelineEvents.length,
        timelineEventsInserted,
        timelineInsertWarning,
        tablesExtracted: extractedTables.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('OCR Error:', error);
    return createErrorResponse(error instanceof Error ? error : new Error('An unknown error occurred'), 500, 'ocr-document', getCorsHeaders(req));
  }
});
