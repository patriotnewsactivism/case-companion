import { supabase } from "@/integrations/supabase/client";

export interface AdmissibilityIssue {
  type: string;
  severity: 'fatal' | 'serious' | 'minor';
  rule: string;
  explanation: string;
  potentialCure: string;
}

export interface CaseLawCitation {
  caseName: string;
  citation: string;
  court: string;
  date: string;
  holding: string;
  favorableTo: 'plaintiff' | 'defendant' | 'neutral';
}

export interface EvidenceAnalysis {
  id: string;
  case_id: string;
  document_id: string | null;
  user_id: string;
  evidenceDescription: string;
  overallAdmissibility: 'admissible' | 'conditional' | 'inadmissible';
  confidenceScore: number;
  issues: AdmissibilityIssue[];
  suggestedFoundations: string[];
  caseLawSupport: CaseLawCitation[];
  motionDraft: string | null;
  created_at: string;
}

export interface AnalyzeEvidenceInput {
  caseId: string;
  description: string;
  documentId?: string;
}

export async function analyzeEvidence(
  caseId: string,
  description: string,
  documentId?: string
): Promise<EvidenceAnalysis> {
  const { data, error } = await supabase.functions.invoke('evidence-analysis', {
    body: {
      action: 'analyze',
      caseId,
      description,
      documentId,
    },
  });

  if (error) throw error;
  return data.analysis;
}

export async function getEvidenceAnalyses(caseId: string): Promise<EvidenceAnalysis[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('evidence_analyses')
    .select('*')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as EvidenceAnalysis[]) || [];
}

export async function getEvidenceAnalysis(id: string): Promise<EvidenceAnalysis | null> {
  const { data, error } = await supabase
    .from('evidence_analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as EvidenceAnalysis | null;
}

export async function deleteEvidenceAnalysis(id: string): Promise<void> {
  const { error } = await supabase
    .from('evidence_analyses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function generateMotionDraft(analysisId: string, templateType: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('evidence-analysis', {
    body: {
      action: 'generateMotion',
      analysisId,
      templateType,
    },
  });

  if (error) throw error;
  return data.motionDraft;
}
