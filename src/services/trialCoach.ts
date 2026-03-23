import { supabase } from "@/integrations/supabase/client";

// ─── Score Dimensions ────────────────────────────────────────────────────────

export interface SessionScore {
  overall: number;
  dimensions: {
    questioning_technique: number;
    legal_accuracy: number;
    strategic_thinking: number;
    objection_use: number;
    narrative_control: number;
    time_management: number;
    courtroom_decorum: number;
  };
  exchanges_scored: number;
  highlights: string[];
  weaknesses: string[];
  recommended_drills: string[];
}

// ─── Coaching Prompt ─────────────────────────────────────────────────────────

const COACH_PROMPT = `You are a senior trial advocacy coach reviewing this exchange from a trial simulation.

Attorney's statement/question: {attorneyInput}
Character's response: {characterResponse}
Simulation mode: {mode}
Session context: {sessionContext}

Provide immediate coaching on:
1. TECHNIQUE: What did they do right/wrong tactically?
2. LEGAL: Any procedural or evidentiary issues?
3. STRATEGIC: How did this advance or hurt their case theory?
4. BETTER APPROACH: Give the exact better question/statement they should have used
5. SCORE: 1-10 on this specific exchange with brief justification

Keep coaching concise — this appears BETWEEN exchanges. Max 4 sentences.
Be direct. Be specific. Reference exactly what they said.

Respond with ONLY valid JSON:
{
  "coaching": "Your coaching text here (max 4 sentences)",
  "score": 7,
  "technique_note": "What they did well or poorly tactically",
  "better_approach": "The exact better question or statement"
}`;

// ─── Post-Session Analysis Prompt ────────────────────────────────────────────

const SESSION_ANALYSIS_PROMPT = `You are an elite trial advocacy coach analyzing a complete simulation session.

SIMULATION MODE: {mode}
TOTAL EXCHANGES: {exchangeCount}
SESSION DURATION: {duration} minutes

FULL TRANSCRIPT:
{transcript}

Analyze the entire session and provide:
1. Overall score (0-100)
2. Dimensional scores (0-100 each):
   - questioning_technique
   - legal_accuracy
   - strategic_thinking
   - objection_use
   - narrative_control
   - time_management
   - courtroom_decorum
3. Top 3 highlights (best moments)
4. Top 3 weaknesses (areas to improve)
5. 3 recommended drills for improvement

Respond with ONLY valid JSON:
{
  "overall": 72,
  "dimensions": {
    "questioning_technique": 75,
    "legal_accuracy": 68,
    "strategic_thinking": 70,
    "objection_use": 65,
    "narrative_control": 78,
    "time_management": 72,
    "courtroom_decorum": 80
  },
  "highlights": ["specific moment 1", "specific moment 2", "specific moment 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "recommended_drills": ["drill 1", "drill 2", "drill 3"]
}`;

// ─── Core Functions ──────────────────────────────────────────────────────────

export async function getExchangeCoaching(
  attorneyInput: string,
  characterResponse: string,
  mode: string,
  sessionContext: string
): Promise<{ coaching: string; score: number; better_approach?: string }> {
  const prompt = COACH_PROMPT
    .replace("{attorneyInput}", attorneyInput)
    .replace("{characterResponse}", characterResponse)
    .replace("{mode}", mode)
    .replace("{sessionContext}", sessionContext);

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Provide your coaching feedback on this exchange." },
      ],
    },
  });

  if (error) throw new Error(`Coaching error: ${error.message}`);

  try {
    const rawContent: string =
      typeof data === "string"
        ? data
        : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    const parsed = JSON.parse(jsonStr.trim());

    return {
      coaching: parsed.coaching ?? rawContent.slice(0, 200),
      score: typeof parsed.score === "number" ? parsed.score : 5,
      better_approach: parsed.better_approach,
    };
  } catch {
    return {
      coaching: typeof data === "string" ? data.slice(0, 200) : "Good exchange. Keep practicing.",
      score: 5,
    };
  }
}

export async function getSessionAnalysis(
  mode: string,
  exchangeCount: number,
  durationMinutes: number,
  transcript: Array<{ role: string; content: string }>
): Promise<SessionScore> {
  const transcriptText = transcript
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n");

  const prompt = SESSION_ANALYSIS_PROMPT
    .replace("{mode}", mode)
    .replace("{exchangeCount}", String(exchangeCount))
    .replace("{duration}", String(durationMinutes))
    .replace("{transcript}", transcriptText.slice(0, 8000));

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Analyze this session and provide the full score breakdown." },
      ],
    },
  });

  if (error) throw new Error(`Session analysis error: ${error.message}`);

  try {
    const rawContent: string =
      typeof data === "string"
        ? data
        : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    const parsed = JSON.parse(jsonStr.trim());

    return {
      overall: parsed.overall ?? 50,
      dimensions: {
        questioning_technique: parsed.dimensions?.questioning_technique ?? 50,
        legal_accuracy: parsed.dimensions?.legal_accuracy ?? 50,
        strategic_thinking: parsed.dimensions?.strategic_thinking ?? 50,
        objection_use: parsed.dimensions?.objection_use ?? 50,
        narrative_control: parsed.dimensions?.narrative_control ?? 50,
        time_management: parsed.dimensions?.time_management ?? 50,
        courtroom_decorum: parsed.dimensions?.courtroom_decorum ?? 50,
      },
      exchanges_scored: exchangeCount,
      highlights: parsed.highlights ?? [],
      weaknesses: parsed.weaknesses ?? [],
      recommended_drills: parsed.recommended_drills ?? [],
    };
  } catch {
    return {
      overall: 50,
      dimensions: {
        questioning_technique: 50,
        legal_accuracy: 50,
        strategic_thinking: 50,
        objection_use: 50,
        narrative_control: 50,
        time_management: 50,
        courtroom_decorum: 50,
      },
      exchanges_scored: exchangeCount,
      highlights: [],
      weaknesses: [],
      recommended_drills: [],
    };
  }
}

// ─── Transcript Export ───────────────────────────────────────────────────────

export function exportTranscriptAsText(
  messages: Array<{ role: string; content: string; coaching?: string }>,
  sessionInfo: { mode: string; duration: string; date: string; caseName?: string }
): string {
  const header = [
    "═══════════════════════════════════════════════════════════",
    "TRIAL SIMULATION TRANSCRIPT",
    "═══════════════════════════════════════════════════════════",
    `Mode: ${sessionInfo.mode}`,
    `Case: ${sessionInfo.caseName ?? "N/A"}`,
    `Date: ${sessionInfo.date}`,
    `Duration: ${sessionInfo.duration}`,
    "───────────────────────────────────────────────────────────",
    "",
  ].join("\n");

  const body = messages
    .map((m) => {
      const speaker = m.role === "user" ? "ATTORNEY" : "CHARACTER";
      let line = `[${speaker}]: ${m.content}`;
      if (m.coaching) {
        line += `\n  [COACH]: ${m.coaching}`;
      }
      return line;
    })
    .join("\n\n");

  return header + body;
}
