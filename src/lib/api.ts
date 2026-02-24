import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Case[]) || [];
}

export async function getCase(id: string): Promise<Case | null> {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Case | null;
}

export async function createCase(input: CreateCaseInput): Promise<Case> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreateCaseInput & { user_id: string } = {
    ...input,
    user_id: user.id,
  };

  const { data, error } = await supabase
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

  const { data, error } = await supabase
    .from("cases")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Case;
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase
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
}

export interface BulkUploadResult {
  successful: number;
  failed: number;
  total: number;
  errors: string[];
  documents: Document[];
}

export async function getDocumentsByCase(caseId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Document[]) || [];
}

export async function getAllDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Document[]) || [];
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreateDocumentInput & { user_id: string } = {
    ...input,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from("documents")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Document;
}

export async function bulkUploadDocuments(input: BulkDocumentUploadInput): Promise<BulkUploadResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const results: BulkUploadResult = {
    successful: 0,
    failed: 0,
    total: input.files.length,
    errors: [],
    documents: [],
  };

  const { data: existingDocs } = await supabase
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

  const batchSize = 3;
  for (let i = 0; i < input.files.length; i += batchSize) {
    const batch = input.files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${input.case_id}/${Date.now()}-${i + index}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('case-documents')
        .getPublicUrl(uploadData.path);

      const batesNumber = input.generate_bates 
        ? `${batesPrefix}-${currentBatesNumber.toString().padStart(4, '0')}`
        : null;

      if (input.generate_bates) {
        currentBatesNumber++;
      }

      const documentInput: CreateDocumentInput = {
        case_id: input.case_id,
        name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        bates_number: batesNumber,
      };

      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          ...documentInput,
          user_id: user.id,
        })
        .select()
        .single();

      if (docError) {
        throw new Error(`Failed to create document record for ${file.name}: ${docError.message}`);
      }

      return docData as unknown as Document;
    });

    try {
      const batchResults = await Promise.allSettled(batchPromises);
      
      await Promise.all(batchResults.map(async (result, index) => {
        if (result.status === 'fulfilled') {
          results.successful++;
          results.documents.push(result.value);
          if (result.value.file_url) {
            try {
              await triggerDocumentAnalysis(result.value.id, result.value.file_url);
            } catch (analysisError) {
              console.error(`Failed to trigger analysis for document ${result.value.id}:`, analysisError);
              results.errors.push(`File ${batch[index].name}: Failed to trigger analysis - ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`);
            }
          }
        } else {
          results.failed++;
          results.errors.push(`File ${batch[index].name}: ${result.reason.message || 'Unknown error'}`);
        }
      }));
    } catch (error) {
      results.failed += batch.length;
      results.errors.push(`Batch upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Document;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function triggerDocumentAnalysis(documentId: string, fileUrl: string): Promise<void> {
  const { error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId, fileUrl },
  });

  if (error) throw error;
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
  linked_document_id: string | null;
  importance: string;
  created_at: string;
  updated_at: string;
}

export async function getTimelineEventsByCase(caseId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("case_id", caseId)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return (data as unknown as TimelineEvent[]) || [];
}

export async function getAllTimelineEvents(): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
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
  linked_document_id?: string;
  importance: "low" | "medium" | "high";
}

export async function createTimelineEvent(input: CreateTimelineEventInput): Promise<TimelineEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: CreateTimelineEventInput & { user_id: string } = {
    ...input,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from("timeline_events")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TimelineEvent;
}

export async function updateTimelineEvent(id: string, updates: Partial<TimelineEvent>): Promise<TimelineEvent> {
  const { data, error } = await supabase
    .from("timeline_events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TimelineEvent;
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  const { error } = await supabase
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
  const { data: docsData, error: docsError } = await supabase
    .from("documents")
    .select("id, ai_analyzed");

  if (docsError) throw docsError;

  // Get timeline events that are linked to documents
  const { data: timelineData, error: timelineError } = await supabase
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Profile | null;
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
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
  hasAnalysis: boolean;
  summary?: string;
  keyFacts?: string[];
  favorableFindings?: string[];
  adverseFindings?: string[];
  actionItems?: string[];
  tablesExtracted?: number;
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
  const { data, error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId, fileUrl, extractTables },
  });

  if (error) throw error;
  return data as AnalysisResult;
}

export async function extractDocumentTables(
  documentId: string,
  fileUrl: string
): Promise<TableExtractionResult> {
  const { data, error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId, fileUrl, extractTables: true },
  });

  if (error) throw error;
  
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
  const { data, error } = await supabase
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

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, file_url')
    .in('id', documentIds);

  if (error) throw error;

  const docMap = new Map((documents || []).map(d => [d.id, d.file_url]));
  let completed = 0;

  for (const docId of documentIds) {
    const fileUrl = docMap.get(docId);
    
    if (!fileUrl) {
      result.failed++;
      result.results.push({ documentId: docId, status: 'failed', error: 'File URL not found' });
      continue;
    }

    try {
      await analyzeDocument(docId, fileUrl);
      result.successful++;
      result.results.push({ documentId: docId, status: 'success' });
    } catch (err) {
      result.failed++;
      result.results.push({ 
        documentId: docId, 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    }

    completed++;
    onProgress?.(completed, documentIds.length);
  }

  return result;
}

export async function reanalyzeDocument(documentId: string): Promise<AnalysisResult> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase.functions.invoke('create-video-room', {
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
  const { data, error } = await supabase.functions.invoke('join-video-room', {
    body: { roomId, userName },
  });

  if (error) throw error;
  return data;
}
