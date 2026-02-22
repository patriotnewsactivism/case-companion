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

type Action = "analyze" | "generateMotion" | "getHistory";
type MotionType = "limine" | "suppress" | "compel";
type Admissibility = "admissible" | "conditionally_admissible" | "inadmissible";
type Severity = "low" | "medium" | "high" | "critical";

interface EvidenceAnalysisRequest {
  action: Action;
  caseId: string;
  description?: string;
  documentId?: string;
  analysisId?: string;
  motionType?: MotionType;
}

interface AnalysisIssue {
  rule: string;
  severity: Severity;
  description: string;
  recommendation: string;
}

interface CaseLawSupport {
  citation: string;
  holding: string;
  relevance: string;
}

interface EvidenceAnalysisResponse {
  id: string;
  overallAdmissibility: Admissibility;
  confidenceScore: number;
  issues: AnalysisIssue[];
  suggestedFoundations: string[];
  caseLawSupport: CaseLawSupport[];
  motionDraft: string;
}

interface StoredAnalysis {
  id: string;
  case_id: string;
  user_id: string;
  document_id: string | null;
  evidence_description: string;
  overall_admissibility: string;
  confidence_score: number;
  issues: AnalysisIssue[];
  suggested_foundations: string[];
  case_law_support: CaseLawSupport[];
  motion_draft: string;
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
  notes?: string;
}

interface DocumentData {
  id: string;
  name: string;
  document_type?: string;
  summary?: string;
  ocr_text?: string;
}

const ACTIONS: Action[] = ["analyze", "generateMotion", "getHistory"];
const MOTION_TYPES: MotionType[] = ["limine", "suppress", "compel"];
const ADMISSIBILITY_LEVELS: Admissibility[] = ["admissible", "conditionally_admissible", "inadmissible"];
const SEVERITY_LEVELS: Severity[] = ["low", "medium", "high", "critical"];
const DB_ADMISSIBILITY_MAP: Record<Admissibility, string> = {
  admissible: "admissible",
  conditionally_admissible: "conditional",
  inadmissible: "inadmissible",
};
const DB_TO_ADMISSIBILITY_MAP: Record<string, Admissibility> = {
  admissible: "admissible",
  conditional: "conditionally_admissible",
  inadmissible: "inadmissible",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const generateId = () => crypto.randomUUID();

const parseJsonArray = <T>(text: string, fallback: T[] = []): T[] => {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
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

const clampScore = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const FRE_RULES = {
  relevance: `FRE 401-403 - Relevance and Prejudice:
- FRE 401: Evidence is relevant if it has any tendency to make a fact more or less probable than it would be without the evidence, and the fact is of consequence in determining the action.
- FRE 402: Relevant evidence is admissible unless otherwise provided by the Constitution, an Act of Congress, or other rules.
- FRE 403: The court may exclude relevant evidence if its probative value is substantially outweighed by a danger of unfair prejudice, confusing the issues, misleading the jury, undue delay, wasting time, or needlessly presenting cumulative evidence.`,

  hearsay: `FRE 801-807 - Hearsay Rules and Exceptions:
- FRE 801: Definitions - Hearsay is a statement that a party offers in evidence to prove the truth of the matter asserted in the statement.
- FRE 801(d): Statements that are NOT hearsay: prior statements by witnesses, admissions by party-opponents.
- FRE 802: Hearsay rule - Hearsay is not admissible unless exceptions apply.
- FRE 803: Exceptions regardless of declarant's availability (present sense impression, excited utterance, then-existing mental state, statements for medical diagnosis, recorded recollection, records of regularly conducted activity, etc.).
- FRE 804: Exceptions when declarant unavailable (former testimony, dying declaration, statement against interest, etc.).
- FRE 806: Attacking and supporting declarant's credibility.
- FRE 807: Residual exception for statements with equivalent circumstantial guarantees of trustworthiness.`,

  authentication: `FRE 901-903 - Authentication and Identification:
- FRE 901: Requirement to authenticate or identify evidence to admit it.
- FRE 901(b): Examples of authentication - testimony of witness with knowledge, nonexpert opinion on handwriting, comparison by trier or expert witness, distinctive characteristics and the like (chain of custody), voice identification, telephone conversations, public records, process or system, methods provided by statute or rule.
- FRE 902: Evidence that is self-authenticating - domestic public documents, foreign public documents, certified copies, official publications, newspapers, trade inscriptions, acknowledged documents, commercial paper, signatures.
- FRE 903: Subscribing witness's testimony generally not required.`,

  bestEvidence: `FRE 1001-1008 - Best Evidence Rule:
- FRE 1001: Definitions - Originals, duplicates, writings, recordings, photographs.
- FRE 1002: Requirement of the original to prove content of a writing, recording, or photograph.
- FRE 1003: Admissibility of duplicates unless genuine question raised about authenticity or it would be unfair.
- FRE 1004: Other evidence of content admissible when originals lost, destroyed, not obtainable, or opponent has possession.
- FRE 1005: Public records may be proved by certified copy.
- FRE 1006: Summaries admissible if originals would be admissible and voluminous.
- FRE 1007: Testimony or written admission of party to prove content.
- FRE 1008: Court determines admissibility questions about existence of original.`,

  character: `FRE 404-415 - Character Evidence Limitations:
- FRE 404(a): Character evidence generally inadmissible to prove conduct in conformity therewith, except: (1) criminal defendant's pertinent character trait, (2) victim's character in self-defense case, (3) victim's pertinent trait in homicide case, (4) character trait of peacefulness in assault case.
- FRE 404(b): Crimes, wrongs, or other acts not admissible to prove character, but admissible for other purposes (motive, opportunity, intent, preparation, plan, knowledge, identity, absence of mistake, lack of accident).
- FRE 405: Methods of proving character - reputation or opinion; specific instances on cross-examination.
- FRE 406: Habit of a person or routine practice of an organization admissible to prove conduct on a particular occasion.
- FRE 407: Subsequent remedial measures inadmissible to prove negligence, culpable conduct, defect, or need for warning.
- FRE 408: Compromise offers and negotiations inadmissible.
- FRE 409: Payment of medical expenses inadmissible.
- FRE 410: Pleas, plea discussions, and related statements inadmissible.
- FRE 411: Liability insurance inadmissible to prove negligence or ability to pay.
- FRE 412: Sex-offense cases - evidence of victim's sexual behavior/predisposition generally inadmissible.
- FRE 413-415: Similar crimes in sexual assault and child molestation cases admissible.`,
};

const buildAnalysisPrompt = (description: string, caseContext: CaseData | null, documentContext: DocumentData | null): string => {
  return `You are an expert evidence law attorney specializing in Federal Rules of Evidence. Analyze the following evidence description and determine its admissibility.

${FRE_RULES.relevance}

${FRE_RULES.hearsay}

${FRE_RULES.authentication}

${FRE_RULES.bestEvidence}

${FRE_RULES.character}

CASE CONTEXT:
${caseContext ? `- Case Name: ${caseContext.name}
- Case Type: ${caseContext.case_type}
- Client: ${caseContext.client_name}
- Jurisdiction: ${caseContext.jurisdiction || "Federal"}
- Case Theory: ${caseContext.case_theory || "N/A"}
- Notes: ${caseContext.notes?.slice(0, 500) || "N/A"}` : "No case context provided"}

DOCUMENT CONTEXT:
${documentContext ? `- Document Name: ${documentContext.name}
- Document Type: ${documentContext.document_type || "Unknown"}
- Summary: ${documentContext.summary || "N/A"}
- Content Excerpt: ${documentContext.ocr_text?.replace(/\s+/g, " ").slice(0, 800) || "N/A"}` : "No document context provided"}

EVIDENCE TO ANALYZE:
${description}

Provide your analysis as a JSON object with this exact structure:
{
  "overallAdmissibility": "admissible" | "conditionally_admissible" | "inadmissible",
  "confidenceScore": 0-100,
  "issues": [
    {
      "rule": "FRE rule number (e.g., 'FRE 403', 'FRE 802')",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Specific issue description",
      "recommendation": "Actionable recommendation to address this issue"
    }
  ],
  "suggestedFoundations": ["Specific foundation questions or steps to establish admissibility"],
  "caseLawSupport": [
    {
      "citation": "Case citation (e.g., 'Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)')",
      "holding": "Key holding from the case",
      "relevance": "How this applies to the evidence"
    }
  ],
  "motionDraft": "Brief summary of recommended motion or legal strategy"
}

Analyze thoroughly. Consider all applicable FRE rules. Provide specific, actionable recommendations. Return ONLY valid JSON.`;
};

const buildMotionPrompt = (analysis: StoredAnalysis, motionType: MotionType, caseContext: CaseData | null): string => {
  const motionDescriptions: Record<MotionType, string> = {
    limine: `A motion in limine is a pretrial motion asking the court to rule that certain evidence cannot be introduced at trial. This motion seeks to exclude evidence before it is presented to prevent potentially prejudicial or improper evidence from ever reaching the jury.`,
    suppress: `A motion to suppress asks the court to exclude evidence obtained in violation of the defendant's constitutional rights. This is commonly used in criminal cases to exclude evidence from illegal searches, seizures, or interrogations.`,
    compel: `A motion to compel asks the court to order the opposing party to produce evidence or respond to discovery requests. This motion is used when the opposing party has failed to comply with discovery obligations.`,
  };

  return `You are an expert litigation attorney drafting a motion. Generate a complete motion draft based on the following evidence analysis.

MOTION TYPE: ${motionType.toUpperCase()}
${motionDescriptions[motionType]}

CASE INFORMATION:
${caseContext ? `- Case Name: ${caseContext.name}
- Case Type: ${caseContext.case_type}
- Client: ${caseContext.client_name}
- Jurisdiction: ${caseContext.jurisdiction || "Federal"}` : "No case context provided"}

EVIDENCE ANALYSIS:
- Overall Admissibility: ${analysis.overall_admissibility}
- Confidence Score: ${analysis.confidence_score}%
- Description: ${analysis.evidence_description}

IDENTIFIED ISSUES:
${analysis.issues.map((issue, i) => `${i + 1}. ${issue.rule} (${issue.severity}): ${issue.description}
   Recommendation: ${issue.recommendation}`).join("\n")}

SUGGESTED FOUNDATIONS:
${analysis.suggested_foundations.map((f, i) => `${i + 1}. ${f}`).join("\n")}

SUPPORTING CASE LAW:
${analysis.case_law_support.map((c, i) => `${i + 1}. ${c.citation}
   Holding: ${c.holding}
   Relevance: ${c.relevance}`).join("\n")}

Draft a professional, court-ready ${motionType} motion. Include:
1. Caption and title
2. Introduction with procedural background
3. Statement of facts relevant to the motion
4. Legal argument with case citations
5. Conclusion and requested relief
6. Signature block placeholder

Format the motion professionally with proper legal citation style. Be concise but thorough.`;
};

const callAI = async (prompt: string, maxTokens: number = 3000): Promise<string> => {
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
        temperature: 0.2,
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

const handleAnalyze = async (
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  userId: string,
  requestBody: EvidenceAnalysisRequest,
  corsHeaders: Record<string, string>
): Promise<Response> => {
  validateRequestBody(requestBody as unknown as Record<string, unknown>, ["caseId"]);

  const caseId = validateUUID(requestBody.caseId, "caseId");

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("id, user_id, name, case_type, client_name, jurisdiction, case_theory, notes")
    .eq("id", caseId)
    .single();

  if (caseError || !caseData) {
    return createErrorResponse(new Error("Case not found"), 404, "evidence-analysis", corsHeaders);
  }

  if ((caseData as CaseData).user_id !== userId) {
    return forbiddenResponse("You do not have access to this case", corsHeaders);
  }

  let description = requestBody.description ? sanitizeString(requestBody.description, "description", 10000) : "";
  let documentContext: DocumentData | null = null;

  if (requestBody.documentId) {
    const documentId = validateUUID(requestBody.documentId, "documentId");

    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("id, name, document_type, summary, ocr_text")
      .eq("id", documentId)
      .eq("case_id", caseId)
      .single();

    if (!docError && docData) {
      documentContext = docData as DocumentData;
      if (!description) {
        description = documentContext.ocr_text?.slice(0, 5000) || documentContext.summary || "";
      }
    }
  }

  if (!description) {
    throw new Error("Either description or documentId must be provided");
  }

  const prompt = buildAnalysisPrompt(description, caseData as CaseData, documentContext);
  const aiResponse = await callAI(prompt, 3000);

  const parsed = parseJsonObject<Partial<EvidenceAnalysisResponse>>(aiResponse, {});

  const overallAdmissibility = validateEnum(
    parsed.overallAdmissibility || "conditionally_admissible",
    "overallAdmissibility",
    ADMISSIBILITY_LEVELS
  );

  const confidenceScore = clampScore(parsed.confidenceScore);

  const issues: AnalysisIssue[] = (Array.isArray(parsed.issues) ? parsed.issues : []).map((issue: Partial<AnalysisIssue>) => ({
    rule: String(issue.rule || "FRE General"),
    severity: SEVERITY_LEVELS.includes(issue.severity as Severity) ? issue.severity as Severity : "medium",
    description: String(issue.description || "Issue identified"),
    recommendation: String(issue.recommendation || "Consult with counsel"),
  }));

  const suggestedFoundations: string[] = Array.isArray(parsed.suggestedFoundations)
    ? parsed.suggestedFoundations.map((f: unknown) => String(f)).slice(0, 10)
    : ["Establish foundation through witness testimony", "Authenticate document through custodian of records"];

  const caseLawSupport: CaseLawSupport[] = Array.isArray(parsed.caseLawSupport)
    ? parsed.caseLawSupport.map((c: Partial<CaseLawSupport>) => ({
        citation: String(c.citation || ""),
        holding: String(c.holding || ""),
        relevance: String(c.relevance || ""),
      })).filter((c: CaseLawSupport) => c.citation).slice(0, 10)
    : [];

  const motionDraft = String(parsed.motionDraft || "");

  const analysisId = generateId();
  const now = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("evidence_analyses")
    .insert({
      id: analysisId,
      case_id: caseId,
      user_id: userId,
      document_id: requestBody.documentId || null,
      evidence_description: description.slice(0, 10000),
      overall_admissibility: DB_ADMISSIBILITY_MAP[overallAdmissibility],
      confidence_score: confidenceScore,
      issues,
      suggested_foundations: suggestedFoundations,
      case_law_support: caseLawSupport,
      motion_draft: motionDraft,
      created_at: now,
    });

  if (insertError) {
    console.warn("Failed to store analysis:", insertError.message);
  }

  const response: EvidenceAnalysisResponse = {
    id: analysisId,
    overallAdmissibility,
    confidenceScore,
    issues,
    suggestedFoundations,
    caseLawSupport,
    motionDraft,
  };

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const handleGenerateMotion = async (
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  userId: string,
  requestBody: EvidenceAnalysisRequest,
  corsHeaders: Record<string, string>
): Promise<Response> => {
  validateRequestBody(requestBody as unknown as Record<string, unknown>, ["caseId", "analysisId", "motionType"]);

  const caseId = validateUUID(requestBody.caseId, "caseId");
  const analysisId = validateUUID(requestBody.analysisId, "analysisId");
  const motionType = validateEnum(requestBody.motionType!, "motionType", MOTION_TYPES);

  const { data: analysisData, error: analysisError } = await supabase
    .from("evidence_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("case_id", caseId)
    .single();

  if (analysisError || !analysisData) {
    return createErrorResponse(new Error("Analysis not found"), 404, "evidence-analysis", corsHeaders);
  }

  const analysis = analysisData as StoredAnalysis;

  if (analysis.user_id !== userId) {
    return forbiddenResponse("You do not have access to this analysis", corsHeaders);
  }

  const { data: caseData } = await supabase
    .from("cases")
    .select("id, user_id, name, case_type, client_name, jurisdiction")
    .eq("id", caseId)
    .single();

  const prompt = buildMotionPrompt(analysis, motionType, caseData as CaseData);
  const motionDraft = await callAI(prompt, 4000);

  const { error: updateError } = await supabase
    .from("evidence_analyses")
    .update({ motion_draft: motionDraft })
    .eq("id", analysisId);

  if (updateError) {
    console.warn("Failed to update motion draft:", updateError.message);
  }

  return new Response(JSON.stringify({ motionDraft, analysisId, motionType }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const handleGetHistory = async (
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  userId: string,
  requestBody: EvidenceAnalysisRequest,
  corsHeaders: Record<string, string>
): Promise<Response> => {
  validateRequestBody(requestBody as unknown as Record<string, unknown>, ["caseId"]);

  const caseId = validateUUID(requestBody.caseId, "caseId");

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("user_id")
    .eq("id", caseId)
    .single();

  if (caseError || !caseData) {
    return createErrorResponse(new Error("Case not found"), 404, "evidence-analysis", corsHeaders);
  }

  if ((caseData as { user_id: string }).user_id !== userId) {
    return forbiddenResponse("You do not have access to this case", corsHeaders);
  }

  const { data: analyses, error: historyError } = await supabase
    .from("evidence_analyses")
    .select("id, case_id, document_id, evidence_description, overall_admissibility, confidence_score, issues, suggested_foundations, case_law_support, motion_draft, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (historyError) {
    throw new Error(`Failed to retrieve history: ${historyError.message}`);
  }

  return new Response(JSON.stringify({ analyses: analyses || [], caseId }), {
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
        "evidence-analysis",
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`evidence-analysis:${user.id}`, 15, 60000);
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

    const requestBody = (await req.json()) as EvidenceAnalysisRequest;

    validateRequestBody(requestBody as unknown as Record<string, unknown>, ["action", "caseId"]);

    const action = validateEnum(requestBody.action, "action", ACTIONS);
    const caseId = validateUUID(requestBody.caseId, "caseId");

    const requestWithValidatedCaseId = { ...requestBody, caseId };

    switch (action) {
      case "analyze":
        return await handleAnalyze(supabase, user.id, requestWithValidatedCaseId, corsHeaders);
      case "generateMotion":
        return await handleGenerateMotion(supabase, user.id, requestWithValidatedCaseId, corsHeaders);
      case "getHistory":
        return await handleGetHistory(supabase, user.id, requestWithValidatedCaseId, corsHeaders);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Evidence analysis error:", error);
    return createErrorResponse(error, 500, "evidence-analysis", corsHeaders);
  }
});
