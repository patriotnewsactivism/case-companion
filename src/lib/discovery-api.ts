import { supabase } from "@/integrations/supabase/client";
import { extractText, type ExtractionResult } from "./extraction-service";
import { chunkText, type TextChunk } from "./text-chunking";
import {
  cacheAnalysisResult,
  getCachedAnalysis,
  createContentHash,
} from "./cache";

export type DiscoveryType = 'interrogatory' | 'request_for_production' | 'request_for_admission' | 'deposition';
export type DiscoveryStatus = 'pending' | 'responded' | 'objected' | 'overdue' | 'draft';

interface DiscoveryRequestRow {
  id: string;
  case_id: string;
  user_id: string;
  request_type: DiscoveryType;
  request_number: string | null;
  question: string;
  response: string | null;
  objections: string[] | null;
  served_date: string | null;
  response_due_date: string | null;
  response_date: string | null;
  status: DiscoveryStatus;
  privilege_log_entry: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryRequest {
  id: string;
  case_id: string;
  user_id: string;
  requestType: DiscoveryType;
  requestNumber: string;
  question: string;
  response: string | null;
  objections: string[];
  servedDate: string | null;
  responseDueDate: string | null;
  responseDate: string | null;
  status: DiscoveryStatus;
  privilegeLogEntry: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryDeadline {
  id: string;
  requestType: string;
  requestNumber: string;
  servedDate: string;
  dueDate: string;
  daysRemaining: number;
  status: 'upcoming' | 'due_today' | 'overdue';
}

export interface CreateDiscoveryInput {
  case_id: string;
  requestType: DiscoveryType;
  requestNumber: string;
  question: string;
  servedDate?: string;
  responseDueDate?: string;
  notes?: string;
}

export interface UpdateDiscoveryInput extends Partial<CreateDiscoveryInput> {
  id: string;
  response?: string;
  objections?: string[];
  responseDate?: string | null;
  status?: DiscoveryStatus;
  privilegeLogEntry?: boolean;
}

function mapRowToDiscoveryRequest(row: DiscoveryRequestRow): DiscoveryRequest {
  return {
    id: row.id,
    case_id: row.case_id,
    user_id: row.user_id,
    requestType: row.request_type,
    requestNumber: row.request_number || '',
    question: row.question,
    response: row.response,
    objections: row.objections || [],
    servedDate: row.served_date,
    responseDueDate: row.response_due_date,
    responseDate: row.response_date,
    status: row.status,
    privilegeLogEntry: !!row.privilege_log_entry,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDiscoveryRequestUpdatesToRow(updates: Partial<DiscoveryRequest>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  if ('case_id' in updates) mapped.case_id = updates.case_id;
  if ('user_id' in updates) mapped.user_id = updates.user_id;
  if ('requestType' in updates) mapped.request_type = updates.requestType;
  if ('requestNumber' in updates) mapped.request_number = updates.requestNumber;
  if ('question' in updates) mapped.question = updates.question;
  if ('response' in updates) mapped.response = updates.response;
  if ('objections' in updates) mapped.objections = updates.objections;
  if ('servedDate' in updates) mapped.served_date = updates.servedDate;
  if ('responseDueDate' in updates) mapped.response_due_date = updates.responseDueDate;
  if ('responseDate' in updates) mapped.response_date = updates.responseDate;
  if ('status' in updates) mapped.status = updates.status;
  if ('privilegeLogEntry' in updates) mapped.privilege_log_entry = updates.privilegeLogEntry;
  if ('notes' in updates) mapped.notes = updates.notes;

  return mapped;
}

export async function createDiscoveryRequest(caseId: string, data: Partial<DiscoveryRequest>): Promise<DiscoveryRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    case_id: caseId,
    user_id: user.id,
    request_type: data.requestType || 'interrogatory',
    request_number: data.requestNumber || '',
    question: data.question || '',
    response: data.response || null,
    objections: data.objections || [],
    served_date: data.servedDate || null,
    response_due_date: data.responseDueDate || null,
    response_date: data.responseDate || null,
    status: data.status || 'pending',
    privilege_log_entry: data.privilegeLogEntry || false,
    notes: data.notes || null,
  };

  const { data: result, error } = await supabase
    .from("discovery_requests")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return mapRowToDiscoveryRequest(result as unknown as DiscoveryRequestRow);
}

export async function getDiscoveryRequests(caseId: string): Promise<DiscoveryRequest[]> {
  const { data, error } = await supabase
    .from("discovery_requests")
    .select("*")
    .eq("case_id", caseId)
    .order("response_due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return ((data as unknown as DiscoveryRequestRow[]) || []).map(mapRowToDiscoveryRequest);
}

export async function getDiscoveryRequest(id: string): Promise<DiscoveryRequest | null> {
  const { data, error } = await supabase
    .from("discovery_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRowToDiscoveryRequest(data as unknown as DiscoveryRequestRow) : null;
}

export async function updateDiscoveryRequest(id: string, updates: Partial<DiscoveryRequest>): Promise<DiscoveryRequest> {
  const mappedUpdates = mapDiscoveryRequestUpdatesToRow(updates);
  const { data, error } = await supabase
    .from("discovery_requests")
    .update(mappedUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapRowToDiscoveryRequest(data as unknown as DiscoveryRequestRow);
}

export async function deleteDiscoveryRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("discovery_requests")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getUpcomingDeadlines(caseId: string): Promise<DiscoveryDeadline[]> {
  const { data, error } = await supabase
    .from("discovery_requests")
    .select("id, request_type, request_number, served_date, response_due_date")
    .eq("case_id", caseId)
    .not("response_due_date", "is", null)
    .in("status", ["pending", "draft"]);

  if (error) throw error;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const deadlineRows = ((data as Array<{
    id: string;
    request_type: DiscoveryType;
    request_number: string | null;
    served_date: string | null;
    response_due_date: string;
  }> | null) || []);

  const deadlines: DiscoveryDeadline[] = deadlineRows.map((item) => {
    const dueDate = new Date(item.response_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'upcoming' | 'due_today' | 'overdue';
    if (diffDays < 0) {
      status = 'overdue';
    } else if (diffDays === 0) {
      status = 'due_today';
    } else {
      status = 'upcoming';
    }

    return {
      id: item.id,
      requestType: item.request_type,
      requestNumber: item.request_number || '',
      servedDate: item.served_date || '',
      dueDate: item.response_due_date,
      daysRemaining: diffDays,
      status,
    };
  });

  return deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export async function generateResponse(requestId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('discovery-response', {
    body: { requestId },
  });

  if (error) throw error;
  return data.response;
}

export async function bulkUpdateStatus(ids: string[], status: DiscoveryStatus): Promise<void> {
  const { error } = await supabase
    .from("discovery_requests")
    .update({ status })
    .in("id", ids);

  if (error) throw error;
}

export const OBJECTION_TYPES = [
  "Relevance",
  "Privilege - Attorney-Client",
  "Privilege - Work Product",
  "Overbroad",
  "Unduly Burdensome",
  "Vague and Ambiguous",
  "Calls for Legal Conclusion",
  "Compound Question",
  "Assumes Facts Not in Evidence",
  "Cumulative",
  "Harassment",
  "Confidential Information",
  "Trade Secret",
  "Privacy",
  "Protected Health Information (HIPAA)",
];

export const DISCOVERY_TYPE_LABELS: Record<DiscoveryType, string> = {
  interrogatory: "Interrogatory",
  request_for_production: "Request for Production",
  request_for_admission: "Request for Admission",
  deposition: "Deposition Notice",
};

export const DISCOVERY_STATUS_COLORS: Record<DiscoveryStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  responded: "bg-green-100 text-green-800 border-green-200",
  objected: "bg-red-100 text-red-800 border-red-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  draft: "bg-gray-100 text-gray-800 border-gray-200",
};

export interface DiscoveryDocumentExtraction {
  documentId: string;
  extractedText: string;
  chunks: TextChunk[];
  metadata: {
    fileType: string;
    wordCount: number;
    charCount: number;
    isScanned?: boolean;
  };
}

export async function extractDiscoveryDocument(
  file: File,
  documentId: string
): Promise<DiscoveryDocumentExtraction> {
  const cachedResult = getCachedAnalysis<DiscoveryDocumentExtraction>(documentId, 'extraction');
  if (cachedResult) {
    return cachedResult;
  }

  const result = await extractText(file, file.name);
  const contentHash = createContentHash(result.text);
  
  const chunks = chunkText(result.text, {
    maxChunkSize: 8000,
    minChunkSize: 500,
    overlapSize: 200,
    respectSentenceBoundaries: true,
  });

  const extraction: DiscoveryDocumentExtraction = {
    documentId,
    extractedText: result.text,
    chunks,
    metadata: {
      fileType: result.metadata.fileType,
      wordCount: result.metadata.wordCount,
      charCount: result.metadata.charCount,
      isScanned: result.metadata.isScanned,
    },
  };

  cacheAnalysisResult(documentId, 'extraction', extraction);

  return extraction;
}

export interface BatchExtractionProgress {
  total: number;
  completed: number;
  current: string;
  results: DiscoveryDocumentExtraction[];
}

export async function batchExtractDiscoveryDocuments(
  files: Array<{ file: File; documentId: string }>,
  onProgress?: (progress: BatchExtractionProgress) => void
): Promise<DiscoveryDocumentExtraction[]> {
  const results: DiscoveryDocumentExtraction[] = [];
  const progress: BatchExtractionProgress = {
    total: files.length,
    completed: 0,
    current: '',
    results,
  };

  for (const { file, documentId } of files) {
    progress.current = file.name;
    onProgress?.(progress);

    try {
      const extraction = await extractDiscoveryDocument(file, documentId);
      results.push(extraction);
    } catch (error) {
      console.error(`Failed to extract ${file.name}:`, error);
      results.push({
        documentId,
        extractedText: '',
        chunks: [],
        metadata: {
          fileType: 'unknown',
          wordCount: 0,
          charCount: 0,
        },
      });
    }

    progress.completed++;
    onProgress?.(progress);
  }

  return results;
}

export function getDiscoveryDocumentChunks(
  extractedText: string,
  options?: { maxChunkSize?: number; overlapSize?: number }
): TextChunk[] {
  return chunkText(extractedText, {
    maxChunkSize: options?.maxChunkSize ?? 8000,
    minChunkSize: 500,
    overlapSize: options?.overlapSize ?? 200,
    respectSentenceBoundaries: true,
  });
}

export function findRelevantDiscoveryChunks(
  chunks: TextChunk[],
  query: string,
  topK: number = 5
): TextChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const scored = chunks.map(chunk => {
    const content = chunk.content.toLowerCase();
    let score = 0;
    
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = content.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    return { chunk, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topK).map(s => s.chunk);
}
