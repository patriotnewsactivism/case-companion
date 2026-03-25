import { supabase } from "@/integrations/supabase/client";

export interface TimelineGenerationRequest {
  caseId: string;
  caseType: string;
  jurisdiction: string;
  documents: Array<{ id: string; name: string; content: string; uploadDate: string }>;
  existingFacts: string;
  legalTheories: string[];
}

export interface GeneratedTimelineEvent {
  date: string;
  date_confidence: number;
  title: string;
  description: string;
  category: string;
  source_document_name: string;
  source_page_reference: string;
  legal_significance: string;
  is_gap: boolean;
  deadline_triggered: string;
}

export interface TimelineGap {
  missing_event: string;
  why_important: string;
  recommended_action: string;
}

export interface TimelineGenerationResult {
  events: GeneratedTimelineEvent[];
  gaps: TimelineGap[];
  inserted: number;
}

const IMPORTANCE_MAP: Record<string, string> = {
  constitutional_violation: "high",
  arrest: "high",
  incident: "high",
  filing: "high",
  hearing: "high",
  deadline: "high",
  discovery: "medium",
  evidence: "medium",
  judicial_order: "medium",
  witness: "medium",
  retaliation: "medium",
  media: "medium",
};

function getImportance(category: string): string {
  return IMPORTANCE_MAP[category?.toLowerCase()] ?? "low";
}

const TIMELINE_SYSTEM_PROMPT = `You are a senior litigation attorney and legal timeline analyst with 25 years of experience in federal civil rights litigation, § 1983 cases, criminal defense, and complex civil litigation.

Your task is to analyze case documents and extract a comprehensive, legally precise chronological timeline of events.

For each event you identify, you MUST provide:
1. The exact date (or best estimate with confidence level)
2. A concise, factually accurate title
3. A detailed description including all legally relevant details
4. The category (constitutional_violation, arrest, incident, filing, hearing, deadline, discovery, evidence, judicial_order, witness, retaliation, media, or other)
5. The source document and page reference
6. Legal significance — why this event matters to the case
7. Any deadlines or follow-up actions triggered by this event

For CIVIL RIGHTS § 1983 cases specifically:
- Flag any Fourth Amendment violations (unreasonable search/seizure, excessive force)
- Note Fifth and Fourteenth Amendment due process violations
- Identify qualified immunity issues and when officers had "fair notice" their conduct was unlawful
- Track Monell policy/custom/practice evidence
- Note any Brady/Giglio material in discovery
- Flag statute of limitations trigger dates (typically discovery of injury)
- Identify any pattern of similar incidents by the same officers/agency
- Note when complaints were filed with internal affairs or civilian review boards
- Track any discipline or lack thereof — this goes to Monell liability

CRITICAL INSTRUCTIONS:
- Extract ALL dates mentioned, even approximate ones
- If a date is approximate, lower the confidence score (0.0-1.0)
- Identify gaps in the timeline where events are missing
- Note when the sequence of events suggests spoliation, cover-up, or retaliation
- Cross-reference events across documents for consistency
- Flag any contradictions between documents

Respond with ONLY valid JSON in this exact format:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "date_confidence": 0.95,
      "title": "Event title",
      "description": "Detailed description",
      "category": "category_name",
      "source_document_name": "document name",
      "source_page_reference": "p. 3, ¶ 2",
      "legal_significance": "Why this matters legally",
      "is_gap": false,
      "deadline_triggered": "Any deadline this triggers or empty string"
    }
  ],
  "gaps": [
    {
      "missing_event": "What event is missing",
      "why_important": "Why this gap matters",
      "recommended_action": "What to do to fill this gap"
    }
  ]
}`;

export async function generateIntelligentTimeline(
  request: TimelineGenerationRequest
): Promise<TimelineGenerationResult> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Build document summaries — truncate each to 6000 chars, max 5 docs
  const docSummaries = request.documents
    .slice(0, 5)
    .map((doc) => {
      const truncated = doc.content.slice(0, 6000);
      return `=== DOCUMENT: ${doc.name} (uploaded: ${doc.uploadDate}) ===\n${truncated}${doc.content.length > 6000 ? "\n[... truncated ...]" : ""}`;
    })
    .join("\n\n");

  const userMessage = `CASE INFORMATION:
Case Type: ${request.caseType}
Jurisdiction: ${request.jurisdiction}
Existing Known Facts: ${request.existingFacts || "None provided"}
Legal Theories: ${request.legalTheories.length > 0 ? request.legalTheories.join(", ") : "Not specified"}

DOCUMENTS TO ANALYZE:
${docSummaries || "No documents provided"}

Please analyze all documents and extract a complete chronological timeline with all events, gaps, and legally significant findings.`;

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: TIMELINE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    },
  });

  if (error) throw new Error(`Chat function error: ${error.message}`);

  // Parse JSON from response
  let parsed: { events: GeneratedTimelineEvent[]; gaps: TimelineGap[] };
  try {
    const rawContent: string =
      typeof data === "string"
        ? data
        : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    // Extract JSON block if wrapped in markdown
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    parsed = JSON.parse(jsonStr.trim());
  } catch (parseErr) {
    throw new Error(`Failed to parse timeline JSON response: ${parseErr}`);
  }

  const events: GeneratedTimelineEvent[] = parsed.events ?? [];
  const gaps: TimelineGap[] = parsed.gaps ?? [];

  // Upsert events into timeline_events table
  let inserted = 0;
  if (events.length > 0) {
    const rows = events
      .filter((e) => e.date && e.title)
      .map((e) => ({
        case_id: request.caseId,
        user_id: user.id,
        title: e.title,
        description: e.description ?? "",
        event_date: e.date,
        event_type: e.category ?? "other",
        importance: getImportance(e.category),
        event_category: e.category ?? "other",
        source_document_name: e.source_document_name ?? null,
        source_page_reference: e.source_page_reference ?? null,
        ai_confidence: typeof e.date_confidence === "number" ? e.date_confidence : null,
        legal_significance: e.legal_significance ?? null,
        deadline_triggered_by: e.deadline_triggered || null,
        is_ai_generated: true,
        is_verified: false,
      }));

    const { error: upsertError, data: upsertData } = await (supabase as any)
      .from("timeline_events")
      .upsert(rows, { onConflict: "case_id,title,event_date" })
      .select();

    if (upsertError) {
      console.error("Timeline upsert error:", upsertError);
      // Non-fatal — still return parsed data
    } else {
      inserted = upsertData?.length ?? rows.length;
    }
  }

  return { events, gaps, inserted };
}

export async function getCaseDocumentsForTimeline(
  caseId: string
): Promise<TimelineGenerationRequest["documents"]> {
  const { data, error } = await (supabase as any)
    .from("documents")
    .select("id, name, ocr_text, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

  return (data ?? []).map((doc: any) => ({
    id: doc.id,
    name: doc.name,
    content: doc.ocr_text ?? doc.name ?? "",
    uploadDate: doc.created_at ? doc.created_at.split("T")[0] : "",
  }));
}
