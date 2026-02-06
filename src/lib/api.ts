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

  // Get existing documents to calculate next Bates number
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

  // Upload files in batches of 5 to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < input.files.length; i += batchSize) {
    const batch = input.files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file, index) => {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${input.case_id}/${Date.now()}-${i + index}.${fileExt}`;

        // Upload file to storage
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

        // Generate Bates number if requested
        const batesNumber = input.generate_bates 
          ? `${batesPrefix}-${currentBatesNumber.toString().padStart(4, '0')}`
          : null;

        if (input.generate_bates) {
          currentBatesNumber++;
        }

        // Create document record
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
      } catch (error) {
        throw error;
      }
    });

    try {
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.successful++;
          results.documents.push(result.value);
        } else {
          results.failed++;
          results.errors.push(`File ${batch[index].name}: ${result.reason.message || 'Unknown error'}`);
        }
      });
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

export async function triggerDocumentAnalysis(documentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId },
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
  const { data, error } = await supabase
    .from("documents")
    .select("id, ai_analyzed, linked_document_id");

  if (error) throw error;

  const docs = data || [];
  return {
    total: docs.length,
    analyzed: docs.filter((d) => d.ai_analyzed).length,
    pending: docs.filter((d) => !d.ai_analyzed).length,
    withTimeline: docs.filter((d) => d.linked_document_id).length,
  };
}

// Analytics API
export interface AnalyticsSummary {
  totalCases: number;
  activeCases: number;
  upcomingDeadlines: number;
  totalDocuments: number;
  analyzedDocuments: number;
  pendingAnalysis: number;
  recentActivity: {
    date: string;
    count: number;
  }[];
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get cases count by status
  const { data: casesData, error: casesError } = await supabase
    .from("cases")
    .select("status, created_at")
    .eq("user_id", user.id);

  if (casesError) throw casesError;

  // Get documents analytics
  const { data: docsData, error: docsError } = await supabase
    .from("documents")
    .select("ai_analyzed, created_at")
    .eq("user_id", user.id);

  if (docsError) throw docsError;

  // Get upcoming deadlines
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const { data: deadlinesData, error: deadlinesError } = await supabase
    .from("timeline_events")
    .select("event_date")
    .eq("user_id", user.id)
    .gte("event_date", today)
    .lte("event_date", nextWeek);

  if (deadlinesError) throw deadlinesError;

  // Calculate recent activity (last 7 days)
  const recentActivity: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayCases = casesData?.filter(c => 
      c.created_at.startsWith(dateStr)
    ).length || 0;
    
    const dayDocs = docsData?.filter(d => 
      d.created_at.startsWith(dateStr)
    ).length || 0;
    
    recentActivity.push({
      date: dateStr,
      count: dayCases + dayDocs,
    });
  }

  return {
    totalCases: casesData?.length || 0,
    activeCases: casesData?.filter(c => c.status === 'active').length || 0,
    upcomingDeadlines: deadlinesData?.length || 0,
    totalDocuments: docsData?.length || 0,
    analyzedDocuments: docsData?.filter(d => d.ai_analyzed).length || 0,
    pendingAnalysis: docsData?.filter(d => !d.ai_analyzed).length || 0,
    recentActivity,
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
  caseId?: string,
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

export async function joinVideoRoom(roomName: string, userName?: string): Promise<VideoRoom> {
  const { data, error } = await supabase.functions.invoke('join-video-room', {
    body: { roomName, userName },
  });

  if (error) throw error;
  return data;
}