import { supabase } from "@/integrations/supabase/client";

export interface GeneratedMotionSection {
  title: string;
  content: string;
  type: string;
  subsections?: Array<{ heading: string; content: string }>;
}

export interface GeneratedMotion {
  caption: {
    court: string;
    case_number: string;
    plaintiff: string;
    defendant: string;
    judge: string;
    document_title: string;
  };
  sections: GeneratedMotionSection[];
  verification_flags: string[];
}

const MOTION_GENERATION_SYSTEM_PROMPT_TEMPLATE = (
  caseData: any,
  documents: any[],
  caseContext: any,
  motionType: string,
  customInstructions: string
) => `You are a senior litigator with 25 years of experience drafting winning motions in federal and state courts. You write with precision, authority, and strategic clarity.

CASE FACTS:
Case Name: ${caseData.name}
Case Type: ${caseData.case_type}
Client: ${caseData.client_name}
Representation: ${caseData.representation}
Court/Jurisdiction: ${caseContext?.jurisdiction ?? "Federal District Court"}
Case Number: ${caseContext?.case_number ?? "[CASE NUMBER]"}
Judge: ${caseContext?.judge_name ?? "[JUDGE NAME]"}
Plaintiff: ${caseContext?.plaintiff_name ?? caseData.client_name}
Defendant: ${caseContext?.defendant_name ?? "[DEFENDANT]"}
Case Theory: ${caseData.case_theory ?? "Not specified"}
Key Issues: ${caseData.key_issues?.join(", ") ?? "Not specified"}
Winning Factors: ${caseData.winning_factors?.join(", ") ?? "Not specified"}

DOCUMENT EVIDENCE AVAILABLE:
${documents
  .slice(0, 8)
  .map((d: any) => {
    const lines: string[] = [`• ${d.name}`];
    if (d.summary) lines.push(`  Summary: ${d.summary}`);
    if (d.key_facts?.length) lines.push(`  Key Facts: ${d.key_facts.join("; ")}`);
    if (d.favorable_findings?.length) lines.push(`  Favorable: ${d.favorable_findings.join("; ")}`);
    return lines.join("\n");
  })
  .join("\n")}

MOTION TO DRAFT: ${motionType}
${customInstructions ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}` : ""}

DRAFTING REQUIREMENTS:
1. Write a complete, court-ready motion — not a template or outline
2. All case-specific facts must be integrated into the argument
3. Every legal proposition must cite authority (cases, statutes, rules)
4. Structure: Caption → Introduction → Statement of Facts → Legal Standard → Argument → Conclusion → Certificate of Service
5. Arguments must be IRAC format (Issue, Rule, Application, Conclusion)
6. For § 1983 cases: address qualified immunity, constitutional standards, and circuit-specific precedent
7. Include verification flags for any facts that need attorney confirmation
8. Write as if filing tomorrow — be specific, cite record evidence, make it persuasive

Respond with ONLY valid JSON:
{
  "caption": {
    "court": "Court name",
    "case_number": "Case number",
    "plaintiff": "Plaintiff name(s)",
    "defendant": "Defendant name(s)",
    "judge": "Judge name",
    "document_title": "MOTION TITLE IN CAPS"
  },
  "sections": [
    {
      "title": "Section heading",
      "content": "Full section text",
      "type": "introduction|facts|standard|argument|conclusion|certificate",
      "subsections": [
        {
          "heading": "I. MAIN ARGUMENT HEADING",
          "content": "Full argument text with citations"
        }
      ]
    }
  ],
  "verification_flags": [
    "Verify: [specific fact or citation that needs attorney review]"
  ]
}`;

export async function generateMotionDraft(
  caseId: string,
  motionType: string,
  customInstructions?: string,
  onChunk?: (text: string) => void
): Promise<GeneratedMotion> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Fetch case data
  const { data: caseData, error: caseError } = await (supabase as any)
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .single();
  if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

  // Fetch case context (extended metadata)
  const { data: caseContext } = await (supabase as any)
    .from("case_context")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  // Fetch documents with AI analysis
  const { data: documents, error: docError } = await (supabase as any)
    .from("documents")
    .select("id, name, summary, key_facts, favorable_findings, adverse_findings, ocr_text")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (docError) throw new Error(`Failed to fetch documents: ${docError.message}`);

  const systemPrompt = MOTION_GENERATION_SYSTEM_PROMPT_TEMPLATE(
    caseData,
    documents ?? [],
    caseContext,
    motionType,
    customInstructions ?? ""
  );

  const userMessage = `Please draft a complete, court-ready ${motionType} for this case. Make it specific to the facts, fully argued, and ready to file after attorney review.`;

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    },
  });

  if (error) throw new Error(`Chat function error: ${error.message}`);

  // Optionally stream chunks if callback provided
  if (onChunk && typeof data === "string") {
    onChunk(data);
  }

  // Parse JSON response
  let generatedMotion: GeneratedMotion;
  try {
    const rawContent: string =
      typeof data === "string"
        ? data
        : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    if (onChunk) onChunk(rawContent);

    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawContent.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    generatedMotion = JSON.parse(jsonStr.trim());
  } catch (parseErr) {
    throw new Error(`Failed to parse motion JSON response: ${parseErr}`);
  }

  // Save to generated_motions table
  const { error: saveError } = await (supabase as any)
    .from("generated_motions")
    .insert({
      case_id: caseId,
      user_id: user.id,
      motion_type: motionType,
      caption: generatedMotion.caption,
      sections: generatedMotion.sections,
      verification_flags: generatedMotion.verification_flags ?? [],
      custom_instructions: customInstructions ?? null,
      status: "draft",
    });

  if (saveError) {
    console.error("Failed to save generated motion:", saveError);
    // Non-fatal — return the motion anyway
  }

  return generatedMotion;
}

export async function getGeneratedMotions(caseId: string): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from("generated_motions")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch generated motions: ${error.message}`);
  return data ?? [];
}

export async function updateMotionSection(
  motionId: string,
  sectionIndex: number,
  newContent: string
): Promise<void> {
  // Fetch current sections JSONB
  const { data, error: fetchError } = await (supabase as any)
    .from("generated_motions")
    .select("sections")
    .eq("id", motionId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch motion: ${fetchError.message}`);

  const sections: GeneratedMotionSection[] = data?.sections ?? [];

  if (sectionIndex < 0 || sectionIndex >= sections.length) {
    throw new Error(`Section index ${sectionIndex} out of range (total: ${sections.length})`);
  }

  sections[sectionIndex] = {
    ...sections[sectionIndex],
    content: newContent,
  };

  const { error: updateError } = await (supabase as any)
    .from("generated_motions")
    .update({ sections, updated_at: new Date().toISOString() })
    .eq("id", motionId);

  if (updateError) throw new Error(`Failed to update motion section: ${updateError.message}`);
}
