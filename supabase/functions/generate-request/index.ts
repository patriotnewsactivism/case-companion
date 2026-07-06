import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from "../_shared/errorHandler.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { validateUUID, sanitizeString, validateEnum } from "../_shared/validation.ts";
import { getDocumentAIProvider, callChatCompletion } from "../_shared/aiConfig.ts";

const REQUEST_CATEGORIES = [
  "public_records",
  "discovery_demand",
  "preservation_letter",
  "subpoena",
] as const;

type RequestCategory = typeof REQUEST_CATEGORIES[number];

interface GenerateRequestBody {
  caseId: string;
  requestCategory: RequestCategory;
  requestSubtype?: string;
  jurisdiction?: string;
  jurisdictionName?: string;
  statuteReference?: string;
  recordsSought: string;
  recipientName?: string;
  recipientAgency?: string;
}

/** Per-category drafting guidance for the AI. */
function categoryInstructions(
  category: RequestCategory,
  subtype: string | undefined,
  jurisdictionName: string | undefined,
  statuteReference: string | undefined
): string {
  const statute = statuteReference ? `the governing statute (${statuteReference})` : "the applicable public-records statute";
  const place = jurisdictionName || "the relevant jurisdiction";

  switch (category) {
    case "public_records":
      return `Draft a formal PUBLIC RECORDS / FOIA request letter under ${statute} for ${place}.
- Open by expressly invoking ${statute} and identifying the requester.
- Describe the records sought with enough specificity for the custodian to locate them, but broadly enough to capture responsive material.
- Request a fee waiver or reduction where appropriate, and ask to be notified before fees exceed a stated cap.
- Request electronic copies and segregable portions of partially exempt records.
- Cite the statutory response deadline and request a written justification for any withholding, with an index of withheld records.
- Close with the requester's contact information and a courteous sign-off.`;

    case "discovery_demand":
      return `Draft a formal set of DISCOVERY DEMANDS (subtype: ${subtype || "interrogatories / requests for production"}) to be served on the opposing party.
- Include a proper caption placeholder and a "Definitions and Instructions" section.
- Number each request/interrogatory sequentially.
- Track the applicable rules of civil procedure for ${place}.
- For requests for production, define the categories of documents and ESI with precision.
- For interrogatories, keep each discrete and non-compound.
- Include the response deadline and instructions for asserting privilege via a privilege log.`;

    case "preservation_letter":
      return `Draft a LITIGATION-HOLD / EVIDENCE-PRESERVATION letter.
- Identify the dispute and the recipient's duty to preserve relevant evidence, including ESI.
- Enumerate categories of materials to preserve (documents, emails, text messages, metadata, surveillance/video, physical evidence, backups).
- Instruct the recipient to suspend automatic deletion/rotation policies.
- Warn of spoliation consequences and request written confirmation of compliance.
- Keep the tone firm and professional.`;

    case "subpoena":
      return `Draft a THIRD-PARTY SUBPOENA (subtype: ${subtype || "documents and/or testimony"}) directed to a non-party custodian.
- Include caption and command language appropriate for ${place}.
- Specify with particularity the documents/records or testimony commanded.
- State the time, date, and place for production or appearance (use clear placeholders).
- Include the standard notice of the recipient's rights and duties and objection procedures.
- Add a certificate-of-service placeholder.`;

    default:
      return `Draft a formal legal request letter for ${place}.`;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"),
        401,
        "generate-request",
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    const rateLimit = checkRateLimit(`generate-request:${user.id}`, 20, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    validateRequestBody(body, ["caseId", "requestCategory", "recordsSought"]);

    const caseId = validateUUID(body.caseId as string, "caseId");
    const requestCategory = validateEnum(
      body.requestCategory as string,
      "requestCategory",
      [...REQUEST_CATEGORIES]
    ) as RequestCategory;
    const recordsSought = sanitizeString(body.recordsSought as string, "recordsSought", 8000);
    const requestSubtype = body.requestSubtype ? sanitizeString(body.requestSubtype as string, "requestSubtype", 200) : undefined;
    const jurisdiction = body.jurisdiction ? sanitizeString(body.jurisdiction as string, "jurisdiction", 100) : undefined;
    const jurisdictionName = body.jurisdictionName ? sanitizeString(body.jurisdictionName as string, "jurisdictionName", 200) : undefined;
    const statuteReference = body.statuteReference ? sanitizeString(body.statuteReference as string, "statuteReference", 200) : undefined;
    const recipientName = body.recipientName ? sanitizeString(body.recipientName as string, "recipientName", 300) : undefined;
    const recipientAgency = body.recipientAgency ? sanitizeString(body.recipientAgency as string, "recipientAgency", 300) : undefined;

    // Pull case + context for richer drafting (RLS scopes to the caller).
    const { data: caseRow } = await supabase
      .from("cases")
      .select("name, case_number, case_type, client_name, opposing_party, court")
      .eq("id", caseId)
      .maybeSingle();

    const { data: contextRow } = await supabase
      .from("case_context")
      .select("jurisdiction, court_name, judge_name, opposing_counsel, plaintiffs, defendants")
      .eq("case_id", caseId)
      .maybeSingle();

    const caseContext = [
      caseRow?.name ? `Case: ${caseRow.name}` : "",
      caseRow?.case_number ? `Case No.: ${caseRow.case_number}` : "",
      caseRow?.case_type ? `Case type: ${caseRow.case_type}` : "",
      caseRow?.client_name ? `Client: ${caseRow.client_name}` : "",
      caseRow?.opposing_party ? `Opposing party: ${caseRow.opposing_party}` : "",
      (contextRow?.court_name || caseRow?.court) ? `Court: ${contextRow?.court_name || caseRow?.court}` : "",
      recipientAgency ? `Recipient agency/custodian: ${recipientAgency}` : "",
      recipientName ? `Recipient: ${recipientName}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `You are an experienced litigation attorney drafting formal legal correspondence and process.
${categoryInstructions(requestCategory, requestSubtype, jurisdictionName, statuteReference)}

General requirements:
- Produce a complete, court-/agency-ready document with clear structure and professional tone.
- Use bracketed placeholders (e.g., [DATE], [AGENCY ADDRESS], [ATTORNEY NAME], [BAR NO.]) for information you do not have.
- Do not invent facts, case numbers, or citations beyond the statute provided.
- Output the letter/document body as plain text (no markdown code fences).`;

    const userPrompt = `Case context:
${caseContext || "(minimal context available)"}

Records / relief sought:
${recordsSought}

Draft the document now.`;

    const aiConfig = getDocumentAIProvider();
    const content = await callChatCompletion(
      aiConfig,
      [{ role: "user", content: userPrompt }],
      { temperature: 0.3, systemPrompt }
    );

    return new Response(
      JSON.stringify({
        content,
        statuteReference: statuteReference || null,
        requestCategory,
        requestSubtype: requestSubtype || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-request error:", error);
    return createErrorResponse(error, 500, "generate-request", corsHeaders);
  }
});
