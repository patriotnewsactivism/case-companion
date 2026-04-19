import { supabase } from "@/integrations/supabase/client";

export interface TrialSession {
  id: string;
  case_id: string;
  user_id: string;
  phase: string;
  mode: string;
  duration_seconds: number;
  transcript: TranscriptEntry[];
  audio_url: string | null;
  score: number;
  metrics: SessionMetrics;
  feedback: string | null;
  created_at: string;
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  aiRole?: string;
}

export interface SessionMetrics {
  objectionsReceived: number;
  objectionsSustained: number;
  objectionsOverruled: number;
  fallaciesCommitted: string[];
  rhetoricalScore: number;
  wordCount: number;
  fillerWords: { word: string; count: number }[];
  wordsPerMinute: number;
  pauseCount: number;
  overallScore: number;
}

export interface CreateSessionInput {
  case_id: string;
  phase: string;
  mode: string;
}

export interface SaveSessionInput {
  id: string;
  duration_seconds: number;
  transcript: TranscriptEntry[];
  audio_blob?: Blob;
  metrics: SessionMetrics;
  feedback?: string;
}

export async function createSession(input: CreateSessionInput): Promise<TrialSession> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("trial_sessions")
    .insert({
      case_id: input.case_id,
      user_id: user.id,
      phase: input.phase,
      mode: input.mode,
      duration_seconds: 0,
      transcript: [],
      audio_url: null,
      score: 0,
      metrics: {
        objectionsReceived: 0,
        objectionsSustained: 0,
        objectionsOverruled: 0,
        fallaciesCommitted: [],
        rhetoricalScore: 0,
        wordCount: 0,
        fillerWords: [],
        wordsPerMinute: 0,
        pauseCount: 0,
        overallScore: 0,
      },
      feedback: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrialSession;
}

export async function getSessions(caseId?: string): Promise<TrialSession[]> {
  let query = supabase
    .from("trial_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (caseId) {
    query = query.eq("case_id", caseId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as unknown as TrialSession[]) || [];
}

export async function getSession(id: string): Promise<TrialSession | null> {
  const { data, error } = await supabase
    .from("trial_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as TrialSession | null;
}

export async function saveSession(input: SaveSessionInput): Promise<TrialSession> {
  let audioUrl: string | null = null;

  if (input.audio_blob) {
    const fileExt = input.audio_blob.type.split('/')[1] || 'webm';
    const fileName = `sessions/${input.id}/recording.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('session-recordings')
      .upload(fileName, input.audio_blob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload audio:', uploadError);
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from('session-recordings')
        .getPublicUrl(fileName);
      audioUrl = publicUrl;
    }
  }

  const { data, error } = await supabase
    .from("trial_sessions")
    .update({
      duration_seconds: input.duration_seconds,
      transcript: input.transcript,
      audio_url: audioUrl,
      metrics: input.metrics,
      feedback: input.feedback || null,
      score: input.metrics.overallScore,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrialSession;
}

export async function deleteSession(id: string): Promise<void> {
  const { data: session } = await supabase
    .from("trial_sessions")
    .select("audio_url")
    .eq("id", id)
    .single();

  if (session?.audio_url) {
    const url = new URL(session.audio_url as string);
    const pathParts = url.pathname.split('/storage/v1/object/public/session-recordings/');
    if (pathParts.length > 1) {
      const filePath = pathParts[1];
      await supabase.storage
        .from('session-recordings')
        .remove([`sessions/${id}/recording.webm`]);
    }
  }

  const { error } = await supabase
    .from("trial_sessions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getSessionStats(): Promise<{ total: number; avgScore: number; totalDuration: number }> {
  const { data, error } = await supabase
    .from("trial_sessions")
    .select("score, duration_seconds");

  if (error) throw error;

  const sessions = data || [];
  const total = sessions.length;
  const avgScore = total > 0
    ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / total
    : 0;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  return { total, avgScore, totalDuration };
}
