import { supabase } from "@/integrations/supabase/client";

export interface EconomicDamages {
  medicalExpenses: number;
  medicalExpensesFuture: number;
  lostWages: number;
  lostWagesFuture: number;
  propertyDamage: number;
  otherEconomic: number;
}

export interface NonEconomicDamages {
  painSuffering: number;
  emotionalDistress: number;
  lossOfConsortium: number;
  lossOfEnjoyment: number;
  disfigurement: number;
}

export interface SettlementFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface SettlementAnalysis {
  id: string;
  case_id: string;
  user_id: string;
  economicDamages: EconomicDamages;
  nonEconomicDamages: NonEconomicDamages;
  punitiveMultiplier: number;
  comparativeNegligence: number;
  settlementRangeLow: number;
  settlementRangeHigh: number;
  recommendedDemand: number;
  factors: SettlementFactor[];
  negotiationStrategy: string;
  created_at: string;
}

export interface CreateSettlementInput {
  case_id: string;
  economicDamages: EconomicDamages;
  nonEconomicDamages: NonEconomicDamages;
  punitiveMultiplier?: number;
  comparativeNegligence?: number;
  factors?: SettlementFactor[];
  negotiationStrategy?: string;
}

export const defaultEconomicDamages: EconomicDamages = {
  medicalExpenses: 0,
  medicalExpensesFuture: 0,
  lostWages: 0,
  lostWagesFuture: 0,
  propertyDamage: 0,
  otherEconomic: 0,
};

export const defaultNonEconomicDamages: NonEconomicDamages = {
  painSuffering: 0,
  emotionalDistress: 0,
  lossOfConsortium: 0,
  lossOfEnjoyment: 0,
  disfigurement: 0,
};

export async function createSettlementAnalysis(caseId: string): Promise<SettlementAnalysis> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    case_id: caseId,
    user_id: user.id,
    economic_damages: defaultEconomicDamages,
    non_economic_damages: defaultNonEconomicDamages,
    punitive_multiplier: 0,
    comparative_negligence: 0,
    settlement_range_low: 0,
    settlement_range_high: 0,
    recommended_demand: 0,
    factors: [],
    negotiation_strategy: '',
  };

  const { data, error } = await supabase
    .from("settlement_analyses")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return mapDbToSettlementAnalysis(data);
}

export async function getSettlementAnalysis(id: string): Promise<SettlementAnalysis | null> {
  const { data, error } = await supabase
    .from("settlement_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDbToSettlementAnalysis(data) : null;
}

export async function getSettlementAnalyses(caseId: string): Promise<SettlementAnalysis[]> {
  const { data, error } = await supabase
    .from("settlement_analyses")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToSettlementAnalysis);
}

export async function updateSettlementAnalysis(id: string, updates: Partial<SettlementAnalysis>): Promise<SettlementAnalysis> {
  const dbUpdates: Record<string, unknown> = {};
  
  if (updates.economicDamages) dbUpdates.economic_damages = updates.economicDamages;
  if (updates.nonEconomicDamages) dbUpdates.non_economic_damages = updates.nonEconomicDamages;
  if (updates.punitiveMultiplier !== undefined) dbUpdates.punitive_multiplier = updates.punitiveMultiplier;
  if (updates.comparativeNegligence !== undefined) dbUpdates.comparative_negligence = updates.comparativeNegligence;
  if (updates.settlementRangeLow !== undefined) dbUpdates.settlement_range_low = updates.settlementRangeLow;
  if (updates.settlementRangeHigh !== undefined) dbUpdates.settlement_range_high = updates.settlementRangeHigh;
  if (updates.recommendedDemand !== undefined) dbUpdates.recommended_demand = updates.recommendedDemand;
  if (updates.factors) dbUpdates.factors = updates.factors;
  if (updates.negotiationStrategy) dbUpdates.negotiation_strategy = updates.negotiationStrategy;

  const { data, error } = await supabase
    .from("settlement_analyses")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapDbToSettlementAnalysis(data);
}

export async function deleteSettlementAnalysis(id: string): Promise<void> {
  const { error } = await supabase
    .from("settlement_analyses")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export function calculateSettlement(data: Partial<SettlementAnalysis>): { range: [number, number]; recommended: number } {
  const economicDamages = data.economicDamages || defaultEconomicDamages;
  const nonEconomicDamages = data.nonEconomicDamages || defaultNonEconomicDamages;
  const comparativeNegligence = data.comparativeNegligence || 0;
  const punitiveMultiplier = data.punitiveMultiplier || 0;

  const totalEconomic = 
    economicDamages.medicalExpenses +
    economicDamages.medicalExpensesFuture +
    economicDamages.lostWages +
    economicDamages.lostWagesFuture +
    economicDamages.propertyDamage +
    economicDamages.otherEconomic;

  const totalNonEconomic =
    nonEconomicDamages.painSuffering +
    nonEconomicDamages.emotionalDistress +
    nonEconomicDamages.lossOfConsortium +
    nonEconomicDamages.lossOfEnjoyment +
    nonEconomicDamages.disfigurement;

  const punitive = totalEconomic * punitiveMultiplier;
  const grossTotal = totalEconomic + totalNonEconomic + punitive;
  
  const negligenceAdjustment = grossTotal * (comparativeNegligence / 100);
  const netTotal = Math.max(0, grossTotal - negligenceAdjustment);

  const factors = data.factors || [];
  const factorMultiplier = factors.reduce((acc, f) => {
    const impactValue = f.impact === 'positive' ? 0.05 : f.impact === 'negative' ? -0.05 : 0;
    return acc + (impactValue * (f.weight / 100));
  }, 1);

  const low = Math.round(netTotal * 0.75 * factorMultiplier);
  const high = Math.round(netTotal * 1.25 * factorMultiplier);
  const recommended = Math.round((low + high) / 2);

  return { range: [low, high], recommended };
}

export async function runAIAnalysis(caseId: string, analysisId: string): Promise<SettlementAnalysis> {
  const { data, error } = await supabase.functions.invoke('settlement-analysis', {
    body: { caseId, analysisId },
  });

  if (error) throw error;
  return mapDbToSettlementAnalysis(data);
}

function mapDbToSettlementAnalysis(data: Record<string, unknown>): SettlementAnalysis {
  return {
    id: data.id as string,
    case_id: data.case_id as string,
    user_id: data.user_id as string,
    economicDamages: (data.economic_damages as EconomicDamages) || defaultEconomicDamages,
    nonEconomicDamages: (data.non_economic_damages as NonEconomicDamages) || defaultNonEconomicDamages,
    punitiveMultiplier: (data.punitive_multiplier as number) || 0,
    comparativeNegligence: (data.comparative_negligence as number) || 0,
    settlementRangeLow: (data.settlement_range_low as number) || 0,
    settlementRangeHigh: (data.settlement_range_high as number) || 0,
    recommendedDemand: (data.recommended_demand as number) || 0,
    factors: (data.factors as SettlementFactor[]) || [],
    negotiationStrategy: (data.negotiation_strategy as string) || '',
    created_at: data.created_at as string,
  };
}
