import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
} from "../_shared/errorHandler.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { validateUUID, validateEnum } from "../_shared/validation.ts";

const EXPORT_TYPES = [
  "pdf_brief",
  "csv_billing",
  "docx_filing",
  "pdf_case_summary",
  "csv_documents",
] as const;

type ExportType = typeof EXPORT_TYPES[number];

interface ExportRequest {
  caseId: string;
  exportType: ExportType;
  options?: Record<string, unknown>;
}

/**
 * Escape a value for safe CSV output
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from an array of row objects
 */
function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvValue(row[h])).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Generate HTML case summary suitable for browser PDF export
 */
function generateCaseSummaryHtml(
  caseData: Record<string, unknown>,
  documents: Record<string, unknown>[],
  timelineEvents: Record<string, unknown>[],
  briefs: Record<string, unknown>[]
): string {
  const docRows = documents
    .map(
      (d) =>
        `<tr>
          <td>${d.bates_number || "N/A"}</td>
          <td>${d.name || "Untitled"}</td>
          <td>${d.document_type || "Unknown"}</td>
          <td>${d.summary || ""}</td>
        </tr>`
    )
    .join("");

  const timelineRows = timelineEvents
    .map(
      (e) =>
        `<tr>
          <td>${e.event_date || ""}</td>
          <td>${e.title || ""}</td>
          <td>${e.description || ""}</td>
          <td>${e.importance || ""}</td>
        </tr>`
    )
    .join("");

  const briefSections = briefs
    .map(
      (b) =>
        `<div class="brief">
          <h3>${b.title || "Untitled Brief"}</h3>
          <p><strong>Status:</strong> ${b.status || "draft"}</p>
          <div>${b.content || ""}</div>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Case Summary - ${caseData.name || "Untitled Case"}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; color: #1a1a2e; line-height: 1.6; }
    h1 { color: #16213e; border-bottom: 2px solid #c9a227; padding-bottom: 10px; }
    h2 { color: #16213e; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
    th { background-color: #16213e; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .meta { color: #555; font-size: 14px; margin-bottom: 5px; }
    .brief { border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Case Summary: ${caseData.name || "Untitled Case"}</h1>
  <p class="meta"><strong>Case Number:</strong> ${caseData.case_number || "N/A"}</p>
  <p class="meta"><strong>Status:</strong> ${caseData.status || "N/A"}</p>
  <p class="meta"><strong>Case Type:</strong> ${caseData.case_type || "N/A"}</p>
  <p class="meta"><strong>Client:</strong> ${caseData.client_name || "N/A"}</p>
  <p class="meta"><strong>Opposing Party:</strong> ${caseData.opposing_party || "N/A"}</p>
  <p class="meta"><strong>Court:</strong> ${caseData.court || "N/A"}</p>
  <p class="meta"><strong>Judge:</strong> ${caseData.judge || "N/A"}</p>
  <p class="meta"><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

  ${caseData.case_theory ? `<h2>Case Theory</h2><p>${caseData.case_theory}</p>` : ""}

  ${
    Array.isArray(caseData.key_issues) && caseData.key_issues.length > 0
      ? `<h2>Key Issues</h2><ul>${(caseData.key_issues as string[]).map((i) => `<li>${i}</li>`).join("")}</ul>`
      : ""
  }

  ${
    Array.isArray(caseData.winning_factors) && caseData.winning_factors.length > 0
      ? `<h2>Winning Factors</h2><ul>${(caseData.winning_factors as string[]).map((f) => `<li>${f}</li>`).join("")}</ul>`
      : ""
  }

  <h2>Documents (${documents.length})</h2>
  ${
    documents.length > 0
      ? `<table>
          <thead><tr><th>Bates #</th><th>Name</th><th>Type</th><th>Summary</th></tr></thead>
          <tbody>${docRows}</tbody>
        </table>`
      : "<p>No documents on file.</p>"
  }

  <h2>Timeline Events (${timelineEvents.length})</h2>
  ${
    timelineEvents.length > 0
      ? `<table>
          <thead><tr><th>Date</th><th>Title</th><th>Description</th><th>Importance</th></tr></thead>
          <tbody>${timelineRows}</tbody>
        </table>`
      : "<p>No timeline events recorded.</p>"
  }

  ${
    briefs.length > 0
      ? `<h2>Legal Briefs (${briefs.length})</h2>${briefSections}`
      : ""
  }

  <div class="footer">
    <p>Generated by CaseBuddy Professional &mdash; ${new Date().toISOString()}</p>
    <p>This document is confidential and intended for authorized use only.</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

    // Authenticate user
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"),
        401,
        "export-document",
        corsHeaders
      );
    }

    const body: ExportRequest = await req.json();
    const { caseId, exportType, options } = body;

    // Validate inputs
    if (!caseId || !exportType) {
      return new Response(
        JSON.stringify({ error: "caseId and exportType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    validateUUID(caseId, "caseId");
    validateEnum(exportType, "exportType", [...EXPORT_TYPES]);

    const userId = authResult.user.id;

    // Use service role client for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Verify case ownership
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .eq("user_id", userId)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: "Case not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create export job record
    const { data: exportJob, error: jobError } = await supabase
      .from("export_jobs")
      .insert({
        case_id: caseId,
        user_id: userId,
        export_type: exportType,
        status: "processing",
        options: options || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create export job:", jobError);
      // Continue even if job tracking fails - the export itself is more important
    }

    const jobId = exportJob?.id;

    try {
      let result: Response;

      switch (exportType) {
        case "csv_documents": {
          result = await handleCsvDocuments(supabase, caseId, caseData, corsHeaders);
          break;
        }
        case "csv_billing": {
          result = await handleCsvBilling(supabase, caseId, caseData, corsHeaders);
          break;
        }
        case "pdf_case_summary": {
          result = await handlePdfCaseSummary(supabase, caseId, caseData, corsHeaders);
          break;
        }
        case "pdf_brief": {
          result = await handlePdfBrief(supabase, caseId, caseData, options, corsHeaders);
          break;
        }
        case "docx_filing": {
          result = await handleDocxFiling(supabase, caseId, caseData, options, corsHeaders);
          break;
        }
        default: {
          result = new Response(
            JSON.stringify({ error: `Unsupported export type: ${exportType}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update export job to completed
      if (jobId) {
        await supabase
          .from("export_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", jobId);
      }

      return result;
    } catch (exportError) {
      // Update export job to failed
      if (jobId) {
        await supabase
          .from("export_jobs")
          .update({
            status: "failed",
            error_message: exportError instanceof Error ? exportError.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
      throw exportError;
    }
  } catch (e) {
    console.error("export-document error:", e);
    return createErrorResponse(e, 500, "export-document", corsHeaders);
  }
});

// --- Export handlers ---

async function handleCsvDocuments(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  caseData: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

  const headers = [
    "bates_number",
    "name",
    "document_type",
    "summary",
    "key_facts",
    "favorable_findings",
    "adverse_findings",
    "action_items",
    "ai_analyzed",
    "created_at",
  ];

  const rows = (documents || []).map((doc: Record<string, unknown>) => ({
    bates_number: doc.bates_number || "",
    name: doc.name || "",
    document_type: doc.document_type || "",
    summary: doc.summary || "",
    key_facts: Array.isArray(doc.key_facts) ? (doc.key_facts as string[]).join("; ") : "",
    favorable_findings: Array.isArray(doc.favorable_findings)
      ? (doc.favorable_findings as string[]).join("; ")
      : "",
    adverse_findings: Array.isArray(doc.adverse_findings)
      ? (doc.adverse_findings as string[]).join("; ")
      : "",
    action_items: Array.isArray(doc.action_items)
      ? (doc.action_items as string[]).join("; ")
      : "",
    ai_analyzed: doc.ai_analyzed ? "Yes" : "No",
    created_at: doc.created_at || "",
  }));

  const csv = buildCsv(headers, rows);
  const filename = `${(caseData.case_number as string) || "case"}_documents_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function handleCsvBilling(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  caseData: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Fetch time entries for the case
  const { data: timeEntries, error: teError } = await supabase
    .from("time_entries")
    .select("*")
    .eq("case_id", caseId)
    .order("entry_date", { ascending: true });

  // Fetch invoices for the case
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  // Build time entries CSV section
  const teHeaders = [
    "entry_date",
    "description",
    "hours",
    "rate",
    "amount",
    "billing_code",
    "attorney",
    "status",
  ];

  const teRows = (timeEntries || []).map((te: Record<string, unknown>) => ({
    entry_date: te.entry_date || "",
    description: te.description || "",
    hours: te.hours || 0,
    rate: te.rate || 0,
    amount: te.amount || ((te.hours as number) || 0) * ((te.rate as number) || 0),
    billing_code: te.billing_code || "",
    attorney: te.attorney_name || "",
    status: te.status || "",
  }));

  // Build invoices CSV section
  const invHeaders = [
    "invoice_number",
    "invoice_date",
    "due_date",
    "total_amount",
    "paid_amount",
    "status",
    "notes",
  ];

  const invRows = (invoices || []).map((inv: Record<string, unknown>) => ({
    invoice_number: inv.invoice_number || "",
    invoice_date: inv.invoice_date || inv.created_at || "",
    due_date: inv.due_date || "",
    total_amount: inv.total_amount || 0,
    paid_amount: inv.paid_amount || 0,
    status: inv.status || "",
    notes: inv.notes || "",
  }));

  // Combine both sections into a single CSV with section headers
  let csv = `Billing Report - ${caseData.name || "Case"}\r\n`;
  csv += `Generated: ${new Date().toISOString()}\r\n\r\n`;
  csv += `TIME ENTRIES\r\n`;
  csv += buildCsv(teHeaders, teRows);
  csv += `\r\n\r\nINVOICES\r\n`;
  csv += buildCsv(invHeaders, invRows);

  // Add summary totals
  const totalHours = teRows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const totalBilled = teRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalInvoiced = invRows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const totalPaid = invRows.reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);

  csv += `\r\n\r\nSUMMARY\r\n`;
  csv += `Total Hours,${totalHours}\r\n`;
  csv += `Total Billed,${totalBilled.toFixed(2)}\r\n`;
  csv += `Total Invoiced,${totalInvoiced.toFixed(2)}\r\n`;
  csv += `Total Paid,${totalPaid.toFixed(2)}\r\n`;
  csv += `Outstanding,${(totalInvoiced - totalPaid).toFixed(2)}\r\n`;

  const filename = `${(caseData.case_number as string) || "case"}_billing_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function handlePdfCaseSummary(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  caseData: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Fetch all related data in parallel
  const [
    { data: documents },
    { data: timelineEvents },
    { data: briefs },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("timeline_events")
      .select("*")
      .eq("case_id", caseId)
      .order("event_date", { ascending: true }),
    supabase
      .from("legal_briefs")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
  ]);

  const htmlContent = generateCaseSummaryHtml(
    caseData,
    documents || [],
    timelineEvents || [],
    briefs || []
  );

  // Return both HTML for browser rendering and structured JSON data
  return new Response(
    JSON.stringify({
      success: true,
      exportType: "pdf_case_summary",
      caseName: caseData.name,
      htmlContent,
      structuredData: {
        case: caseData,
        documents: documents || [],
        timelineEvents: timelineEvents || [],
        briefs: briefs || [],
        generatedAt: new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handlePdfBrief(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  caseData: Record<string, unknown>,
  options: Record<string, unknown> | undefined,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // If a specific brief ID is provided, fetch just that brief
  const briefId = options?.briefId as string | undefined;

  let briefs;
  if (briefId) {
    const { data, error } = await supabase
      .from("legal_briefs")
      .select("*")
      .eq("id", briefId)
      .eq("case_id", caseId)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Brief not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    briefs = [data];
  } else {
    const { data, error } = await supabase
      .from("legal_briefs")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to fetch briefs: ${error.message}`);
    briefs = data || [];
  }

  const briefData = briefs.map((b: Record<string, unknown>) => ({
    id: b.id,
    title: b.title || "Untitled Brief",
    briefType: b.brief_type || "general",
    status: b.status || "draft",
    content: b.content || "",
    sections: b.sections || [],
    court: b.court || caseData.court || "",
    caseCaption: `${caseData.client_name || "Plaintiff"} v. ${caseData.opposing_party || "Defendant"}`,
    caseNumber: caseData.case_number || "",
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  }));

  return new Response(
    JSON.stringify({
      success: true,
      exportType: "pdf_brief",
      caseName: caseData.name,
      briefs: briefData,
      generatedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleDocxFiling(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  caseData: Record<string, unknown>,
  options: Record<string, unknown> | undefined,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Fetch case-related data for the filing
  const { data: briefs } = await supabase
    .from("legal_briefs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestBrief = briefs?.[0] || null;

  // Build structured filing data
  const filingData = {
    caseCaption: {
      court: (options?.court as string) || caseData.court || "SUPERIOR COURT",
      jurisdiction: (options?.jurisdiction as string) || caseData.jurisdiction || "",
      plaintiff: caseData.client_name || "Plaintiff",
      defendant: caseData.opposing_party || "Defendant",
      caseNumber: caseData.case_number || "",
      documentTitle: (options?.filingTitle as string) || "MOTION",
    },
    body: {
      introduction: (options?.introduction as string) ||
        latestBrief?.content ||
        "",
      sections: (options?.sections as Record<string, unknown>[]) ||
        latestBrief?.sections ||
        [],
      arguments: (options?.arguments as string[]) || [],
      conclusion: (options?.conclusion as string) || "",
      relief: (options?.relief as string) || "",
    },
    signatureBlock: {
      firmName: (options?.firmName as string) || "",
      attorneyName: (options?.attorneyName as string) || "",
      barNumber: (options?.barNumber as string) || "",
      address: (options?.address as string) || "",
      phone: (options?.phone as string) || "",
      email: (options?.email as string) || "",
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    certificateOfService: {
      servedParties: (options?.servedParties as string[]) || [],
      serviceMethod: (options?.serviceMethod as string) || "electronic filing",
      serviceDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  };

  return new Response(
    JSON.stringify({
      success: true,
      exportType: "docx_filing",
      caseName: caseData.name,
      filing: filingData,
      generatedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
