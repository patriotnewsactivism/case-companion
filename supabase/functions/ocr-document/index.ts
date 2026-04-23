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
import { getGenerateContentCapableGeminiModels, getPreferredGeminiCandidates, rankGeminiModels } from '../_shared/gemini-model-utils.ts';
import { analyzeDocument, formatAnalyzeResultAsText, formatTableAsMarkdown, type TableResult } from '../_shared/azureDocumentIntelligence.ts';
import { callAzureOpenAI } from '../_shared/azureOpenAI.ts';

const STORAGE_BUCKET = 'case-documents';

interface OcrSpaceParsedResult {
  ParsedText?: string;
}

interface OcrSpaceResponse {
  OCRExitCode?: number;
  ParsedResults?: OcrSpaceParsedResult[];
  ErrorMessage?: string | string[];
}

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

interface GeminiJsonBody {
  contents: Array<{ parts: Array<{ text: string }> }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType: 'application/json';
  };
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

interface AnalysisCaseContext {
  caseName?: string | null;
  caseType?: string | null;
  clientName?: string | null;
  representation?: string | null;
  caseTheory?: string | null;
  keyIssues?: string[] | null;
}

interface StructuredAnalysisOutput {
  title?: unknown;
  document_type?: unknown;
  legal_importance?: unknown;
  key_evidence?: unknown;
  evidentiary_value?: unknown;
  summary?: unknown;
  key_facts?: unknown;
  favorable_findings?: unknown;
  adverse_findings?: unknown;
  action_items?: unknown;
  timeline_events?: unknown;
  entities?: unknown;
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

const compactWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const toStringArray = (value: unknown, maxItems: number): string[] => {
  if (!Array.isArray(value)) return [];
  return uniqueTrimmed(
    value
      .map((item) => compactWhitespace(String(item || '')))
      .filter((item) => item.length > 0),
    maxItems,
  );
};

const cleanSummary = (value: unknown): string => {
  const normalized = compactWhitespace(String(value || ''));
  if (!normalized) return '';
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);
  return compactWhitespace(sentences.join(' ')).slice(0, 700);
};

const inferDocumentTitle = (documentName: string, summary: string, text: string): string => {
  const candidates: string[] = [];
  const normalizedName = documentName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  if (normalizedName) candidates.push(normalizedName);

  const summaryLead = cleanSummary(summary).split(/[.?!]/)[0]?.trim();
  if (summaryLead) candidates.push(summaryLead);

  const firstNonArtifactLine = normalizeExtractedText(text)
    .split('\n')
    .map((line) => compactWhitespace(line))
    .find((line) => line.length >= 8 && !isOcrArtifact(line) && !isTitleOcrJunk(line));
  if (firstNonArtifactLine) candidates.push(firstNonArtifactLine);

  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/^Document\s*[:\-]\s*/i, '')
      .replace(/^Subject\s*[:\-]\s*/i, '')
      .replace(/\b(page\s+\d+\s+of\s+\d+)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || cleaned.length < 5 || isTitleOcrJunk(cleaned)) continue;
    return cleaned.slice(0, 80);
  }

  return normalizedName.slice(0, 80) || 'Document Summary';
};

const filterFactsByUsefulness = (facts: string[], maxItems: number): string[] => {
  const useful = facts.filter((fact) => {
    const value = compactWhitespace(fact);
    if (value.length < 12 || value.length > 280) return false;
    if (isOcrArtifact(value)) return false;
    if (/^(summary|recommendation|strategic significance|next steps)\b/i.test(value)) return false;
    if (/\b(page\s+\d+|document\s+\d+|case\s+\d+[:\-])\b/i.test(value) && value.length < 40) return false;
    return /(\b\d{4}\b|\$\d|\b(admitted|stated|testified|reported|signed|served|filed|received|emailed|called|meeting|incident|injury|payment|deadline|diagnosis|estimate|agreement|termination|inspection|repair|complaint|response|order)\b)/i.test(value);
  });
  return uniqueTrimmed(useful, maxItems);
};

const filterTimelineEvents = (events: TimelineEventCandidate[]): TimelineEventCandidate[] => {
  return events.filter((event) => {
    const title = compactWhitespace(event.event_title || '');
    const description = compactWhitespace(event.description || '');
    if (!toDateOnlyString(event.date)) return false;
    if (!title || title.length < 5 || isTitleOcrJunk(title)) return false;
    if (!description || description.length < 15) return false;
    if (isOcrArtifact(description)) return false;
    if (!/(filed|served|hearing|trial|deposition|meeting|conference|incident|accident|injury|deadline|notice|email|letter|call|agreement|payment|settlement|judgment|order|motion|complaint|treatment|evaluation|inspection|repair|termination|response)/i.test(`${title} ${description}`)) {
      return false;
    }
    return true;
  });
};

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

const isTitleOcrJunk = (title: string): boolean => {
  const t = title.trim();
  if (/^(PAGE\s+\d+|=== PAGE)/i.test(t)) return true;
  if (/^(Case\s+)?\d+[:\-]\d+[-\w]*\s*(Document|cv|cr)/i.test(t)) return true;
  if (/^PAGE\s+\d+\s+Case/i.test(t)) return true;
  if (t.replace(/[\d\s:\-\/cvCVPage]+/g, '').length < 5) return true;
  return false;
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
  let title = (event.event_title || '').trim();
  title = title.replace(/={2,}\s*PAGE\s+\d+\s*={0,}/gi, '').replace(/^PAGE\s+\d+\s*/i, '').trim();
  const description = (event.description || '').replace(/={2,}\s*PAGE\s+\d+\s*={0,}/gi, '').trim();
  const eventType = (event.event_type || '').trim();
  const content = `${title} ${description} ${eventType}`.toLowerCase();
  const entities = Array.isArray(event.entities) ? event.entities : [];
  const importance = normalizeImportance(event.importance);
  const phase = normalizePhase(event.phase, content);
  const nextRequiredAction = (event.next_required_action || '').trim() || inferNextRequiredAction(phase, content);
  if (!title && description.length < 20) return null;
  if (isTitleOcrJunk(title)) return null;
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

const buildAnalysisDocumentContext = (text: string, maxChars = 120000): string => {
  const normalized = normalizeExtractedText(text);
  if (normalized.length <= maxChars) return normalized;
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

const isOcrArtifact = (sentence: string): boolean => {
  const s = sentence.trim();
  if (/^={2,}\s*PAGE\s+\d+/i.test(s)) return true;
  if (/^PAGE\s+\d+\s+(Case|of)\b/i.test(s)) return true;
  if (/^Case\s+\d+[:\-]\d+/i.test(s)) return true;
  if (/^Document\s+[#\d]/i.test(s) && /Page\s+\d+\s+of\s+\d+/i.test(s)) return true;
  const cleaned = s.replace(/(?:PAGE|DOCUMENT|===|\d+\s*of\s*\d+|Case\s*\d+[:\-]\S+)/gi, '').trim();
  if (cleaned.length < 15) return true;
  return false;
};

const buildTimelineTitle = (sentence: string, dateToken: string | null): string => {
  let cleaned = sentence.replace(/={2,}\s*PAGE\s+\d+\s*={0,}/gi, '').trim();
  cleaned = cleaned.replace(/^PAGE\s+\d+\s*/i, '').trim();
  const withoutDate = dateToken ? cleaned.replace(dateToken, ' ') : cleaned;
  const withoutCaseNum = withoutDate.replace(/Case\s+\d+[:\-]\d+[-\w]*/gi, ' ').trim();
  const withoutDocRef = withoutCaseNum.replace(/Document\s+#?\s*\d+/gi, ' ').replace(/Page\s+\d+\s+of\s+\d+/gi, ' ').trim();
  const words = withoutDocRef.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 8);
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
    if (isOcrArtifact(sentence)) continue;
    const dateToken = extractDateToken(sentence);
    if (!dateToken) continue;
    if (!/\b(filed|served|hearing|trial|deposition|meeting|conference|incident|accident|injury|deadline|notice|email|letter|call|agreement|contract|payment|settlement|judgment|order|motion|complaint)\b/i.test(sentence)) continue;
    const title = buildTimelineTitle(sentence, dateToken);
    if (title.length < 5 || /^(Document event|Filed|Page|Case)$/i.test(title)) continue;
    const cleanDesc = sentence.replace(/={2,}\s*PAGE\s+\d+\s*={0,}/gi, '').replace(/^PAGE\s+\d+\s*/i, '').trim();
    timelineEvents.push({
      date: toDateOnlyString(dateToken) || undefined,
      event_title: title,
      description: cleanDesc.slice(0, 280),
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

function buildTargetedAnalysisPrompt(
  documentName: string,
  documentContext: string,
  tableContext: string,
  caseContext?: AnalysisCaseContext,
): string {
  const caseSummary = [
    caseContext?.caseName ? `Case: ${caseContext.caseName}` : '',
    caseContext?.caseType ? `Type: ${caseContext.caseType}` : '',
    caseContext?.clientName ? `Client: ${caseContext.clientName}` : '',
    caseContext?.representation ? `Representation: ${caseContext.representation}` : '',
    caseContext?.caseTheory ? `Theory: ${caseContext.caseTheory}` : '',
    caseContext?.keyIssues?.length ? `Key issues: ${caseContext.keyIssues.join('; ')}` : '',
  ].filter(Boolean).join('\n');

  const tableSection = tableContext
    ? `\n\nEXTRACTED TABLES:\n${tableContext}`
    : '';

  return `You are analyzing a legal document for litigation use. Be selective and practical.

Return ONLY facts that matter to the case. Do not invent details. Do not include generic strategic commentary. Do not include recommendations unless directly supported by the document.

Produce valid JSON with exactly these fields:
{
  "title": "short distinctive title (5-10 words) to differentiate this document from others in the case",
  "document_type": "type of legal document (e.g., complaint, interrogatory response, medical record, correspondence, deposition, contract, bill, police report, expert report)",
  "legal_importance": "brief assessment: critical|high|medium|low",
  "key_evidence": ["specific evidentiary item from the document that could be used as proof at trial"],
  "evidentiary_value": "1 sentence: what this document proves or establishes for the case",
  "summary": "2-3 sentences max",
  "key_facts": ["important fact from the document"],
  "favorable_findings": ["fact helpful to this side"],
  "adverse_findings": ["fact harmful to this side"],
  "action_items": ["follow-up only if the document itself clearly triggers one"],
  "timeline_events": [{ "date": "YYYY-MM-DD", "event_title": "short title", "description": "what happened and why it matters", "importance": "high|medium|low", "event_type": "communication|filing|incident|meeting|deadline|medical|financial|contractual", "phase": "pre-suit|pleadings|discovery|dispositive|trial|post-trial", "next_required_action": "optional", "entities": ["..."] }],
  "entities": [{ "name": "...", "type": "person|organization|location", "role": "..." }]
}

Rules:
- title must be a short, distinctive label so a lawyer can tell this document apart from others at a glance. Not just the filename.
- document_type must be a standard legal document category, not a description.
- key_evidence must list specific items that could be introduced as exhibits or used for proof at trial (e.g., "Defendant's admission that the pipe was installed on March 5", "Invoice #4471 for $12,500").
- evidentiary_value must state concisely what this document proves or establishes.
- Summary must read like a short docket-style document summary, not a memo.
- key_facts must be concrete facts only: dates, statements, amounts, diagnoses, communications, filings, admissions, deadlines, contract terms, witness-relevant facts.
- favorable_findings must contain only facts actually supported by the document that help the case.
- adverse_findings must contain only facts actually supported by the document that hurt the case.
- If a category has no reliable items, return an empty array.
- timeline_events must include only meaningful case dates found in the document itself.
- Ignore page numbers, Bates labels, OCR artifacts, headers, footers, filing stamps without substantive event meaning, and generic boilerplate.

DOCUMENT NAME: ${documentName}
${caseSummary ? `\nCASE CONTEXT:\n${caseSummary}` : ''}

DOCUMENT TEXT:
${documentContext}${tableSection}`;
}

async function analyzeStructuredDocument(
  documentName: string,
  extractedText: string,
  extractedTables: TableResult[],
  invokeGeminiWithFallback: (body: GeminiJsonBody, purpose: 'OCR' | 'analysis') => Promise<{ payload: GeminiResponse; model: string }>,
  caseContext?: AnalysisCaseContext,
): Promise<{
  output: StructuredAnalysisOutput;
  provider: 'azure_openai' | 'gemini' | 'none';
}> {
  const analysisContext = buildAnalysisDocumentContext(extractedText, 90000);
  const tableContext = extractedTables.length > 0
    ? extractedTables.map((t, i) => `Table ${i + 1}:\n${formatTableAsMarkdown(t)}`).join('\n\n')
    : '';

  const prompt = buildTargetedAnalysisPrompt(documentName, analysisContext, tableContext, caseContext);

  try {
    const azureContent = await callAzureOpenAI(
      [
        { role: 'system', content: 'You extract only concrete litigation-relevant document facts and dates. Respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.05, maxTokens: 2500, jsonMode: true },
    );
    return {
      output: JSON.parse(azureContent) as StructuredAnalysisOutput,
      provider: 'azure_openai',
    };
  } catch (azureError) {
    console.warn('Azure OpenAI targeted analysis unavailable, falling back to Gemini.', azureError);
  }

  try {
    const { payload, model } = await invokeGeminiWithFallback(
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      },
      'analysis',
    );
    const content = extractGeminiText(payload);
    if (!content) return { output: {}, provider: 'none' };
    console.log(`Gemini targeted analysis completed with model: ${model}`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return {
      output: jsonMatch ? JSON.parse(jsonMatch[0]) as StructuredAnalysisOutput : {},
      provider: 'gemini',
    };
  } catch (geminiError) {
    console.error('Gemini targeted analysis error:', geminiError);
  }

  return { output: {}, provider: 'none' };
}

// ===== Azure Document Intelligence OCR (primary - best quality) =====
// Uses prebuilt-layout model: extracts text + structured tables + key-value pairs
// Falls back to prebuilt-read if layout model is unavailable on the endpoint
async function azureDIOcr(fileBlob: Blob): Promise<{ text: string; tables: TableResult[] }> {
  let result;
  try {
    console.log('Azure DI: Submitting with prebuilt-layout (tables + full text)...');
    result = await analyzeDocument(fileBlob, 'prebuilt-layout');
  } catch (layoutErr) {
    const msg = layoutErr instanceof Error ? layoutErr.message : String(layoutErr);
    // If it's a model availability or endpoint issue, try the simpler read model
    if (/model|resource not found|unsupported|invalid request|404/i.test(msg)) {
      console.warn(`Azure DI prebuilt-layout unavailable (${msg}), trying prebuilt-read...`);
      result = await analyzeDocument(fileBlob, 'prebuilt-read');
    } else {
      throw layoutErr;
    }
  }

  const text = formatAnalyzeResultAsText(result);
  if (!text.trim()) throw new Error('Azure DI returned empty content');

  const tables = result.tables || [];
  console.log(`Azure DI: ${text.length} chars, ${tables.length} tables, ${result.pages.length} pages`);
  return { text, tables };
}

// ===== Azure Computer Vision Read API v3.2 (fallback if DI not available) =====
async function azureCVReadOcr(fileBlob: Blob, contentType: string): Promise<string> {
  const endpoint = Deno.env.get('AZURE_VISION_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_VISION_API_KEY');
  if (!endpoint || !apiKey) throw new Error('Azure Computer Vision not configured');

  const baseUrl = endpoint.replace(/\/+$/, '');
  const analyzeUrl = `${baseUrl}/vision/v3.2/read/analyze`;

  console.log(`Azure CV Read API v3.2: Submitting ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB...`);

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
    throw new Error(`Azure CV Read submit failed (${submitResponse.status}): ${errorText}`);
  }

  const operationLocation = submitResponse.headers.get('Operation-Location');
  if (!operationLocation) throw new Error('Azure CV Read: No Operation-Location header');

  let result: any = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    await delay(attempt < 5 ? 1000 : 2000);
    const pollResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    if (!pollResponse.ok) throw new Error(`Azure CV Read poll failed: ${pollResponse.status}`);
    result = await pollResponse.json();
    if (result.status === 'succeeded') break;
    if (result.status === 'failed') throw new Error(`Azure CV Read analysis failed: ${JSON.stringify(result.error)}`);
  }

  if (!result || result.status !== 'succeeded') throw new Error('Azure CV Read: Timed out');

  const readResults = result.analyzeResult?.readResults || [];
  if (!readResults.length) throw new Error('Azure CV Read returned no readResults');

  const pageTexts: string[] = [];
  for (const pageResult of readResults) {
    const lines = pageResult.lines || [];
    const pageText = lines.map((l: any) => l.text || '').join('\n');
    if (readResults.length > 1) {
      pageTexts.push(`=== PAGE ${pageResult.page} ===\n${pageText}`);
    } else {
      pageTexts.push(pageText);
    }
  }

  const extracted = pageTexts.join('\n\n');
  if (!extracted.trim()) throw new Error('Azure CV Read returned empty text');
  console.log(`Azure CV Read: ${extracted.length} chars from ${readResults.length} pages`);
  return extracted;
}

// ===== PDF embedded text extraction (Tier 0 — no OCR needed) =====
async function extractPdfEmbeddedText(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text: string[] = [];
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  // Extract text between BT...ET (Begin Text / End Text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Match Tj (show string) and TJ (show array of strings) operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tj: RegExpExecArray | null;

    while ((tj = tjRegex.exec(block)) !== null) {
      const decoded = tj[1]
        .replace(/\\n/g, '\n').replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
        .replace(/\\([()])/g, '$1');
      text.push(decoded);
    }
    while ((tj = tjArrayRegex.exec(block)) !== null) {
      const parts = tj[1].match(/\(([^)]*)\)/g) || [];
      const line = parts.map(p =>
        p.slice(1, -1)
          .replace(/\\n/g, '\n').replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
          .replace(/\\([()])/g, '$1')
      ).join('');
      if (line.trim()) text.push(line);
    }
  }

  const result = text.join(' ').replace(/\s+/g, ' ').trim();
  return result;
}

// ===== Tesseract.js OCR (free offline fallback for scanned documents) =====
async function tesseractOcr(blob: Blob, isImage: boolean): Promise<string> {
  console.log('Attempting Tesseract.js OCR...');

  // Dynamic import to avoid loading unless needed
  const { createWorker } = await import('https://esm.sh/tesseract.js@5?target=deno');
  const worker = await createWorker('eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
  });

  try {
    if (isImage) {
      // Direct image OCR
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const { data } = await worker.recognize(uint8);
      console.log(`Tesseract OCR: ${data.text.length} chars, confidence: ${data.confidence}%`);
      if (data.confidence < 20) {
        throw new Error(`Tesseract confidence too low (${data.confidence}%)`);
      }
      return data.text;
    } else {
      // For PDFs, we can't use Tesseract directly — it needs images
      throw new Error('Tesseract.js requires image input; PDF must be converted to images first');
    }
  } finally {
    await worker.terminate();
  }
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
    const azureEndpoint = Deno.env.get('AZURE_DOC_INTELLIGENCE_ENDPOINT') || Deno.env.get('AZURE_VISION_ENDPOINT');
    const azureKey = Deno.env.get('AZURE_DOC_INTELLIGENCE_KEY') || Deno.env.get('AZURE_VISION_API_KEY');
    const hasAzureOpenAI = !!(
      Deno.env.get('AZURE_OPENAI_API_KEY') &&
      Deno.env.get('AZURE_OPENAI_ENDPOINT') &&
      Deno.env.get('AZURE_OPENAI_DEPLOYMENT_NAME')
    );

    const hasAzure = !!(azureEndpoint && azureKey);
    const hasOcrSpace = !!ocrSpaceApiKey;
    const hasGemini = !!googleApiKey;
    const geminiModelCandidates = getPreferredGeminiCandidates(Deno.env.get('GOOGLE_AI_MODEL'));

    console.log(`OCR providers: Gemini=${hasGemini}, AzureDI=${hasAzure}, Tesseract=true, OCR.space=${hasOcrSpace}`);
    console.log(`Analysis providers: AzureOpenAI=${hasAzureOpenAI}, Gemini=${hasGemini}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
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
      .select('case_id, name, cases!inner(user_id, name, case_type, client_name, representation, case_theory, key_issues)')
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

    const caseDetails = Array.isArray(caseRelation) ? caseRelation[0] : caseRelation;
    const analysisCaseContext: AnalysisCaseContext = {
      caseName: typeof caseDetails?.name === 'string' ? caseDetails.name : null,
      caseType: typeof caseDetails?.case_type === 'string' ? caseDetails.case_type : null,
      clientName: typeof caseDetails?.client_name === 'string' ? caseDetails.client_name : null,
      representation: typeof caseDetails?.representation === 'string' ? caseDetails.representation : null,
      caseTheory: typeof caseDetails?.case_theory === 'string' ? caseDetails.case_theory : null,
      keyIssues: Array.isArray(caseDetails?.key_issues) ? caseDetails.key_issues as string[] : null,
    };

    const { blob: fileBlob, contentType } = await loadFileBlob(supabase, validatedFileUrl);
    const resolvedContentType = contentType || fileBlob.type || '';
    let extractedText = '';
    let extractedTables: TableResult[] = [];
    let ocrProvider = '';

    // ===== OCR EXTRACTION - Triple-tier with Azure as primary =====
    let resolvedGeminiModels: string[] | null = null;

    const resolveGeminiModels = async (): Promise<string[]> => {
      if (resolvedGeminiModels) return resolvedGeminiModels;

      const preferredModels = geminiModelCandidates;
      if (!googleApiKey) {
        resolvedGeminiModels = preferredModels;
        return preferredModels;
      }

      try {
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleApiKey}`);
        if (!modelsResponse.ok) {
          console.warn(`Unable to list Gemini models (${modelsResponse.status}). Falling back to preferred defaults.`);
          resolvedGeminiModels = preferredModels;
          return preferredModels;
        }

        const modelsPayload = await modelsResponse.json();
        const availableModels = getGenerateContentCapableGeminiModels(modelsPayload);
        if (availableModels.length === 0) {
          resolvedGeminiModels = preferredModels;
          return preferredModels;
        }

        resolvedGeminiModels = rankGeminiModels(preferredModels, availableModels);
        return resolvedGeminiModels;
      } catch (modelError) {
        console.warn('Failed to resolve Gemini models. Falling back to preferred defaults.', modelError);
        resolvedGeminiModels = preferredModels;
        return preferredModels;
      }
    };

    const invokeGeminiWithFallback = async (
      body: Record<string, unknown>,
      purpose: 'OCR' | 'analysis'
    ): Promise<{ payload: GeminiResponse; model: string }> => {
      if (!googleApiKey) throw new Error('Google AI API key not configured');

      let lastError = 'No Gemini models attempted';

      const candidateModels = await resolveGeminiModels();

      for (const model of candidateModels) {
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
          throw new Error(`Gemini ${purpose} rate limit exceeded (${model})`);
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

    const ocrSpaceExtract = async (blob: Blob, isImage: boolean, ct?: string): Promise<string> => {
      if (!ocrSpaceApiKey) throw new Error('OCR.space API key not configured');
      console.log('Using OCR.space fallback...');
      const extension = isImage ? 'jpg' : 'pdf';
      const fileName = `document.${extension}`;
      const file = new File([blob], fileName, { type: ct || (isImage ? 'image/jpeg' : 'application/pdf') });
      const formData = new FormData();
      formData.append('file', file, fileName);
      formData.append('apikey', ocrSpaceApiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2');
      formData.append('filetype', extension.toUpperCase());

      const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`OCR.space API failed: ${response.status}`);

      const result = (await response.json()) as OcrSpaceResponse;
      if (result.OCRExitCode !== 1 || !result.ParsedResults?.length) {
        const errorMessage = Array.isArray(result.ErrorMessage) ? result.ErrorMessage.join(', ') : (result.ErrorMessage || 'Unknown error');
        throw new Error(`OCR.space parsing failed: ${errorMessage}`);
      }

      const extracted = result.ParsedResults
        .map((page, idx: number) => {
          const pageText = page.ParsedText || '';
          return result.ParsedResults!.length > 1 ? `=== PAGE ${idx + 1} ===\n${pageText}` : pageText;
        })
        .join('\n\n');

      console.log(`OCR.space extracted ${extracted.length} characters`);
      return extracted;
    };

    const isOcrTarget =
      resolvedContentType.includes('image') ||
      resolvedContentType.includes('pdf') ||
      !!validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|pdf)$/i);

    if (isOcrTarget) {
      const isImage = resolvedContentType.includes('image') || !!validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i);
      const isPdf = resolvedContentType.includes('pdf') || !!validatedFileUrl.match(/\.pdf$/i);
      console.log(`Document: ${(fileBlob.size / 1024 / 1024).toFixed(2)}MB, MIME: ${resolvedContentType}, isImage: ${isImage}, isPdf: ${isPdf}`);

      const errors: string[] = [];

      // Tier 0: PDF embedded text extraction (fast, free — works for PDFs with text layers)
      if (isPdf && !isImage) {
        try {
          console.log('Attempting PDF embedded text extraction (Tier 0)...');
          const pdfText = await extractPdfEmbeddedText(fileBlob);
          // Only accept if we got substantial text (not just metadata/headers)
          if (pdfText.length > 100) {
            extractedText = pdfText;
            ocrProvider = 'pdf_text_extract';
            console.log(`PDF text extraction: ${extractedText.length} chars (no OCR needed)`);
          } else {
            console.log(`PDF text extraction: only ${pdfText.length} chars — likely scanned, proceeding to OCR`);
          }
        } catch (pdfError) {
          console.log(`PDF text extraction skipped: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
        }
      }

      // Tier 1: Gemini 2.5 Pro (best multimodal AI for legal docs — tables, stamps, Bates numbers)
      if (!extractedText && hasGemini) {
        try {
          console.log('Attempting Gemini OCR (primary — best for legal documents)...');
          const mimeType = resolvedContentType || (isImage ? 'image/jpeg' : 'application/pdf');
          extractedText = await geminiOcr(fileBlob, mimeType, isImage);
          ocrProvider = 'gemini';
        } catch (error) {
          console.error('Gemini OCR error:', error);
          errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Tier 2: Azure Document Intelligence - prebuilt-layout (extracts tables + text)
      if (!extractedText && hasAzure) {
        try {
          console.log('Attempting Azure Document Intelligence...');
          const diResult = await azureDIOcr(fileBlob);
          extractedText = diResult.text;
          extractedTables = diResult.tables;
          ocrProvider = 'azure_di';
        } catch (diError) {
          console.error('Azure DI error:', diError);
          errors.push(`Azure DI: ${diError instanceof Error ? diError.message : String(diError)}`);

          // Tier 2b: Azure Computer Vision Read API v3.2
          try {
            console.log('Attempting Azure Computer Vision Read API v3.2...');
            const mimeType = resolvedContentType || (isImage ? 'image/jpeg' : 'application/pdf');
            extractedText = await azureCVReadOcr(fileBlob, mimeType);
            ocrProvider = 'azure_cv';
          } catch (cvError) {
            console.error('Azure CV error:', cvError);
            errors.push(`Azure CV: ${cvError instanceof Error ? cvError.message : String(cvError)}`);
          }
        }
      }

      // Tier 3: Tesseract.js (free offline OCR — best for scanned image documents)
      if (!extractedText && isImage) {
        try {
          extractedText = await tesseractOcr(fileBlob, isImage);
          ocrProvider = 'tesseract';
        } catch (error) {
          console.error('Tesseract.js error:', error);
          errors.push(`Tesseract: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Tier 4: OCR.space (backup — 25k/month free, 1MB file limit on free tier)
      if (!extractedText && hasOcrSpace) {
        try {
          extractedText = await ocrSpaceExtract(fileBlob, isImage, resolvedContentType);
          ocrProvider = 'ocr_space';
        } catch (error) {
          console.error('OCR.space error:', error);
          errors.push(`OCR.space: ${error instanceof Error ? error.message : String(error)}`);
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

    // ===== AI ANALYSIS =====
    // Chain: Azure OpenAI (GPT-4o) → Gemini → Heuristic
    let title = '';
    let documentType = '';
    let legalImportance = '';
    let keyEvidence: string[] = [];
    let evidentiaryValue = '';
    let keyFacts: string[] = [];
    let favorableFindings: string[] = [];
    let adverseFindings: string[] = [];
    let actionItems: string[] = [];
    let summary = '';
    let timelineEvents: unknown[] = [];
    let extractedEntities: unknown[] = [];
    let analysisProvider: 'azure_openai' | 'gemini' | 'heuristic' | 'none' = 'none';

    const hasSubstantialText = Boolean(
      extractedText &&
      extractedText.length > 50 &&
      !extractedText.startsWith('[File type')
    );

    if (hasSubstantialText) {
      const { output: analysisOutput, provider: aProvider } = await analyzeStructuredDocument(
        documentData.name,
        extractedText,
        extractedTables,
        invokeGeminiWithFallback,
        analysisCaseContext,
      );

      if (aProvider !== 'none') {
        analysisProvider = aProvider;
        title = compactWhitespace(String(analysisOutput.title || ''));
        documentType = compactWhitespace(String(analysisOutput.document_type || ''));
        legalImportance = compactWhitespace(String(analysisOutput.legal_importance || ''));
        keyEvidence = toStringArray(analysisOutput.key_evidence, 10);
        evidentiaryValue = compactWhitespace(String(analysisOutput.evidentiary_value || ''));
        summary = cleanSummary(analysisOutput.summary);
        keyFacts = filterFactsByUsefulness(toStringArray(analysisOutput.key_facts, 15), 12);
        favorableFindings = filterFactsByUsefulness(toStringArray(analysisOutput.favorable_findings, 10), 8);
        adverseFindings = filterFactsByUsefulness(toStringArray(analysisOutput.adverse_findings, 10), 8);
        actionItems = toStringArray(analysisOutput.action_items, 5);
        timelineEvents = Array.isArray(analysisOutput.timeline_events) ? analysisOutput.timeline_events : [];
        extractedEntities = Array.isArray(analysisOutput.entities) ? analysisOutput.entities : [];
        console.log(`Analysis parsed via ${aProvider}: ${keyFacts.length} facts, ${keyEvidence.length} evidence items, ${timelineEvents.length} events`);
      }

      if (!title) {
        title = inferDocumentTitle(documentData.name, summary, extractedText);
      }
    }

    // === Analysis Tier 3: Heuristic fallback ===
    if (hasSubstantialText && summary.length === 0 && keyFacts.length === 0) {
      console.log('AI analysis unavailable — falling back to heuristic extraction...');
      const heuristic = buildHeuristicAnalysis(extractedText);
      analysisProvider = 'heuristic';
      summary = heuristic.summary;
      keyFacts = heuristic.keyFacts;
      favorableFindings = heuristic.favorableFindings;
      adverseFindings = heuristic.adverseFindings;
      actionItems = heuristic.actionItems;
      timelineEvents = heuristic.timelineEvents;
      if (!title) title = inferDocumentTitle(documentData.name, summary, extractedText);
    }

    const hasAnalysis = summary.length > 0 || keyFacts.length > 0 || favorableFindings.length > 0 || adverseFindings.length > 0 || actionItems.length > 0 || timelineEvents.length > 0;

    const updateData: Record<string, unknown> = {
      ocr_text: extractedText,
      ocr_processed_at: new Date().toISOString(),
      ocr_provider: ocrProvider,
      ai_analyzed: hasAnalysis,
      title: title || null,
      document_type: documentType || null,
      legal_importance: legalImportance || null,
      key_evidence: keyEvidence.length > 0 ? keyEvidence : null,
      evidentiary_value: evidentiaryValue || null,
      summary: summary || null,
      key_facts: keyFacts.length > 0 ? keyFacts : null,
      favorable_findings: favorableFindings.length > 0 ? favorableFindings : null,
      adverse_findings: adverseFindings.length > 0 ? adverseFindings : null,
      action_items: actionItems.length > 0 ? actionItems : null,
      entities: extractedEntities.length > 0 ? extractedEntities : null,
    };

    // Store structured tables extracted by Azure DI
    if (extractedTables.length > 0) {
      updateData.extracted_tables = extractedTables;
    }

    const { error: updateError } = await supabase.from('documents').update(updateData).eq('id', validatedDocumentId);

    if (updateError) {
      console.warn('Primary update failed, trying legacy fields...', updateError);
      const legacyData: Record<string, unknown> = {
        ocr_text: extractedText,
        ai_analyzed: hasAnalysis,
        title: title || null,
        document_type: documentType || null,
        legal_importance: legalImportance || null,
        key_evidence: keyEvidence.length > 0 ? keyEvidence : null,
        evidentiary_value: evidentiaryValue || null,
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

    console.log(`Document processed: ocrProvider=${ocrProvider}, analysisProvider=${analysisProvider}, tables=${extractedTables.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        textLength: extractedText.length,
        ocrProvider,
        analysisProvider,
        hasAnalysis,
        title,
        documentType,
        legalImportance,
        keyEvidence,
        evidentiaryValue,
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
