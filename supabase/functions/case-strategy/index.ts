import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from "../_shared/errorHandler.ts";
import { verifyAuth, forbiddenResponse } from "../_shared/auth.ts";
import { validateUUID, sanitizeString, validateEnum } from "../_shared/validation.ts";

type Action = "analyze" | "swot" | "predict" | "settlement" | "timeline" | "recommendations";
type AnalysisType = "swot" | "outcome_prediction" | "timeline" | "settlement";
type Priority = "high" | "medium" | "low";
type ImpactType = "positive" | "negative" | "neutral";

interface CaseStrategyRequest {
  action: Action;
  caseId: string;
  analysisType?: AnalysisType;
  options?: {
    includeDocuments?: boolean;
    includeTimeline?: boolean;
    includeDiscovery?: boolean;
    focusAreas?: string[];
  };
}

interface RecommendedAction {
  action: string;
  priority: Priority;
  deadline?: string;
  impact: string;
}

interface SettlementRange {
  min: number;
  max: number;
  recommended: number;
  currency: string;
}

interface KeyFactor {
  factor: string;
  impact: ImpactType;
  weight: number;
}

interface RiskAssessment {
  risk: string;
  probability: number;
  impact: number;
  mitigation: string;
}

interface CaseStrategyResponse {
  id: string;
  analysisType: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  winProbability: number;
  predictedOutcome: string;
  recommendedActions: RecommendedAction[];
  settlementRange: SettlementRange;
  keyFactors: KeyFactor[];
  riskAssessment: RiskAssessment[];
  generatedAt: string;
}

interface StoredStrategy {
  id: string;
  case_id: string;
  user_id: string;
  analysis_type: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  win_probability: number;
  predicted_outcome: string;
  recommended_actions: RecommendedAction[];
  settlement_range: SettlementRange;
  key_factors: KeyFactor[];
  risk_assessment: RiskAssessment[];
  created_at: string;
}

interface CaseData {
  id: string;
  user_id: string;
  name: string;
  case_type: string;
  client_name: string;
  jurisdiction?: string;
  case_theory?: string;
  key_issues?: string[];
  notes?: string;
  representation?: string;
  status?: string;
}

interface DocumentData {
  id: string;
  name: string;
  document_type?: string;
  summary?: string;
  key_facts?: string[];
  favorable_findings?: string[];
  adverse_findings?: string[];
}

interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_type?: string;
}

interface DiscoveryRequest {
  id: string;
  request_type: string;
  status: string;
  requests?: unknown;
  responses?: unknown;
}

interface MockJurySession {
  id: string;
  verdict?: {
    verdict: string;
    confidence: number;
    voteTally: { guilty: number; notGuilty: number };
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
  };
}

interface EvidenceAnalysis {
  id: string;
  overall_admissibility: string;
  confidence_score: number;
  issues: Array<{
    rule: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
}

const ACTIONS: Action[] = ["analyze", "swot", "predict", "settlement", "timeline", "recommendations"];
const ANALYSIS_TYPES: AnalysisType[] = ["swot", "outcome_prediction", "timeline", "settlement"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];
const IMPACT_TYPES: ImpactType[] = ["positive", "negative", "neutral"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const generateId = () => crypto.randomUUID();

const parseJsonObject = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
};

const clampProbability = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
};

const clampScore = (value: unknown, min = 0, max = 100): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, Math.round(num)));
};

const gatherCaseContext = async (
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  caseId: string,
  options: CaseStrategyRequest["options"]
): Promise<{
  caseData: CaseData | null;
  documents: DocumentData[];
  timelineEvents: TimelineEvent[];
  discoveryRequests: DiscoveryRequest[];
  mockJurySessions: MockJurySession[];
  evidenceAnalyses: EvidenceAnalysis[];
}> => {
  const { data: caseData } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .single();

  let documents: DocumentData[] = [];
  let timelineEvents: TimelineEvent[] = [];
  let discoveryRequests: DiscoveryRequest[] = [];
  let mockJurySessions: MockJurySession[] = [];
  let evidenceAnalyses: EvidenceAnalysis[] = [];

  if (options?.includeDocuments !== false) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name, document_type, summary, key_facts, favorable_findings, adverse_findings")
      .eq("case_id", caseId)
      .eq("ai_analyzed", true)
      .limit(15);
    documents = (docs as DocumentData[]) || [];
  }

  if (options?.includeTimeline !== false) {
    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, title, description, event_date, event_type")
      .eq("case_id", caseId)
      .order("event_date", { ascending: true })
      .limit(20);
    timelineEvents = (events as TimelineEvent[]) || [];
  }

  if (options?.includeDiscovery !== false) {
    const { data: discovery } = await supabase
      .from("discovery_requests")
      .select("id, request_type, status, requests, responses")
      .eq("case_id", caseId)
      .limit(10);
    discoveryRequests = (discovery as DiscoveryRequest[]) || [];
  }

  const { data: jurySessions } = await supabase
    .from("mock_jury_sessions")
    .select("id, verdict")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(3);
  mockJurySessions = (jurySessions as MockJurySession[]) || [];

  const { data: analyses } = await supabase
    .from("evidence_analyses")
    .select("id, overall_admissibility, confidence_score, issues")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(10);
  evidenceAnalyses = (analyses as EvidenceAnalysis[]) || [];

  return {
    caseData: caseData as CaseData | null,
    documents,
    timelineEvents,
    discoveryRequests,
    mockJurySessions,
    evidenceAnalyses,
  };
};

const buildContextString = (context: {
  caseData: CaseData | null;
  documents: DocumentData[];
  timelineEvents: TimelineEvent[];
  discoveryRequests: DiscoveryRequest[];
  mockJurySessions: MockJurySession[];
  evidenceAnalyses: EvidenceAnalysis[];
}): string => {
  const parts: string[] = [];

  if (context.caseData) {
    parts.push(`CASE INFORMATION:
- Case Name: ${context.caseData.name}
- Case Type: ${context.caseData.case_type}
- Client: ${context.caseData.client_name}
- Jurisdiction: ${context.caseData.jurisdiction || "Not specified"}
- Representation: ${context.caseData.representation || "Not specified"}
- Status: ${context.caseData.status || "Active"}
- Case Theory: ${context.caseData.case_theory || "Not specified"}
- Key Issues: ${context.caseData.key_issues?.join("; ") || "Not specified"}
${context.caseData.notes ? `- Notes: ${context.caseData.notes.slice(0, 1000)}` : ""}`);
  }

  if (context.documents.length > 0) {
    parts.push(`\nKEY DOCUMENTS (${context.documents.length} analyzed):
${context.documents.slice(0, 8).map((d, i) => `${i + 1}. ${d.name}
   Type: ${d.document_type || "Unknown"}
   Summary: ${d.summary?.slice(0, 200) || "N/A"}
   Key Facts: ${d.key_facts?.slice(0, 3).join("; ") || "N/A"}
   Favorable: ${d.favorable_findings?.slice(0, 2).join("; ") || "N/A"}
   Adverse: ${d.adverse_findings?.slice(0, 2).join("; ") || "N/A"}`).join("\n")}`);
  }

  if (context.timelineEvents.length > 0) {
    parts.push(`\nTIMELINE EVENTS (${context.timelineEvents.length} events):
${context.timelineEvents.slice(0, 10).map((e) => `- ${e.event_date}: ${e.title}${e.description ? ` - ${e.description.slice(0, 100)}` : ""}`).join("\n")}`);
  }

  if (context.discoveryRequests.length > 0) {
    parts.push(`\nDISCOVERY STATUS (${context.discoveryRequests.length} requests):
${context.discoveryRequests.slice(0, 5).map((d) => `- ${d.request_type}: ${d.status}`).join("\n")}`);
  }

  if (context.mockJurySessions.length > 0 && context.mockJurySessions[0].verdict) {
    const verdict = context.mockJurySessions[0].verdict;
    parts.push(`\nMOCK JURY RESULTS:
- Verdict: ${verdict.verdict} (Confidence: ${verdict.confidence}%)
- Vote Tally: ${verdict.voteTally.guilty} guilty, ${verdict.voteTally.notGuilty} not guilty
- Reasoning: ${verdict.reasoning}
- Case Strengths: ${verdict.strengths?.join("; ") || "N/A"}
- Case Weaknesses: ${verdict.weaknesses?.join("; ") || "N/A"}`);
  }

  if (context.evidenceAnalyses.length > 0) {
    parts.push(`\nEVIDENCE ANALYSIS SUMMARY:
${context.evidenceAnalyses.slice(0, 5).map((a, i) => `${i + 1}. Admissibility: ${a.overall_admissibility} (${a.confidence_score}% confidence)
   Issues: ${a.issues?.slice(0, 2).map((issue) => `${issue.rule}: ${issue.description}`).join("; ") || "None identified"}`).join("\n")}`);
  }

  return parts.join("\n");
};

const buildAnalysisPrompt = (action: Action, contextString: string, focusAreas?: string[]): string => {
  const focusAreasText = focusAreas && focusAreas.length > 0
    ? `\n\nSPECIAL FOCUS AREAS:\n${focusAreas.map((area) => `- ${area}`).join("\n")}`
    : "";

  const basePrompt = `You are an expert legal strategist with decades of litigation experience. Analyze this case and provide strategic insights.

${contextString}${focusAreasText}`;

  const analysisPrompts: Record<Action, string> = {
    analyze: `${basePrompt}

Provide a COMPREHENSIVE case analysis including:
1. SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats)
2. Outcome Prediction (win probability, predicted outcome)
3. Settlement Analysis (recommended range, strategy)
4. Timeline Optimization (key dates, critical path)
5. Risk Assessment (risks, mitigation strategies)

Return a JSON object with this exact structure:
{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "opportunities": ["opportunity 1", "opportunity 2", ...],
  "threats": ["threat 1", "threat 2", ...],
  "winProbability": 0.0-1.0,
  "predictedOutcome": "Description of most likely outcome",
  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "high" | "medium" | "low",
      "deadline": "YYYY-MM-DD or timeframe",
      "impact": "Expected impact of this action"
    }
  ],
  "settlementRange": {
    "min": 0,
    "max": 0,
    "recommended": 0,
    "currency": "USD"
  },
  "keyFactors": [
    {
      "factor": "Key factor description",
      "impact": "positive" | "negative" | "neutral",
      "weight": 1-10
    }
  ],
  "riskAssessment": [
    {
      "risk": "Risk description",
      "probability": 0-100,
      "impact": 1-10,
      "mitigation": "Mitigation strategy"
    }
  ]
}`,

    swot: `${basePrompt}

Provide a detailed SWOT Analysis for this case. Identify internal and external factors that will affect the case outcome.

Return a JSON object with this exact structure:
{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "opportunities": ["opportunity 1", "opportunity 2", ...],
  "threats": ["threat 1", "threat 2", ...],
  "winProbability": 0.0-1.0,
  "predictedOutcome": "Brief outcome prediction",
  "recommendedActions": [
    {
      "action": "Action based on SWOT analysis",
      "priority": "high" | "medium" | "low",
      "deadline": "timeframe",
      "impact": "Expected impact"
    }
  ],
  "keyFactors": [
    {
      "factor": "Key SWOT factor",
      "impact": "positive" | "negative" | "neutral",
      "weight": 1-10
    }
  ],
  "settlementRange": {"min": 0, "max": 0, "recommended": 0, "currency": "USD"},
  "riskAssessment": [
    {
      "risk": "Risk from SWOT",
      "probability": 0-100,
      "impact": 1-10,
      "mitigation": "Strategy"
    }
  ]
}`,

    predict: `${basePrompt}

Analyze this case and PREDICT THE MOST LIKELY OUTCOME. Consider:
- Strength of evidence
- Witness credibility factors
- Legal precedents
- Jurisdiction tendencies
- Mock jury results (if available)

Return a JSON object with this exact structure:
{
  "strengths": ["supporting factor 1", "supporting factor 2"],
  "weaknesses": ["weakening factor 1", "weakening factor 2"],
  "opportunities": ["opportunity 1"],
  "threats": ["threat 1"],
  "winProbability": 0.0-1.0,
  "predictedOutcome": "Detailed prediction of case outcome with reasoning",
  "recommendedActions": [
    {
      "action": "Action to improve outcome",
      "priority": "high" | "medium" | "low",
      "deadline": "timeframe",
      "impact": "Expected impact on outcome"
    }
  ],
  "keyFactors": [
    {
      "factor": "Critical factor affecting outcome",
      "impact": "positive" | "negative" | "neutral",
      "weight": 1-10
    }
  ],
  "settlementRange": {"min": 0, "max": 0, "recommended": 0, "currency": "USD"},
  "riskAssessment": [
    {
      "risk": "Outcome risk",
      "probability": 0-100,
      "impact": 1-10,
      "mitigation": "Mitigation strategy"
    }
  ]
}`,

    settlement: `${basePrompt}

Analyze this case for SETTLEMENT VALUE and strategy. Consider:
- Damages claimed vs. provable damages
- Case strengths and weaknesses
- Litigation costs vs. settlement value
- Insurance coverage (if applicable)
- Defendant's ability to pay
- Precedent settlements in similar cases

Return a JSON object with this exact structure:
{
  "strengths": ["strength affecting settlement"],
  "weaknesses": ["weakness affecting settlement"],
  "opportunities": ["settlement opportunity"],
  "threats": ["threat to settlement"],
  "winProbability": 0.0-1.0,
  "predictedOutcome": "Settlement prediction",
  "recommendedActions": [
    {
      "action": "Settlement negotiation action",
      "priority": "high" | "medium" | "low",
      "deadline": "timeframe",
      "impact": "Impact on settlement value"
    }
  ],
  "settlementRange": {
    "min": minimum_reasonable_settlement,
    "max": maximum_reasonable_settlement,
    "recommended": recommended_settlement_target,
    "currency": "USD"
  },
  "keyFactors": [
    {
      "factor": "Factor affecting settlement value",
      "impact": "positive" | "negative" | "neutral",
      "weight": 1-10
    }
  ],
  "riskAssessment": [
    {
      "risk": "Settlement risk",
      "probability": 0-100,
      "impact": 1-10,
      "mitigation": "Mitigation strategy"
    }
  ]
}`,

    timeline: `${basePrompt}

Analyze the case TIMELINE and identify:
- Critical dates and deadlines
- Key milestones
- Potential delays
- Optimal scheduling strategy
- Statute of limitations considerations

Return a JSON object with this exact structure:
{
  "strengths": ["Timeline strength"],
  "weaknesses": ["Timeline weakness"],
  "opportunities": ["Timeline opportunity"],
  "threats": ["Timeline threat"],
  "winProbability": 0.0-1.0,
  "predictedOutcome": "Timeline-based outcome prediction",
  "recommendedActions": [
    {
      "action": "Timeline-optimized action",
      "priority": "high" | "medium" | "low",
      "deadline": "specific date or timeframe",
      "impact": "Impact on case timeline"
    }
  ],
  "settlementRange": {"min": 0, "max": 0, "recommended": 0, "currency": "USD"},
  "keyFactors": [
    {
      "factor": "Timeline-critical factor",
      "impact": "positive" | "negative" | "neutral",
      "weight": 1-10
    }
  ],
  "riskAssessment": [
    {
      "risk": "Timeline risk",
      "probability": 0-100,
      "impact": 1-10,
      "mitigation": "Mitigation strategy"
    }
  ]
}`,

    recommendations: `${basePrompt}

Provide STRATEGIC RECOMMENDATIONS for this case. Focus on actionable steps the attorney should take to improve case outcomes.

Return a JSON object with this exact structure:
{
  "strengths": ["Current case strength to leverage"],
  "weaknesses": ["Weakness to address"],
  "opportunities": ["Strategic opportunity"],
  "threats": ["Threat to prepare for"],
  "winProbability": 0.0-1.0,
  "predictedOutcome": "Outcome if recommendations followed",
  "recommendedActions": [
    {
      "action": "Specific, actionable recommendation",
      "priority": "high" | "medium" | "low",
      "deadline": "when to complete",
      "impact": "Expected impact"
    }
  ],
  "settlementRange": {"min": 0, "max": 0, "recommended": 0, "currency": "USD"},
  "keyFactors": [
    {
      "factor": "Key strategic factor",
      "impact": "positive" | "negative" | "neutral",
      "weight": 1-10
    }
  ],
  "riskAssessment": [
    {
      "risk": "Strategic risk",
      "probability": 0-100,
      "impact": 1-10,
      "mitigation": "Mitigation strategy"
    }
  ]
}`,
  };

  return analysisPrompts[action];
};

const callAI = async (prompt: string, maxTokens: number = 4000): Promise<string> => {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }

    lastError = await response.text();
    if (response.status === 429 || response.status >= 500) {
      await wait(250 * attempt);
      continue;
    }
    break;
  }

  throw new Error(`AI API error: ${lastError}`);
};

const validateAndNormalizeResponse = (parsed: Partial<CaseStrategyResponse>): CaseStrategyResponse => {
  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.map((s) => String(s)).slice(0, 10)
    : ["Case has merit"];

  const weaknesses = Array.isArray(parsed.weaknesses)
    ? parsed.weaknesses.map((w) => String(w)).slice(0, 10)
    : ["Further analysis needed"];

  const opportunities = Array.isArray(parsed.opportunities)
    ? parsed.opportunities.map((o) => String(o)).slice(0, 10)
    : ["Explore additional evidence"];

  const threats = Array.isArray(parsed.threats)
    ? parsed.threats.map((t) => String(t)).slice(0, 10)
    : ["Opposing counsel strategy"];

  const winProbability = clampProbability(parsed.winProbability);

  const predictedOutcome = String(parsed.predictedOutcome || "Outcome prediction requires additional case analysis");

  const recommendedActions: RecommendedAction[] = Array.isArray(parsed.recommendedActions)
    ? parsed.recommendedActions.slice(0, 15).map((action: Partial<RecommendedAction>) => ({
        action: String(action.action || "Review case materials"),
        priority: PRIORITIES.includes(action.priority as Priority) ? action.priority as Priority : "medium",
        deadline: action.deadline ? String(action.deadline) : undefined,
        impact: String(action.impact || "Improve case preparation"),
      }))
    : [{ action: "Review all case documents thoroughly", priority: "high", impact: "Ensure comprehensive case understanding" }];

  const settlementRange: SettlementRange = parsed.settlementRange
    ? {
        min: Math.max(0, Number(parsed.settlementRange.min) || 0),
        max: Math.max(0, Number(parsed.settlementRange.max) || 0),
        recommended: Math.max(0, Number(parsed.settlementRange.recommended) || 0),
        currency: String(parsed.settlementRange.currency || "USD"),
      }
    : { min: 0, max: 0, recommended: 0, currency: "USD" };

  const keyFactors: KeyFactor[] = Array.isArray(parsed.keyFactors)
    ? parsed.keyFactors.slice(0, 15).map((factor: Partial<KeyFactor>) => ({
        factor: String(factor.factor || "Case factor"),
        impact: IMPACT_TYPES.includes(factor.impact as ImpactType) ? factor.impact as ImpactType : "neutral",
        weight: clampScore(factor.weight, 1, 10),
      }))
    : [{ factor: "Case merit assessment", impact: "neutral", weight: 5 }];

  const riskAssessment: RiskAssessment[] = Array.isArray(parsed.riskAssessment)
    ? parsed.riskAssessment.slice(0, 10).map((risk: Partial<RiskAssessment>) => ({
        risk: String(risk.risk || "Unidentified risk"),
        probability: clampScore(risk.probability, 0, 100),
        impact: clampScore(risk.impact, 1, 10),
        mitigation: String(risk.mitigation || "Develop mitigation strategy"),
      }))
    : [{ risk: "Case outcome uncertainty", probability: 50, impact: 5, mitigation: "Gather additional evidence" }];

  return {
    id: generateId(),
    analysisType: parsed.analysisType || "comprehensive",
    strengths,
    weaknesses,
    opportunities,
    threats,
    winProbability,
    predictedOutcome,
    recommendedActions,
    settlementRange,
    keyFactors,
    riskAssessment,
    generatedAt: new Date().toISOString(),
  };
};

const handleAnalyze = async (
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  userId: string,
  requestBody: CaseStrategyRequest,
  corsHeaders: Record<string, string>
): Promise<Response> => {
  const caseId = validateUUID(requestBody.caseId, "caseId");
  const action = requestBody.action;

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("id, user_id, name")
    .eq("id", caseId)
    .single();

  if (caseError || !caseData) {
    return createErrorResponse(new Error("Case not found"), 404, "case-strategy", corsHeaders);
  }

  if ((caseData as CaseData).user_id !== userId) {
    return forbiddenResponse("You do not have access to this case", corsHeaders);
  }

  const context = await gatherCaseContext(supabase, caseId, requestBody.options);
  const contextString = buildContextString(context);
  const prompt = buildAnalysisPrompt(action, contextString, requestBody.options?.focusAreas);

  const aiResponse = await callAI(prompt, 4000);
  const parsed = parseJsonObject<Partial<CaseStrategyResponse>>(aiResponse, {});
  parsed.analysisType = action;

  const response = validateAndNormalizeResponse(parsed);

  const storedStrategy: StoredStrategy = {
    id: response.id,
    case_id: caseId,
    user_id: userId,
    analysis_type: action,
    strengths: response.strengths,
    weaknesses: response.weaknesses,
    opportunities: response.opportunities,
    threats: response.threats,
    win_probability: response.winProbability,
    predicted_outcome: response.predictedOutcome,
    recommended_actions: response.recommendedActions,
    settlement_range: response.settlementRange,
    key_factors: response.keyFactors,
    risk_assessment: response.riskAssessment,
    created_at: response.generatedAt,
  };

  const { error: insertError } = await supabase
    .from("case_strategies")
    .insert(storedStrategy);

  if (insertError) {
    console.warn("Failed to store strategy:", insertError.message);
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY", "OPENAI_API_KEY"]);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"),
        401,
        "case-strategy",
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`case-strategy:${user.id}`, 10, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const requestBody = (await req.json()) as CaseStrategyRequest;

    validateRequestBody(requestBody as unknown as Record<string, unknown>, ["action", "caseId"]);

    const action = validateEnum(requestBody.action, "action", ACTIONS);
    const caseId = validateUUID(requestBody.caseId, "caseId");

    const requestWithValidatedCaseId = { ...requestBody, caseId };

    return await handleAnalyze(supabase, user.id, requestWithValidatedCaseId, corsHeaders);
  } catch (error) {
    console.error("Case strategy error:", error);
    return createErrorResponse(error, 500, "case-strategy", corsHeaders);
  }
});
