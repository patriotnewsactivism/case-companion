import { supabase } from "@/integrations/supabase/client";

export interface TrialSimulationSession {
  id: string;
  case_id: string | null;
  user_id: string;
  mode: string;
  scenario: string | null;
  started_at: string;
  ended_at: string | null;
  transcript: TranscriptMessage[];
  exhibits_shown: ExhibitShown[];
  objections_made: ObjectionRecord[];
  performance_metrics: PerformanceMetrics | null;
  ai_coaching: string[];
  witness_profile: WitnessProfile | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  aiRole?: string;
}

export interface ExhibitShown {
  documentId: string;
  documentName: string;
  shownAt: string;
  admitted: boolean;
}

export interface ObjectionRecord {
  type: string;
  timestamp: string;
  sustained: boolean | null;
  context: string;
}

export interface PerformanceMetrics {
  totalQuestions: number;
  successfulObjections: number;
  missedObjections: number;
  leadingQuestionsUsed: number;
  openQuestionsUsed: number;
  avgResponseTimeMs: number | null;
  credibilityScore: number | null;
}

export interface WitnessProfile {
  id: string;
  name: string;
  type: 'fact' | 'expert' | 'character' | 'hostile';
  personality: 'cooperative' | 'guarded' | 'hostile' | 'evasive';
  knowledgeLevel: 'intimate' | 'peripheral' | 'expert';
  biases: string[];
  keyTestimony: string[];
  credibilityScore: number;
  linkedDocuments: string[];
}

export interface TrialSessionAnalytics {
  id: string;
  user_id: string;
  session_id: string;
  total_questions: number;
  successful_objections: number;
  missed_objections: number;
  leading_questions_used: number;
  open_questions_used: number;
  avg_response_time_ms: number | null;
  credibility_score: number | null;
  improvement_areas: string[];
  strengths: string[];
  created_at: string;
}

export interface CreateSessionInput {
  case_id?: string;
  mode: string;
  scenario?: string;
  witness_profile?: WitnessProfile;
}

export interface UpdateSessionInput {
  ended_at?: string;
  transcript?: TranscriptMessage[];
  exhibits_shown?: ExhibitShown[];
  objections_made?: ObjectionRecord[];
  performance_metrics?: PerformanceMetrics;
  ai_coaching?: string[];
}

export interface SessionWithAnalytics extends TrialSimulationSession {
  analytics?: TrialSessionAnalytics;
}

export async function createTrialSession(input: CreateSessionInput): Promise<TrialSimulationSession> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('trial_simulation_sessions')
    .insert({
      user_id: user.id,
      case_id: input.case_id || null,
      mode: input.mode,
      scenario: input.scenario || null,
      witness_profile: input.witness_profile || null,
      transcript: [],
      exhibits_shown: [],
      objections_made: [],
      ai_coaching: [],
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrialSimulationSession;
}

export async function updateTrialSession(sessionId: string, updates: UpdateSessionInput): Promise<TrialSimulationSession> {
  const { data, error } = await supabase
    .from('trial_simulation_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrialSimulationSession;
}

export async function endTrialSession(sessionId: string, metrics: PerformanceMetrics): Promise<TrialSimulationSession> {
  const { data, error } = await supabase
    .from('trial_simulation_sessions')
    .update({
      ended_at: new Date().toISOString(),
      performance_metrics: metrics,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  
  await createSessionAnalytics(sessionId, metrics);
  
  return data as unknown as TrialSimulationSession;
}

export async function getTrialSessions(caseId?: string): Promise<TrialSimulationSession[]> {
  let query = supabase
    .from('trial_simulation_sessions')
    .select('*')
    .order('started_at', { ascending: false });

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as unknown as TrialSimulationSession[]) || [];
}

export async function getTrialSessionById(sessionId: string): Promise<TrialSimulationSession | null> {
  const { data, error } = await supabase
    .from('trial_simulation_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as TrialSimulationSession | null;
}

export async function getSessionWithAnalytics(sessionId: string): Promise<SessionWithAnalytics | null> {
  const { data: session, error: sessionError } = await supabase
    .from('trial_simulation_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data: analytics, error: analyticsError } = await supabase
    .from('trial_session_analytics')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (analyticsError) throw analyticsError;

  return {
    ...(session as unknown as TrialSimulationSession),
    analytics: analytics as unknown as TrialSessionAnalytics | undefined,
  };
}

export async function deleteTrialSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('trial_simulation_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}

export async function createSessionAnalytics(sessionId: string, metrics: PerformanceMetrics): Promise<TrialSessionAnalytics> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const improvementAreas: string[] = [];
  const strengths: string[] = [];

  if (metrics.leadingQuestionsUsed > metrics.openQuestionsUsed * 2) {
    improvementAreas.push("Balance leading and open-ended questions");
  }
  if (metrics.openQuestionsUsed > metrics.leadingQuestionsUsed * 2) {
    strengths.push("Effective use of open-ended questions");
  }
  if (metrics.credibilityScore && metrics.credibilityScore >= 7) {
    strengths.push("Strong witness credibility management");
  }
  if (metrics.credibilityScore && metrics.credibilityScore < 5) {
    improvementAreas.push("Work on building witness rapport and credibility");
  }
  if (metrics.successfulObjections > 0) {
    strengths.push("Successful objection handling");
  }
  if (metrics.missedObjections > metrics.successfulObjections) {
    improvementAreas.push("Improve objection timing and recognition");
  }

  const { data, error } = await supabase
    .from('trial_session_analytics')
    .insert({
      user_id: user.id,
      session_id: sessionId,
      total_questions: metrics.totalQuestions,
      successful_objections: metrics.successfulObjections,
      missed_objections: metrics.missedObjections,
      leading_questions_used: metrics.leadingQuestionsUsed,
      open_questions_used: metrics.openQuestionsUsed,
      avg_response_time_ms: metrics.avgResponseTimeMs,
      credibility_score: metrics.credibilityScore,
      improvement_areas: improvementAreas,
      strengths: strengths,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TrialSessionAnalytics;
}

export async function getUserAnalytics(userId?: string): Promise<{
  totalSessions: number;
  totalQuestions: number;
  avgCredibilityScore: number;
  topStrengths: string[];
  topImprovementAreas: string[];
  recentSessions: TrialSessionAnalytics[];
}> {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;
  if (!targetUserId) throw new Error("No user ID provided");

  const { data: analytics, error } = await supabase
    .from('trial_session_analytics')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const records = analytics as unknown as TrialSessionAnalytics[];
  
  const totalSessions = records.length;
  const totalQuestions = records.reduce((sum, r) => sum + r.total_questions, 0);
  
  const scoresWithValues = records.filter(r => r.credibility_score !== null);
  const avgCredibilityScore = scoresWithValues.length > 0
    ? scoresWithValues.reduce((sum, r) => sum + (r.credibility_score || 0), 0) / scoresWithValues.length
    : 0;

  const allStrengths = records.flatMap(r => r.strengths || []);
  const allImprovements = records.flatMap(r => r.improvement_areas || []);
  
  const strengthCounts = new Map<string, number>();
  allStrengths.forEach(s => strengthCounts.set(s, (strengthCounts.get(s) || 0) + 1));
  const topStrengths = [...strengthCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  const improvementCounts = new Map<string, number>();
  allImprovements.forEach(i => improvementCounts.set(i, (improvementCounts.get(i) || 0) + 1));
  const topImprovementAreas = [...improvementCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([i]) => i);

  return {
    totalSessions,
    totalQuestions,
    avgCredibilityScore,
    topStrengths,
    topImprovementAreas,
    recentSessions: records.slice(0, 10),
  };
}

export async function addTranscriptMessage(
  sessionId: string,
  message: Omit<TranscriptMessage, 'id'>
): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from('trial_simulation_sessions')
    .select('transcript')
    .eq('id', sessionId)
    .single();

  if (fetchError) throw fetchError;

  const transcript = (session?.transcript as TranscriptMessage[]) || [];
  const newMessage: TranscriptMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  const { error: updateError } = await supabase
    .from('trial_simulation_sessions')
    .update({ transcript: [...transcript, newMessage] })
    .eq('id', sessionId);

  if (updateError) throw updateError;
}

export async function addObjectionRecord(
  sessionId: string,
  objection: Omit<ObjectionRecord, 'timestamp'>
): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from('trial_simulation_sessions')
    .select('objections_made')
    .eq('id', sessionId)
    .single();

  if (fetchError) throw fetchError;

  const objections = (session?.objections_made as ObjectionRecord[]) || [];
  const newObjection: ObjectionRecord = {
    ...objection,
    timestamp: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('trial_simulation_sessions')
    .update({ objections_made: [...objections, newObjection] })
    .eq('id', sessionId);

  if (updateError) throw updateError;
}

export async function addExhibitShown(
  sessionId: string,
  exhibit: Omit<ExhibitShown, 'shownAt'>
): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from('trial_simulation_sessions')
    .select('exhibits_shown')
    .eq('id', sessionId)
    .single();

  if (fetchError) throw fetchError;

  const exhibits = (session?.exhibits_shown as ExhibitShown[]) || [];
  const newExhibit: ExhibitShown = {
    ...exhibit,
    shownAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('trial_simulation_sessions')
    .update({ exhibits_shown: [...exhibits, newExhibit] })
    .eq('id', sessionId);

  if (updateError) throw updateError;
}

export async function addCoachingTip(sessionId: string, tip: string): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from('trial_simulation_sessions')
    .select('ai_coaching')
    .eq('id', sessionId)
    .single();

  if (fetchError) throw fetchError;

  const coaching = (session?.ai_coaching as string[]) || [];

  const { error: updateError } = await supabase
    .from('trial_simulation_sessions')
    .update({ ai_coaching: [...coaching, tip] })
    .eq('id', sessionId);

  if (updateError) throw updateError;
}

export function generateWitnessProfile(
  name: string,
  type: WitnessProfile['type'],
  documents: Array<{ name: string; summary?: string; adverse_findings?: string[] }>
): WitnessProfile {
  const personalityMap: Record<WitnessProfile['type'], WitnessProfile['personality']> = {
    fact: 'cooperative',
    expert: 'cooperative',
    character: 'guarded',
    hostile: 'hostile',
  };

  const knowledgeMap: Record<WitnessProfile['type'], WitnessProfile['knowledgeLevel']> = {
    fact: 'intimate',
    expert: 'expert',
    character: 'peripheral',
    hostile: 'intimate',
  };

  const biases: string[] = [];
  const keyTestimony: string[] = [];
  const linkedDocuments: string[] = [];

  documents.forEach(doc => {
    linkedDocuments.push(doc.name);
    if (doc.adverse_findings && doc.adverse_findings.length > 0) {
      biases.push(...doc.adverse_findings.slice(0, 2));
    }
    if (doc.summary) {
      keyTestimony.push(doc.summary.substring(0, 200));
    }
  });

  return {
    id: `witness-${Date.now()}`,
    name,
    type,
    personality: personalityMap[type],
    knowledgeLevel: knowledgeMap[type],
    biases: [...new Set(biases)].slice(0, 5),
    keyTestimony: keyTestimony.slice(0, 5),
    credibilityScore: type === 'hostile' ? 4 : type === 'expert' ? 8 : 6,
    linkedDocuments: [...new Set(linkedDocuments)].slice(0, 10),
  };
}
