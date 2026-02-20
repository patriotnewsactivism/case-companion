import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from "../_shared/errorHandler.ts";
import { verifyAuth, forbiddenResponse } from "../_shared/auth.ts";
import { validateUUID, validateEnum } from "../_shared/validation.ts";

const MODES = [
  "cross-examination",
  "direct-examination",
  "opening-statement",
  "closing-argument",
  "deposition",
  "motion-hearing",
] as const;

type Mode = typeof MODES[number];

interface TrialCoachRequest {
  caseId: string;
  mode: Mode;
  transcript?: string;
  lastUtterance?: string;
  askedQuestions?: string[];
}

const modeQuestions: Record<Mode, string[]> = {
  "cross-examination": [
    "You gave a different timeline earlier, correct?",
    "Where is that claim supported in the record?",
    "Is your answer based on personal knowledge?",
  ],
  "direct-examination": [
    "Please describe what you observed first.",
    "What happened immediately after that event?",
    "What record confirms your testimony?",
  ],
  "opening-statement": [
    "State your theory in one sentence.",
    "Identify each element you will prove.",
    "Preview your key exhibits by name.",
  ],
  "closing-argument": [
    "Tie each element to admitted evidence.",
    "Explain why opposing testimony is unreliable.",
    "Request a precise ruling.",
  ],
  deposition: [
    "Who did you meet with to prepare today?",
    "What documents did you review?",
    "Is there anything to clarify in your testimony?",
  ],
  "motion-hearing": [
    "What rule controls this motion?",
    "What is the prejudice if relief is denied?",
    "What is the narrowest practical order?",
  ],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toList = (value: unknown, maxItems = 6) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, maxItems)
    : [];

const toScore = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 65;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const extractGeminiText = (payload: any) => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => String(part?.text || "")).join("").trim();
};

const parseJsonObject = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
};

const fallbackResponse = (mode: Mode) => ({
  witnessResponse:
    "The witness would likely narrow their answer. Pin them to one date, one fact, and one exhibit.",
  sayThisNext: [
    "Please answer yes or no first, then I will allow explanation.",
    "Identify the specific document and page supporting your statement.",
    "Walk us through the timeline with exact dates.",
  ],
  followUpQuestions: modeQuestions[mode],
  objectionOpportunities: ["Non-responsive", "Speculation", "Assumes facts not in evidence"],
  weakPoints: ["Your last line lacked exhibit anchoring.", "Question can be narrowed for control."],
  scorecard: { clarity: 72, control: 70, foundation: 68, persuasion: 71 },
  rationale: "Short, exhibit-anchored questions improve control and trial credibility.",
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY", "GOOGLE_AI_API_KEY"]);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || "Unauthorized"), 401, "trial-coach");
    }

    const { user, supabase } = authResult;
    const rateLimit = checkRateLimit(`trial-coach:${user.id}`, 30, 60000);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = await req.json();
    validateRequestBody<TrialCoachRequest>(requestBody, ["caseId", "mode"]);

    const caseId = validateUUID(requestBody.caseId, "caseId");
    const mode = validateEnum(requestBody.mode, "mode", [...MODES]);
    const transcript = String(requestBody.transcript || "").slice(0, 9000);
    const lastUtterance = String(requestBody.lastUtterance || "").slice(0, 1200);
    const askedQuestions = toList(requestBody.askedQuestions, 15);

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("id, user_id, name, case_type, client_name, case_theory, key_issues, winning_factors, notes")
      .eq("id", caseId)
      .single();

    if (caseError || !caseData) {
      return createErrorResponse(new Error("Case not found"), 404, "trial-coach");
    }

    if ((caseData as any).user_id !== user.id) {
      return forbiddenResponse("You do not have access to this case", corsHeaders);
    }

    const { data: docs } = await supabase
      .from("documents")
      .select("name, summary, key_facts, favorable_findings, adverse_findings, action_items, ocr_text")
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false })
      .limit(6);

    const docContext = (docs || [])
      .map((doc: any, index: number) => {
        const ocrExcerpt = String(doc.ocr_text || "").replace(/\s+/g, " ").slice(0, 700);
        return [
          `DOC ${index + 1}: ${doc.name || "Untitled"}`,
          `Summary: ${doc.summary || "N/A"}`,
          `Key facts: ${toList(doc.key_facts, 4).join("; ") || "N/A"}`,
          `Favorable: ${toList(doc.favorable_findings, 3).join("; ") || "N/A"}`,
          `Adverse: ${toList(doc.adverse_findings, 3).join("; ") || "N/A"}`,
          `Actions: ${toList(doc.action_items, 3).join("; ") || "N/A"}`,
          `OCR excerpt: ${ocrExcerpt || "N/A"}`,
        ].join("\n");
      })
      .join("\n\n");

    const prompt = `You are a litigation trial coach. Return only valid JSON.
Goal: Give concrete courtroom guidance for a ${mode} drill.

CASE:
- Name: ${caseData.name}
- Type: ${caseData.case_type}
- Client: ${caseData.client_name}
- Theory: ${caseData.case_theory || "N/A"}
- Key issues: ${toList(caseData.key_issues, 8).join("; ") || "N/A"}
- Winning factors: ${toList(caseData.winning_factors, 8).join("; ") || "N/A"}
- Notes: ${String(caseData.notes || "").slice(0, 1800) || "N/A"}

DOCUMENT CONTEXT:
${docContext || "N/A"}

LIVE TRANSCRIPT:
${transcript || "N/A"}

MOST RECENT LINE:
${lastUtterance || "N/A"}

AVOID REPEATING THESE QUESTIONS:
${askedQuestions.join("; ") || "N/A"}

JSON schema:
{
  "witnessResponse": "string",
  "sayThisNext": ["3-6 short lines user can say verbatim"],
  "followUpQuestions": ["5-8 targeted questions"],
  "objectionOpportunities": ["2-5 objections with short reason"],
  "weakPoints": ["2-4 tactical risks in user's current approach"],
  "scorecard": {"clarity":0-100,"control":0-100,"foundation":0-100,"persuasion":0-100},
  "rationale": "short tactical explanation"
}`;

    const googleApiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`;

    let aiText = "";
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      });

      if (aiResponse.ok) {
        aiText = extractGeminiText(await aiResponse.json());
        break;
      }

      lastError = await aiResponse.text();
      if (attempt < 3 && (aiResponse.status === 429 || aiResponse.status >= 500)) {
        await wait(250 * attempt);
        continue;
      }
      break;
    }

    const fallback = fallbackResponse(mode);
    const parsed = aiText ? parseJsonObject(aiText) : null;

    const responseBody = parsed
      ? {
          witnessResponse: String(parsed.witnessResponse || "").trim() || fallback.witnessResponse,
          sayThisNext: toList(parsed.sayThisNext, 6).length > 0 ? toList(parsed.sayThisNext, 6) : fallback.sayThisNext,
          followUpQuestions:
            toList(parsed.followUpQuestions, 8).length > 0 ? toList(parsed.followUpQuestions, 8) : fallback.followUpQuestions,
          objectionOpportunities:
            toList(parsed.objectionOpportunities, 5).length > 0
              ? toList(parsed.objectionOpportunities, 5)
              : fallback.objectionOpportunities,
          weakPoints: toList(parsed.weakPoints, 4).length > 0 ? toList(parsed.weakPoints, 4) : fallback.weakPoints,
          scorecard: {
            clarity: toScore(parsed.scorecard?.clarity),
            control: toScore(parsed.scorecard?.control),
            foundation: toScore(parsed.scorecard?.foundation),
            persuasion: toScore(parsed.scorecard?.persuasion),
          },
          rationale: String(parsed.rationale || "").trim() || fallback.rationale,
        }
      : fallback;

    if (!parsed && lastError) {
      console.warn("trial-coach fallback used due to AI response issue:", lastError);
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return createErrorResponse(error, 500, "trial-coach");
  }
});
