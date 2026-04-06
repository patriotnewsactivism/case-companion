import { supabase } from "@/integrations/supabase/client";
import { uploadAndProcessFile } from "./upload/unified-upload-handler";

export type CaseStatus = "active" | "discovery" | "pending" | "review" | "closed" | "archived";
export type RepresentationType = "plaintiff" | "defendant" | "executor" | "petitioner" | "respondent" | "other";

export interface Case {
  id: string;
  user_id: string;
  name: string;
  case_type: string;
  client_name: string;
  status: CaseStatus;
  representation: RepresentationType;
  case_theory: string | null;
  key_issues: string[] | null;
  winning_factors: string[] | null;
  next_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCaseInput {
  name: string;
  case_type: string;
  client_name: string;
  status?: CaseStatus;
  representation?: RepresentationType;
  case_theory?: string;
  next_deadline?: string;
  notes?: string;
}

export interface UpdateCaseInput extends Partial<CreateCaseInput> {
  id: string;
}

// Cases API
export async function getCases(): Promise<Case[]> {
  const { data, error } = await (supabase as any)
    .from("cases")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Case[]) || [];
}

export async function getCase(id: string): Promise<Case | null> {
  const { data, error } = await (supabase as any)
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Case | null;
}

export async function createCase(input: CreateCaseInput): Promise<Case> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreateCaseInput & { user_id: string } = {
    ...input,
    user_id: user.id,
  };

  const { data, error } = await (supabase as any)
    .from("cases")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Case;
}

export async function updateCase(input: UpdateCaseInput): Promise<Case> {
  const { id, ...updates } = input;
  const payload: Partial<CreateCaseInput> = updates;

  const { data, error } = await (supabase as any)
    .from("cases")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Case;
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("cases")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Documents API
export interface Document {
  id: string;
  case_id: string;
  user_id: string;
  name: string;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  bates_number: string | null;
  summary: string | null;
  key_facts: string[] | null;
  favorable_findings: string[] | null;
  adverse_findings: string[] | null;
  action_items: string[] | null;
  ai_analyzed: boolean;
  ocr_text: string | null;
  ocr_processed_at: string | null;
  ocr_provider: string | null;
  extracted_tables: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  case_id: string;
  name: string;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  bates_number?: string | null;
  summary?: string;
  key_facts?: string[];
  favorable_findings?: string[];
  adverse_findings?: string[];
  action_items?: string[];
}

export interface BulkDocumentUploadInput {
  files: File[];
  case_id: string;
  generate_bates: boolean;
  bates_prefix?: string;
  ocr_priority?: number;
}

export interface BulkUploadResult {
  successful: number;
  failed: number;
  total: number;
  errors: string[];
  documents: Document[];
  ocr_enqueue_requested: boolean;
  ocr_enqueue_error: string | null;
}

export async function getDocumentsByCase(caseId: string): Promise<Document[]> {
  const { data, error } = await (supabase as any)
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Document[]) || [];
}

export async function getAllDocuments(): Promise<Document[]> {
  const { data, error } = await (supabase as any)
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Document[]) || [];
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreateDocumentInput & { user_id: string } = {
    ...input,
    user_id: user.id,
  };

  const { data, error } = await (supabase as any)
    .from("documents")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Document;
}

export async function bulkUploadDocuments(input: BulkDocumentUploadInput): Promise<BulkUploadResult> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const results: BulkUploadResult = {
    successful: 0,
    failed: 0,
    total: input.files.length,
    errors: [],
    documents: [],
    ocr_enqueue_requested: false,
    ocr_enqueue_error: null,
  };

  const { data: existingDocs } = await (supabase as any)
    .from("documents")
    .select("bates_number")
    .eq("case_id", input.case_id);

  const maxBatesNumber = existingDocs?.reduce((max, doc) => {
    if (doc.bates_number) {
      const match = doc.bates_number.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0]);
        return Math.max(max, num);
      }
    }
    return max;
  }, 0) || 0;

  let currentBatesNumber = maxBatesNumber + 1;
  const batesPrefix = input.bates_prefix || 'DOC';

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    try {
      const batesNumber = input.generate_bates 
        ? `${batesPrefix}-${currentBatesNumber.toString().padStart(4, '0')}`
        : null;

      if (input.generate_bates) {
        currentBatesNumber++;
      }

      const uploadResult = await uploadAndProcessFile(
        file,
        input.case_id,
        user.id,
        undefined, // organizationId
        { bates_number: batesNumber }, // metadata
        input.ocr_priority
      );

      results.successful++;
      results.documents.push(uploadResult.document as unknown as Document);
    } catch (error) {
      results.failed++;
      results.errors.push(`File ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // The queue handles processing automatically, so we mark it as requested
  if (results.documents.length > 0) {
    results.ocr_enqueue_requested = true;
  }

  return results;
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
  const { data, error } = await (supabase as any)
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Document;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function triggerDocumentAnalysis(documentId: string, fileUrl: string): Promise<void> {
  const { data: { session } } = await (supabase as any).auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ documentId, fileUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OCR function error:', errorText);
    throw new Error(errorText || `HTTP ${response.status}`);
  }
}

// Timeline Events API
export interface TimelineEvent {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  phase: string;
  next_required_action: string | null;
  linked_document_id: string | null;
  importance: string;
  created_at: string;
  updated_at: string;
}

export async function getTimelineEventsByCase(caseId: string): Promise<TimelineEvent[]> {
  const { data, error } = await (supabase as any)
    .from("timeline_events")
    .select("*")
    .eq("case_id", caseId)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return (data as unknown as TimelineEvent[]) || [];
}

export async function getAllTimelineEvents(): Promise<TimelineEvent[]> {
  const { data, error } = await (supabase as any)
    .from("timeline_events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) throw error;
  return (data as unknown as TimelineEvent[]) || [];
}

export interface CreateTimelineEventInput {
  case_id: string;
  title: string;
  description?: string;
  event_date: string;
  event_type?: string;
  phase?: "pre-suit" | "pleadings" | "discovery" | "dispositive" | "trial" | "post-trial";
  next_required_action?: string;
  linked_document_id?: string;
  importance: "low" | "medium" | "high";
}

export async function createTimelineEvent(input: CreateTimelineEventInput): Promise<TimelineEvent> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreateTimelineEventInput & { user_id: string } = {
    ...input,
    user_id: user.id,
  };

  const { data, error } = await (supabase as any)
    .from("timeline_events")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TimelineEvent;
}

export async function updateTimelineEvent(id: string, updates: Partial<TimelineEvent>): Promise<TimelineEvent> {
  const { data, error } = await (supabase as any)
    .from("timeline_events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TimelineEvent;
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("timeline_events")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Get document statistics
export interface DocumentStats {
  total: number;
  analyzed: number;
  pending: number;
  withTimeline: number;
}

export async function getDocumentStats(): Promise<DocumentStats> {
  // Get documents
  const { data: docsData, error: docsError } = await (supabase as any)
    .from("documents")
    .select("id, ai_analyzed");

  if (docsError) throw docsError;

  // Get timeline events that are linked to documents
  const { data: timelineData, error: timelineError } = await (supabase as any)
    .from("timeline_events")
    .select("linked_document_id")
    .not("linked_document_id", "is", null);

  if (timelineError) throw timelineError;

  const docs = docsData || [];
  const linkedDocIds = new Set((timelineData || []).map(t => t.linked_document_id));
  
  return {
    total: docs.length,
    analyzed: docs.filter((d) => d.ai_analyzed).length,
    pending: docs.filter((d) => !d.ai_analyzed).length,
    withTimeline: linkedDocIds.size,
  };
}

// Profile API
export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  firm_name: string | null;
  bar_number: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Profile | null;
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await (supabase as any)
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Profile;
}

// Video Room API

export interface AnalysisResult {
  success: boolean;
  textLength: number;
  ocrProvider: string;
  analysisProvider?: 'openai' | 'gemini' | 'heuristic' | 'none';
  hasAnalysis: boolean;
  summary?: string;
  keyFacts?: string[];
  favorableFindings?: string[];
  adverseFindings?: string[];
  actionItems?: string[];
  tablesExtracted?: number;
  requestedTimelineEvents?: number;
  timelineEventsInserted?: number;
  timelineInsertWarning?: string;
}

export interface TableExtractionResult {
  tables: Array<{
    rowCount: number;
    columnCount: number;
    cells: Array<{
      rowIndex: number;
      columnIndex: number;
      content: string;
    }>;
  }>;
}

export interface DocumentChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
  metadata: {
    chunkIndex: number;
    totalChunks: number;
    wordCount: number;
    charCount: number;
  };
}

export async function analyzeDocument(
  documentId: string,
  fileUrl: string,
  extractTables: boolean = false
): Promise<AnalysisResult> {
  const { data: { session } } = await (supabase as any).auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ documentId, fileUrl, extractTables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OCR function error:', errorText);
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return await response.json();
}

export async function extractDocumentTables(
  documentId: string,
  fileUrl: string
): Promise<TableExtractionResult> {
  const { data: { session } } = await (supabase as any).auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ documentId, fileUrl, extractTables: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OCR function error:', errorText);
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const data = await response.json();
  
  return {
    tables: data.tablesExtracted || [],
  };
}

export function getDocumentChunks(
  document: Document,
  maxChunkSize: number = 8000
): DocumentChunk[] {
  if (!document.ocr_text) return [];
  
  const text = document.ocr_text;
  const chunks: DocumentChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;
  
  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChunkSize, text.length);
    
    if (endIndex < text.length) {
      const lastNewline = text.lastIndexOf('\n', endIndex);
      const lastPeriod = text.lastIndexOf('.', endIndex);
      const breakPoint = Math.max(lastNewline, lastPeriod);
      
      if (breakPoint > currentIndex + maxChunkSize * 0.5) {
        endIndex = breakPoint + 1;
      }
    }
    
    const content = text.substring(currentIndex, endIndex);
    chunks.push({
      id: `${document.id}-chunk-${chunkIndex}`,
      content,
      startIndex: currentIndex,
      endIndex,
      metadata: {
        chunkIndex,
        totalChunks: -1,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
        charCount: content.length,
      },
    });
    
    currentIndex = endIndex;
    chunkIndex++;
  }
  
  chunks.forEach((chunk, idx) => {
    chunk.metadata.totalChunks = chunks.length;
    chunk.metadata.chunkIndex = idx;
  });
  
  return chunks;
}

export function getDocumentChunksForContext(
  document: Document,
  maxTokens: number = 4000
): string {
  const chunks = getDocumentChunks(document);
  if (chunks.length === 0) return '';
  
  const avgCharsPerToken = 4;
  const maxChars = maxTokens * avgCharsPerToken;
  
  let result = '';
  let currentLength = 0;
  
  for (const chunk of chunks) {
    if (currentLength + chunk.content.length <= maxChars) {
      result += chunk.content + '\n\n';
      currentLength += chunk.content.length + 2;
    } else {
      break;
    }
  }
  
  return result.trim();
}

export async function getDocumentWithContext(
  documentId: string
): Promise<{ document: Document; chunks: DocumentChunk[]; context: string } | null> {
  const { data, error } = await (supabase as any)
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const document = data as unknown as Document;
  const chunks = getDocumentChunks(document);
  const context = getDocumentChunksForContext(document);

  return { document, chunks, context };
}

export interface BatchAnalysisResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    documentId: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export async function batchAnalyzeDocuments(
  documentIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<BatchAnalysisResult> {
  const result: BatchAnalysisResult = {
    total: documentIds.length,
    successful: 0,
    failed: 0,
    results: [],
  };

  const { data: documents, error } = await (supabase as any)
    .from('documents')
    .select('id, file_url')
    .in('id', documentIds);

  if (error) throw error;

  const docMap = new Map((documents || []).map(d => [d.id, d.file_url]));
  const { data: { session } } = await (supabase as any).auth.getSession();
  
  if (!session) throw new Error("Not authenticated");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
  const BATCH_SIZE = 5;

  const analyzeSingleDocument = async (docId: string): Promise<void> => {
    const fileUrl = docMap.get(docId);

    if (!fileUrl) {
      result.failed++;
      result.results.push({ documentId: docId, status: 'failed', error: 'File URL not found' });
      return;
    }

    const runAttempt = async (): Promise<Response> =>
      fetch(functionUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ documentId: docId, fileUrl }),
      });

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await runAttempt();

        if (response.ok) {
          result.successful++;
          result.results.push({ documentId: docId, status: 'success' });
          return;
        }

        const errorText = await response.text();
        const retryable = response.status === 429 || response.status >= 500;

        if (retryable && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
          continue;
        }

        result.failed++;
        result.results.push({
          documentId: docId,
          status: 'failed',
          error: errorText || `HTTP ${response.status}`,
        });
        return;
      } catch (err) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
          continue;
        }

        result.failed++;
        result.results.push({
          documentId: docId,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return;
      }
    }
  };

  for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
    const batch = documentIds.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map((docId) => analyzeSingleDocument(docId)));

    const completed = Math.min(i + BATCH_SIZE, documentIds.length);
    onProgress?.(completed, documentIds.length);

    if (i + BATCH_SIZE < documentIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return result;
}

export async function reanalyzeDocument(documentId: string): Promise<AnalysisResult> {
  const { data, error } = await (supabase as any)
    .from('documents')
    .select('file_url')
    .eq('id', documentId)
    .single();

  if (error) throw error;
  if (!data?.file_url) throw new Error('Document has no file URL');

  return analyzeDocument(documentId, data.file_url);
}
export interface VideoRoom {
  roomId?: string;
  roomUrl: string;
  roomName: string;
  token: string;
  expiresAt?: string;
  enableRecording?: boolean;
}

export interface CreateVideoRoomOptions {
  description?: string;
  enableRecording?: boolean;
  maxParticipants?: number;
  expiresInMinutes?: number;
}

export async function createVideoRoom(
  name: string,
  caseId: string,
  options?: CreateVideoRoomOptions
): Promise<VideoRoom> {
  const { data, error } = await (supabase as any).functions.invoke('create-video-room', {
    body: {
      name,
      caseId,
      expiresInMinutes: options?.expiresInMinutes ?? 120,
      description: options?.description,
      enableRecording: options?.enableRecording ?? true,
      maxParticipants: options?.maxParticipants ?? 10,
    },
  });

  if (error) throw error;
  return data;
}

export async function joinVideoRoom(roomId: string, userName?: string): Promise<VideoRoom> {
  const { data, error } = await (supabase as any).functions.invoke('join-video-room', {
    body: { roomId, userName },
  });

  if (error) throw error;
  return data;
}

// Legal Briefs API
export interface LegalBrief {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  type: string;
  status: string;
  content: string;
  court: string | null;
  filed_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBriefInput {
  case_id: string;
  title: string;
  type: string;
  status?: string;
  content?: string;
  court?: string;
  filed_date?: string;
  due_date?: string;
}

export async function getBriefsByCase(caseId: string): Promise<LegalBrief[]> {
  const { data, error } = await (supabase as any)
    .from("legal_briefs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as LegalBrief[]) || [];
}

export async function createBrief(input: CreateBriefInput): Promise<LegalBrief> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await (supabase as any)
    .from("legal_briefs")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as LegalBrief;
}

export async function updateBrief(id: string, updates: Partial<CreateBriefInput>): Promise<LegalBrief> {
  const { data, error } = await (supabase as any)
    .from("legal_briefs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as LegalBrief;
}

export async function deleteBrief(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("legal_briefs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ──────────────────────────────────────────────────
// Document Version History API
// ──────────────────────────────────────────────────

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  user_id: string;
  name: string;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  summary: string | null;
  key_facts: string[] | null;
  favorable_findings: string[] | null;
  adverse_findings: string[] | null;
  action_items: string[] | null;
  ocr_text: string | null;
  change_description: string | null;
  change_type: string;
  diff_summary: Record<string, unknown> | null;
  created_at: string;
}

export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  const { data, error } = await (supabase as any)
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data as unknown as DocumentVersion[]) || [];
}

export async function getDocumentVersion(versionId: string): Promise<DocumentVersion | null> {
  const { data, error } = await (supabase as any)
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as DocumentVersion | null;
}

export async function rollbackDocument(documentId: string, versionId: string): Promise<Document> {
  const version = await getDocumentVersion(versionId);
  if (!version) throw new Error("Version not found");

  const { data, error } = await (supabase as any)
    .from("documents")
    .update({
      name: version.name,
      file_url: version.file_url,
      summary: version.summary,
      key_facts: version.key_facts,
      favorable_findings: version.favorable_findings,
      adverse_findings: version.adverse_findings,
      action_items: version.action_items,
      ocr_text: version.ocr_text,
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Document;
}

// ──────────────────────────────────────────────────
// Team / Organization API
// ──────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "partner" | "associate" | "paralegal" | "viewer";
  joined_at: string;
}

export interface CaseMember {
  id: string;
  case_id: string;
  user_id: string;
  role: "owner" | "partner" | "associate" | "paralegal" | "viewer";
  added_by: string | null;
  added_at: string;
  email?: string;
  full_name?: string;
}

export async function getOrganization(): Promise<Organization | null> {
  const { data, error } = await (supabase as any)
    .from("organizations")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Organization | null;
}

export async function createOrganization(name: string, slug?: string): Promise<Organization> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await (supabase as any)
    .from("organizations")
    .insert({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "-"), owner_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // Add owner as member
  await (supabase as any).from("organization_members").insert({
    organization_id: data.id,
    user_id: user.id,
    role: "owner",
    invited_by: user.id,
  });

  return data as unknown as Organization;
}

export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  const { data, error } = await (supabase as any)
    .from("organization_members")
    .select("*")
    .eq("organization_id", orgId);

  if (error) throw error;
  return (data as unknown as OrganizationMember[]) || [];
}

export async function getCaseMembers(caseId: string): Promise<CaseMember[]> {
  const { data, error } = await (supabase as any)
    .from("case_members")
    .select("*")
    .eq("case_id", caseId);

  if (error) throw error;
  return (data as unknown as CaseMember[]) || [];
}

export async function addCaseMember(
  caseId: string,
  email: string,
  role: CaseMember["role"]
): Promise<CaseMember> {
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Look up user by email via edge function
  const { data, error } = await (supabase as any).functions.invoke("invite-member", {
    body: { caseId, email, role },
  });

  if (error) throw error;
  return data as unknown as CaseMember;
}

export async function removeCaseMember(memberId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("case_members")
    .delete()
    .eq("id", memberId);

  if (error) throw error;
}

export async function updateCaseMemberRole(
  memberId: string,
  role: CaseMember["role"]
): Promise<CaseMember> {
  const { data, error } = await (supabase as any)
    .from("case_members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CaseMember;
}

// ──────────────────────────────────────────────────
// Export API
// ──────────────────────────────────────────────────

export interface ExportJob {
  id: string;
  user_id: string;
  case_id: string;
  export_type: "pdf_brief" | "csv_billing" | "docx_filing" | "pdf_case_summary" | "csv_documents";
  status: "pending" | "processing" | "completed" | "failed";
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  options: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createExportJob(
  caseId: string,
  exportType: ExportJob["export_type"],
  options?: Record<string, unknown>
): Promise<ExportJob> {
  const { data, error } = await (supabase as any).functions.invoke("export-document", {
    body: { caseId, exportType, options: options || {} },
  });

  if (error) throw error;
  return data as unknown as ExportJob;
}

export async function getExportJobs(caseId: string): Promise<ExportJob[]> {
  const { data, error } = await (supabase as any)
    .from("export_jobs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as ExportJob[]) || [];
}

// ──────────────────────────────────────────────────
// Conflict Checking API
// ──────────────────────────────────────────────────

export interface ConflictResult {
  case_id: string;
  case_name: string;
  client_name: string;
  opposing_party: string | null;
  match_type: "client_match" | "adverse_match";
  match_field: string;
  similarity_score: number;
}

export interface ConflictCheck {
  id: string;
  user_id: string;
  search_terms: Record<string, unknown>;
  results: ConflictResult[];
  conflicts_found: number;
  status: "clear" | "conflict" | "potential" | "waived";
  resolution_notes: string | null;
  created_at: string;
}

export async function runConflictCheck(params: {
  clientName: string;
  opposingParty?: string;
  additionalParties?: string[];
}): Promise<{ conflicts: ConflictResult[]; totalChecked: number; checkId: string; status: string }> {
  const { data, error } = await (supabase as any).functions.invoke("conflict-check", {
    body: params,
  });

  if (error) throw error;
  return data;
}

export async function getConflictCheckHistory(): Promise<ConflictCheck[]> {
  const { data, error } = await (supabase as any)
    .from("conflict_checks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data as unknown as ConflictCheck[]) || [];
}

export async function resolveConflict(checkId: string, notes: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("conflict_checks")
    .update({ status: "waived", resolution_notes: notes })
    .eq("id", checkId);

  if (error) throw error;
}

// ──────────────────────────────────────────────────
// Judicial Intelligence API
// ──────────────────────────────────────────────────

export interface JudicialProfileResult {
  success: boolean;
  profile: Record<string, unknown>;
  cached: boolean;
}

export async function searchJudge(
  judgeName: string,
  court?: string,
  caseType?: string
): Promise<JudicialProfileResult> {
  const { data, error } = await supabase.functions.invoke("judicial-research", {
    body: { judgeName, court, caseType },
  });
  if (error) throw error;
  return data as JudicialProfileResult;
}

export async function getJudicialProfiles(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("judicial_profiles")
    .select("*")
    .order("last_updated", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ──────────────────────────────────────────────────
// Cross-Document Intelligence API
// ──────────────────────────────────────────────────

export async function runCrossDocumentAnalysis(caseId: string): Promise<{ success: boolean; analysis: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke("cross-document-analysis", {
    body: { caseId },
  });
  if (error) throw error;
  return data;
}

export async function getCrossDocumentAnalysis(caseId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("case_strategies")
    .select("key_factors, updated_at")
    .eq("case_id", caseId)
    .eq("analysis_type", "cross_document")
    .maybeSingle();
  if (error) throw error;
  return data ? (data.key_factors as Record<string, unknown>) : null;
}

// ──────────────────────────────────────────────────
// Argument Strength Analyzer API
// ──────────────────────────────────────────────────

export async function analyzeBriefArguments(
  briefId: string,
  caseId: string
): Promise<{ success: boolean; analysis: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke("argument-analyzer", {
    body: { briefId, caseId },
  });
  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────────────
// Witness Preparation API
// ──────────────────────────────────────────────────

export async function generateWitnessPrepPack(
  caseId: string,
  witnessName: string,
  witnessRole: string,
  additionalContext?: string
): Promise<{ success: boolean; prepPack: Record<string, unknown>; witnessDocumentCount: number }> {
  const { data, error } = await supabase.functions.invoke("witness-prep", {
    body: { caseId, witnessName, witnessRole, additionalContext },
  });
  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────────────
// Privilege Log API
// ──────────────────────────────────────────────────

export interface PrivilegeLogEntry {
  id?: string;
  case_id?: string;
  document_id?: string | null;
  bates_number?: string;
  date_of_document?: string;
  author?: string;
  recipients?: string[];
  description: string;
  privilege_type: string;
  work_product_type?: string | null;
  basis_for_privilege?: string;
  confidence_score?: number;
  flags_for_review?: string[];
  reviewed_by_attorney?: boolean;
  final_determination?: string;
}

export async function generatePrivilegeLog(
  caseId: string,
  documentIds?: string[]
): Promise<{ success: boolean; entries: PrivilegeLogEntry[]; totalDocumentsReviewed: number; privilegedCount: number }> {
  const { data, error } = await supabase.functions.invoke("privilege-log", {
    body: { caseId, documentIds },
  });
  if (error) throw error;
  return data;
}

export async function getPrivilegeLogEntries(caseId: string): Promise<PrivilegeLogEntry[]> {
  const { data, error } = await supabase
    .from("privilege_log_entries")
    .select("*")
    .eq("case_id", caseId)
    .order("bates_number", { ascending: true });
  if (error) throw error;
  return (data as unknown as PrivilegeLogEntry[]) || [];
}

export async function updatePrivilegeLogEntry(
  id: string,
  updates: Partial<PrivilegeLogEntry>
): Promise<void> {
  const { error } = await supabase
    .from("privilege_log_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
