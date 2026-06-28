import { supabase } from "@/integrations/supabase/client";

export interface IntakeData {
  fullName: string;
  contact: string;
  matterType: string;
  jurisdiction: string;
  summary: string;
  incidentDate: string;
  opposingParties: string;
  deadlines: string;
  injuriesOrDamages: string;
  desiredOutcome: string;
  priorCounsel: string;
}

export interface IntakeScore {
  score: number;
  disposition: "accepted" | "review" | "denied";
  recommendedDepartment: string;
  recommendedAgentId: string;
  reasoning: string;
  clientMessage: string;
  urgency: "low" | "medium" | "high";
}

export interface IntakeCase {
  id: string;
  created_at: string;
  firm_id?: string;
  full_name: string;
  contact: string;
  matter_type: string;
  jurisdiction: string;
  summary: string;
  score: number;
  disposition: "accepted" | "review" | "denied";
  status: "new" | "accepted" | "denied" | "routed";
  recommended_department: string;
  recommended_agent_id: string;
  urgency: "low" | "medium" | "high";
  intake: IntakeData;
  score_detail: IntakeScore;
  transcript: { speaker: string; text: string }[];
}

const INTAKE_TABLE = "intake_cases";

function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

export async function extractIntake(transcript: { speaker: string; text: string }[]): Promise<{ data: IntakeData; score: IntakeScore }> {
  const convo = transcript.map((t) => `${t.speaker === "user" ? "CLIENT" : "MAYA"}: ${t.text}`).join("\n");

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: `You are a senior intake analyst. Read the intake transcript and extract structured data.

RULES:
- Every field must be grounded in what the CLIENT actually said. Do NOT guess or invent.
- If a detail was not stated, leave it empty.
- Return valid JSON only, no markdown.

Return JSON in this exact shape:
{
  "fullName": "",
  "contact": "",
  "matterType": "",
  "jurisdiction": "",
  "summary": "",
  "incidentDate": "",
  "opposingParties": "",
  "deadlines": "",
  "injuriesOrDamages": "",
  "desiredOutcome": "",
  "priorCounsel": ""
}` },
        { role: "user", content: convo },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    },
  });

  if (error) throw new Error(error.message);
  const raw = data?.choices?.[0]?.message?.content || data?.content || "{}";
  const intakeData = safeJsonParse<IntakeData>(raw) || {
    fullName: "", contact: "", matterType: "", jurisdiction: "",
    summary: "", incidentDate: "", opposingParties: "", deadlines: "",
    injuriesOrDamages: "", desiredOutcome: "", priorCounsel: "",
  };

  // Score the intake
  const { data: scoreData, error: scoreError } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: `You are an intake scoring specialist. Score this case intake and recommend routing.

Return valid JSON only in this shape:
{
  "score": 0-100,
  "disposition": "accepted|review|denied",
  "recommendedDepartment": "",
  "recommendedAgentId": "",
  "reasoning": "",
  "clientMessage": "",
  "urgency": "low|medium|high"
}
- Accepted (>=65): strong case fit, auto-route
- Review (45-64): needs attorney review
- Denied (<45): politely decline` },
        { role: "user", content: JSON.stringify(intakeData) },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    },
  });

  if (scoreError) throw new Error(scoreError.message);
  const scoreRaw = scoreData?.choices?.[0]?.message?.content || scoreData?.content || "{}";
  const scoreDetail = safeJsonParse<IntakeScore>(scoreRaw) || {
    score: 50, disposition: "review", recommendedDepartment: "General",
    recommendedAgentId: "strategy-agent", reasoning: "Auto-scored.",
    clientMessage: "Thank you for your submission.", urgency: "medium",
  };

  return { data: intakeData, score: scoreDetail };
}

export async function submitIntake(intakeCase: Omit<IntakeCase, "id" | "created_at">): Promise<IntakeCase | null> {
  const { data, error } = await supabase.from(INTAKE_TABLE).insert(intakeCase).select().single();
  if (error) {
    // Fallback to localStorage
    try {
      const local = JSON.parse(localStorage.getItem("cb_intake_fallback") || "[]");
      local.push({ ...intakeCase, id: crypto.randomUUID(), created_at: new Date().toISOString() });
      localStorage.setItem("cb_intake_fallback", JSON.stringify(local.slice(-50)));
    } catch { /* ignore */ }
    return null;
  }
  return data as unknown as IntakeCase;
}

export async function getIntakeCases(): Promise<IntakeCase[]> {
  const { data, error } = await supabase.from(INTAKE_TABLE).select("*").order("created_at", { ascending: false });
  if (error) {
    try {
      const local = JSON.parse(localStorage.getItem("cb_intake_fallback") || "[]");
      return local.reverse();
    } catch { return []; }
  }
  return (data as unknown as IntakeCase[]) || [];
}

export async function updateIntakeStatus(id: string, status: IntakeCase["status"], disposition: IntakeCase["disposition"]): Promise<void> {
  await supabase.from(INTAKE_TABLE).update({ status, disposition }).eq("id", id);
}
