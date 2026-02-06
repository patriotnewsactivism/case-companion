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

export async function getDocumentsByCase(caseId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Document[]) || [];
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

// Documents API - Get all documents for current user
export async function getAllDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Document[]) || [];
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
  avatar_url: string | null;
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

  const payload: Partial<Profile> = updates;

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
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
