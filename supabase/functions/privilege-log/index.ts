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
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'privilege-log', corsHeaders);
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`privilege-log:${user.id}`, 5, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { caseId, documentIds } = await req.json();
    if (!caseId) {
      return new Response(JSON.stringify({ error: 'caseId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch case for context
    const { data: caseData } = await supabase
      .from('cases')
      .select('name, case_type, client_name, representation')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!caseData) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch documents
    let query = supabase
      .from('documents')
      .select('id, name, bates_number, file_type, summary, key_facts, ocr_text, created_at')
      .eq('case_id', caseId);

    if (documentIds && documentIds.length > 0) {
      query = query.in('id', documentIds);
    }

    const { data: documents } = await query.order('bates_number', { ascending: true, nullsFirst: false }).limit(50);
    const docs = documents || [];

    if (docs.length === 0) {
      return new Response(JSON.stringify({ entries: [], message: 'No documents found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process documents in batches to avoid token limits
    const BATCH_SIZE = 8;
    const allEntries: unknown[] = [];

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);

      const docList = batch.map((d: Record<string, unknown>, idx: number) => {
        const parts: string[] = [
          `DOCUMENT ${i + idx + 1}: ${d.bates_number || d.name}`,
          `File Type: ${d.file_type || 'unknown'}`,
          `Date: ${d.created_at ? new Date(d.created_at as string).toISOString().split('T')[0] : 'unknown'}`,
        ];
        if (d.summary) parts.push(`Summary: ${d.summary}`);
        if (Array.isArray(d.key_facts) && d.key_facts.length) parts.push(`Key Facts: ${d.key_facts.slice(0, 3).join('; ')}`);
        if (typeof d.ocr_text === 'string') parts.push(`Text excerpt: ${d.ocr_text.slice(0, 500)}`);
        return parts.join('\n');
      }).join('\n\n');

      const prompt = `You are a discovery attorney reviewing documents for a privilege log required under FRCP 26(b)(5) in the case: ${caseData.name} (${caseData.case_type}).

Our client (${caseData.representation}): ${caseData.client_name}

For each document below, determine:
1. Is it attorney-client privileged? (communication between attorney and client for legal advice, with privilege maintained)
2. Is it attorney work product? (created by attorney or agent in anticipation of litigation)
3. Does it contain privileged information requiring a privilege log entry?

DOCUMENTS TO ANALYZE:
${docList}

Respond with ONLY a valid JSON array. For each document include:
[
  {
    "documentIndex": 1,
    "documentName": "name from above",
    "isPrivileged": true/false,
    "privilegeType": "attorney_client"|"work_product"|"both"|"none",
    "workProductType": "ordinary"|"opinion"|null,
    "dateOfDocument": "YYYY-MM-DD or 'Unknown'",
    "author": "Author name and title if identifiable, or 'Unknown'",
    "recipients": ["Recipient name and title", "..."],
    "description": "General nature of document WITHOUT revealing privileged content",
    "basisForPrivilege": "Specific legal basis (e.g., 'Attorney-client communication seeking legal advice regarding...')",
    "confidenceScore": 0-100,
    "flagForReview": true/false,
    "reviewNote": "Note explaining uncertainty if flagged"
  }
]`;

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
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) continue;

      const aiData = await response.json();
      const rawContent = aiData?.choices?.[0]?.message?.content || "[]";

      try {
        const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\[[\s\S]*\])/);
        const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
        const batchEntries = JSON.parse(jsonStr.trim());

        // Enrich entries with document IDs
        for (const entry of batchEntries) {
          const docIdx = (entry.documentIndex || 1) - 1;
          const doc = batch[docIdx - i];
          if (doc) {
            entry.documentId = doc.id;
            entry.batesNumber = doc.bates_number || doc.name;
          }
          if (entry.isPrivileged) {
            allEntries.push(entry);
          }
        }
      } catch (e) {
        console.error("Failed to parse batch entries:", e);
      }
    }

    // Save privileged entries to DB
    if (allEntries.length > 0) {
      const dbEntries = allEntries.map((entry: unknown) => {
        const e = entry as Record<string, unknown>;
        return {
          case_id: caseId,
          document_id: e.documentId as string || null,
          user_id: user.id,
          bates_number: e.batesNumber as string || e.documentName as string,
          date_of_document: e.dateOfDocument as string || null,
          author: e.author as string || null,
          recipients: Array.isArray(e.recipients) ? e.recipients : [],
          description: e.description as string || '',
          privilege_type: e.privilegeType as string || 'attorney_client',
          work_product_type: e.workProductType as string || null,
          basis_for_privilege: e.basisForPrivilege as string || null,
          confidence_score: typeof e.confidenceScore === 'number' ? e.confidenceScore : null,
          flags_for_review: e.flagForReview ? [e.reviewNote as string].filter(Boolean) : [],
        };
      });

      // Upsert to avoid duplicates on re-run
      const { error: saveError } = await supabase
        .from('privilege_log_entries')
        .upsert(dbEntries, { onConflict: 'case_id,bates_number' });

      if (saveError) console.error("Failed to save privilege log:", saveError);
    }

    return new Response(JSON.stringify({
      success: true,
      entries: allEntries,
      totalDocumentsReviewed: docs.length,
      privilegedCount: allEntries.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error("privilege-log error:", e);
    return createErrorResponse(e, 500, 'privilege-log', corsHeaders);
  }
});
