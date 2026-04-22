import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'witness-prep', corsHeaders);
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`witness-prep:${user.id}`, 10, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { caseId, witnessName, witnessRole, additionalContext } = await req.json();
    if (!caseId || !witnessName) {
      return new Response(JSON.stringify({ error: 'caseId and witnessName required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch case
    const { data: caseData } = await supabase
      .from('cases')
      .select('name, case_type, client_name, representation, case_theory, key_issues, winning_factors')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!caseData) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all analyzed documents
    const { data: documents } = await supabase
      .from('documents')
      .select('name, bates_number, summary, key_facts, favorable_findings, adverse_findings, ocr_text, ai_analyzed')
      .eq('case_id', caseId)
      .order('bates_number', { ascending: true });

    const docs = (documents || []).filter((d: Record<string, unknown>) => d.ai_analyzed || d.summary);

    // Find documents that mention the witness
    const witnessNameLower = witnessName.toLowerCase();
    const witnessDocuments = docs.filter((d: Record<string, unknown>) => {
      const textToSearch = [
        d.name, d.summary,
        ...(Array.isArray(d.key_facts) ? d.key_facts : []),
        ...(Array.isArray(d.favorable_findings) ? d.favorable_findings : []),
        ...(Array.isArray(d.adverse_findings) ? d.adverse_findings : []),
        typeof d.ocr_text === 'string' ? d.ocr_text.slice(0, 3000) : '',
      ].join(' ').toLowerCase();
      return textToSearch.includes(witnessNameLower);
    });

    const witnessDocContext = witnessDocuments.slice(0, 8).map((d: Record<string, unknown>) => {
      const parts: string[] = [`[${d.bates_number || d.name}]`];
      if (d.summary) parts.push(`Summary: ${d.summary}`);
      if (Array.isArray(d.key_facts) && d.key_facts.length) parts.push(`Key Facts: ${d.key_facts.join('; ')}`);
      if (Array.isArray(d.favorable_findings) && d.favorable_findings.length) parts.push(`Favorable: ${d.favorable_findings.join('; ')}`);
      if (Array.isArray(d.adverse_findings) && d.adverse_findings.length) parts.push(`Adverse: ${d.adverse_findings.join('; ')}`);
      if (typeof d.ocr_text === 'string') {
        // Find the section with the witness name
        const ocrLower = d.ocr_text.toLowerCase();
        const idx = ocrLower.indexOf(witnessNameLower);
        if (idx >= 0) {
          const excerpt = d.ocr_text.slice(Math.max(0, idx - 200), idx + 800);
          parts.push(`Relevant excerpt: "...${excerpt}..."`);
        }
      }
      return parts.join('\n');
    }).join('\n\n---\n\n');

    const allDocContext = docs.slice(0, 15).map((d: Record<string, unknown>) => {
      const bates = d.bates_number || d.name;
      const facts = Array.isArray(d.key_facts) ? d.key_facts.slice(0, 3).join('; ') : '';
      return `[${bates}]: ${d.summary || ''} ${facts}`;
    }).join('\n');

    const systemPrompt = `You are a senior trial attorney preparing to examine ${witnessName}, who is a ${witnessRole || 'witness'} in the case: ${caseData.name} (${caseData.case_type}).

Our client: ${caseData.client_name} (${caseData.representation})
Case Theory: ${caseData.case_theory || 'Not specified'}
Key Issues: ${(caseData.key_issues || []).join(', ') || 'Not specified'}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

DOCUMENTS MENTIONING ${witnessName.toUpperCase()} (${witnessDocuments.length} found):
${witnessDocContext || 'No documents specifically mention this witness by name.'}

ALL CASE DOCUMENTS (summary):
${allDocContext || 'No analyzed documents available.'}

Generate a comprehensive witness preparation pack. Respond with ONLY valid JSON:
{
  "prepQuestions": [
    {
      "question": "Exact question to ask",
      "type": "foundational|background|case_theory|trap|impeachment|expert",
      "purpose": "Strategic purpose of this question",
      "expectedAnswer": "What a cooperative witness would say",
      "trapVariant": "Version that boxes in an evasive witness",
      "sourceDocument": "Bates number or document name supporting this question",
      "riskLevel": "low|medium|high",
      "followUp": "Follow-up question if witness gives expected answer"
    }
  ],
  "impeachmentMaterial": [
    {
      "statement": "The prior inconsistent statement",
      "source": "Document where this statement appears",
      "contradiction": "What it contradicts in other evidence",
      "impeachmentTechnique": "How to use this at trial or deposition"
    }
  ],
  "keyExhibits": [
    {
      "document": "Document identifier",
      "purpose": "Why to use this exhibit with this witness",
      "foundation": "How to authenticate through this witness"
    }
  ],
  "riskAssessment": {
    "score": 1-10,
    "rationale": "Why this score — credibility, demeanor, knowledge",
    "primaryRisks": ["List of main risks with this witness"],
    "mitigationStrategies": ["How to minimize each risk"]
  },
  "topicOutline": [
    {
      "topic": "Topic heading",
      "subTopics": ["subtopic 1", "subtopic 2"]
    }
  ],
  "strategicNotes": "Overall strategic approach for this witness"
}`;

    // AI provider selection
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string, apiKey: string, model: string;

    if (AI_GATEWAY_URL) {
      apiUrl = AI_GATEWAY_URL; apiKey = OPENAI_API_KEY || GOOGLE_AI_API_KEY || ""; model = "gpt-4o-mini";
    } else if (GOOGLE_AI_API_KEY) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = GOOGLE_AI_API_KEY; model = "gemini-2.0-flash";
    } else if (OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions"; apiKey = OPENAI_API_KEY; model = "gpt-4o-mini";
    } else {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: systemPrompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "{}";

    let prepPack: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      prepPack = JSON.parse(jsonStr.trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, prepPack, witnessDocumentCount: witnessDocuments.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("witness-prep error:", e);
    return createErrorResponse(e, 500, 'witness-prep', corsHeaders);
  }
});
