import { supabase } from "@/integrations/supabase/client";

export interface MotionSuggestion {
  id?: string;
  motion_type: string;
  motion_category: string;
  urgency: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  why_applicable: string;
  key_argument: string;
  authorizing_rule: string;
  deadline_warning: string;
  estimated_strength: number;
  generate_ready: boolean;
}

const MOTION_SCANNER_PROMPT = `You are a senior litigation attorney specializing in motion practice across federal and state courts. Your task is to analyze a case and identify every viable motion that could be filed right now or in the near future.

For each motion opportunity, evaluate:
1. Legal basis and applicable rules (FRCP, local rules, statutory authority)
2. Strategic timing — when to file for maximum impact
3. Probability of success based on the facts provided
4. Urgency — does this need to be filed immediately?
5. How it fits into the overall litigation strategy

MOTION CATEGORIES TO SCAN:
- Dispositive: Summary Judgment, Motion to Dismiss (12(b)(6), 12(b)(1), 12(b)(2)), Judgment on Pleadings
- Suppression/Exclusion: Motion to Suppress Evidence, Motion in Limine, Daubert/Frye challenges
- Discovery: Motion to Compel, Motion for Protective Order, Motion to Quash Subpoena, Spoliation sanctions
- Emergency/Injunctive: TRO, Preliminary Injunction, Emergency Stay
- Case Management: Motion to Bifurcate, Motion for Separate Trial, Motion to Consolidate
- Sanctions: Rule 11, § 1927, Inherent Authority, 28 U.S.C. § 1927
- Constitutional: Motion to Strike Qualified Immunity Defense, Motion re: Monell Policy
- Evidence: Motion for Judicial Notice, Motion to Authenticate, Motion re: Chain of Custody
- Procedural: Motion to Amend Complaint, Motion to Add/Drop Parties, Motion to Transfer Venue

For civil rights § 1983 cases, ALWAYS check for:
- Motion to Strike Qualified Immunity (if clearly established law violated)
- Monell Motion (if policy/custom evidence exists)
- Motion to Compel Personnel Files (prior complaints against officers)
- Motion for Adverse Inference (if body cam footage "missing")
- Motion re: Fabricated Evidence (if contradictions found)

Respond with ONLY valid JSON:
{
  "suggestions": [
    {
      "motion_type": "Full motion name",
      "motion_category": "dispositive|suppression|discovery|emergency|sanctions|constitutional|evidence|procedural",
      "urgency": "URGENT|HIGH|MEDIUM|LOW",
      "why_applicable": "Specific facts that make this motion viable",
      "key_argument": "The core legal argument in 2-3 sentences",
      "authorizing_rule": "FRCP Rule X, 42 U.S.C. § XXXX, etc.",
      "deadline_warning": "Any deadline concern or empty string",
      "estimated_strength": 0.75,
      "generate_ready": true
    }
  ]
}`;

export async function scanForMotionOpportunities(
  caseId: string
): Promise<MotionSuggestion[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Fetch case data
  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .single();
  if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

  // Fetch documents
  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, name, ocr_text, summary, key_facts, favorable_findings, adverse_findings")
    .eq("case_id", caseId)
    .limit(10);
  if (docError) throw new Error(`Failed to fetch documents: ${docError.message}`);

  // Fetch timeline events
  const { data: timelineEvents, error: timelineError } = await supabase
    .from("timeline_events")
    .select("title, description, event_date, event_type, importance, legal_significance")
    .eq("case_id", caseId)
    .order("event_date", { ascending: true })
    .limit(30);
  if (timelineError) throw new Error(`Failed to fetch timeline: ${timelineError.message}`);

  // Build context string
  const docContext = (documents ?? [])
    .map((d: any) => {
      const lines: string[] = [`Document: ${d.name}`];
      if (d.summary) lines.push(`Summary: ${d.summary}`);
      if (d.key_facts?.length) lines.push(`Key Facts: ${d.key_facts.join("; ")}`);
      if (d.favorable_findings?.length) lines.push(`Favorable: ${d.favorable_findings.join("; ")}`);
      if (d.adverse_findings?.length) lines.push(`Adverse: ${d.adverse_findings.join("; ")}`);
      if (d.ocr_text) lines.push(`Text (excerpt): ${d.ocr_text.slice(0, 1500)}`);
      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  const timelineContext = (timelineEvents ?? [])
    .map((e: any) => `${e.event_date}: [${e.importance?.toUpperCase()}] ${e.title} — ${e.description ?? ""}${e.legal_significance ? ` (Significance: ${e.legal_significance})` : ""}`)
    .join("\n");

  const userMessage = `CASE OVERVIEW:
Case Name: ${caseData.name}
Case Type: ${caseData.case_type}
Client: ${caseData.client_name}
Representation: ${caseData.representation}
Status: ${caseData.status}
Case Theory: ${caseData.case_theory ?? "Not specified"}
Key Issues: ${caseData.key_issues?.join(", ") ?? "Not specified"}
Winning Factors: ${caseData.winning_factors?.join(", ") ?? "Not specified"}
Notes: ${caseData.notes ?? "None"}

TIMELINE OF EVENTS:
${timelineContext || "No timeline events recorded"}

DOCUMENTS:
${docContext || "No documents analyzed"}

Please analyze this case and identify every viable motion opportunity.`;

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: MOTION_SCANNER_PROMPT },
        { role: "user", content: userMessage },
      ],
    },
  });

  if (error) throw new Error(`Chat function error: ${error.message}`);

  // Parse JSON response
  let parsed: { suggestions: MotionSuggestion[] };
  try {
    const rawContent: string =
      typeof data === "string"
        ? data
        : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    parsed = JSON.parse(jsonStr.trim());
  } catch (parseErr) {
    throw new Error(`Failed to parse motion suggestions JSON: ${parseErr}`);
  }

  const suggestions: MotionSuggestion[] = parsed.suggestions ?? [];

  // Upsert into motion_suggestions table
  if (suggestions.length > 0) {
    const rows = suggestions.map((s) => ({
      case_id: caseId,
      user_id: user.id,
      motion_type: s.motion_type,
      motion_category: s.motion_category,
      urgency: s.urgency,
      why_applicable: s.why_applicable,
      key_argument: s.key_argument,
      authorizing_rule: s.authorizing_rule,
      deadline_warning: s.deadline_warning || null,
      estimated_strength: s.estimated_strength,
      generate_ready: s.generate_ready ?? true,
      is_dismissed: false,
    }));

    const { error: upsertError } = await supabase
      .from("motion_suggestions")
      .upsert(rows, { onConflict: "case_id,motion_type" });

    if (upsertError) {
      console.error("Motion suggestions upsert error:", upsertError);
    }
  }

  // Return from DB to include ids
  return getMotionSuggestions(caseId);
}

export async function getMotionSuggestions(
  caseId: string
): Promise<MotionSuggestion[]> {
  const { data, error } = await supabase
    .from("motion_suggestions")
    .select("*")
    .eq("case_id", caseId)
    .eq("is_dismissed", false)
    .order("estimated_strength", { ascending: false });

  if (error) throw new Error(`Failed to fetch motion suggestions: ${error.message}`);
  return (data ?? []) as MotionSuggestion[];
}

export async function dismissSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from("motion_suggestions")
    .update({ is_dismissed: true })
    .eq("id", id);

  if (error) throw new Error(`Failed to dismiss suggestion: ${error.message}`);
}

export async function getMotionTemplates(): Promise<any[]> {
  const { data, error } = await supabase
    .from("motion_templates")
    .select("*")
    .order("motion_type", { ascending: true });

  if (error) throw new Error(`Failed to fetch motion templates: ${error.message}`);
  return data ?? [];
}
