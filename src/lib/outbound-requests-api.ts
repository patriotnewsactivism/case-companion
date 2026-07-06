import { supabase } from "@/integrations/supabase/client";
import {
  computeResponseDueDate,
  getJurisdiction,
} from "./public-records-jurisdictions";

export type RequestCategory =
  | "public_records"
  | "discovery_demand"
  | "preservation_letter"
  | "subpoena";

export type RequestStatus =
  | "draft"
  | "sent"
  | "acknowledged"
  | "partial"
  | "fulfilled"
  | "denied"
  | "appealed"
  | "overdue";

interface OutboundRequestRow {
  id: string;
  case_id: string;
  user_id: string;
  request_category: RequestCategory;
  request_subtype: string | null;
  jurisdiction: string | null;
  statute_reference: string | null;
  title: string | null;
  recipient_name: string | null;
  recipient_agency: string | null;
  recipient_email: string | null;
  recipient_address: string | null;
  records_sought: string | null;
  generated_content: string | null;
  status: RequestStatus;
  sent_date: string | null;
  response_due_date: string | null;
  response_date: string | null;
  fee_amount: number | null;
  fee_waiver_requested: boolean | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutboundRequest {
  id: string;
  case_id: string;
  user_id: string;
  requestCategory: RequestCategory;
  requestSubtype: string | null;
  jurisdiction: string | null;
  statuteReference: string | null;
  title: string;
  recipientName: string | null;
  recipientAgency: string | null;
  recipientEmail: string | null;
  recipientAddress: string | null;
  recordsSought: string | null;
  generatedContent: string | null;
  status: RequestStatus;
  sentDate: string | null;
  responseDueDate: string | null;
  responseDate: string | null;
  feeAmount: number | null;
  feeWaiverRequested: boolean;
  trackingNumber: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestDeadline {
  id: string;
  title: string;
  requestCategory: RequestCategory;
  jurisdiction: string | null;
  sentDate: string | null;
  dueDate: string;
  daysRemaining: number;
  status: "upcoming" | "due_today" | "overdue";
}

function mapRow(row: OutboundRequestRow): OutboundRequest {
  return {
    id: row.id,
    case_id: row.case_id,
    user_id: row.user_id,
    requestCategory: row.request_category,
    requestSubtype: row.request_subtype,
    jurisdiction: row.jurisdiction,
    statuteReference: row.statute_reference,
    title: row.title || "",
    recipientName: row.recipient_name,
    recipientAgency: row.recipient_agency,
    recipientEmail: row.recipient_email,
    recipientAddress: row.recipient_address,
    recordsSought: row.records_sought,
    generatedContent: row.generated_content,
    status: row.status,
    sentDate: row.sent_date,
    responseDueDate: row.response_due_date,
    responseDate: row.response_date,
    feeAmount: row.fee_amount,
    feeWaiverRequested: !!row.fee_waiver_requested,
    trackingNumber: row.tracking_number,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapUpdatesToRow(updates: Partial<OutboundRequest>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if ("requestCategory" in updates) m.request_category = updates.requestCategory;
  if ("requestSubtype" in updates) m.request_subtype = updates.requestSubtype;
  if ("jurisdiction" in updates) m.jurisdiction = updates.jurisdiction;
  if ("statuteReference" in updates) m.statute_reference = updates.statuteReference;
  if ("title" in updates) m.title = updates.title;
  if ("recipientName" in updates) m.recipient_name = updates.recipientName;
  if ("recipientAgency" in updates) m.recipient_agency = updates.recipientAgency;
  if ("recipientEmail" in updates) m.recipient_email = updates.recipientEmail;
  if ("recipientAddress" in updates) m.recipient_address = updates.recipientAddress;
  if ("recordsSought" in updates) m.records_sought = updates.recordsSought;
  if ("generatedContent" in updates) m.generated_content = updates.generatedContent;
  if ("status" in updates) m.status = updates.status;
  if ("sentDate" in updates) m.sent_date = updates.sentDate;
  if ("responseDueDate" in updates) m.response_due_date = updates.responseDueDate;
  if ("responseDate" in updates) m.response_date = updates.responseDate;
  if ("feeAmount" in updates) m.fee_amount = updates.feeAmount;
  if ("feeWaiverRequested" in updates) m.fee_waiver_requested = updates.feeWaiverRequested;
  if ("trackingNumber" in updates) m.tracking_number = updates.trackingNumber;
  if ("notes" in updates) m.notes = updates.notes;
  return m;
}

// ─── CRUD ──────────────────────────────────────────────────────

export async function createOutboundRequest(
  caseId: string,
  data: Partial<OutboundRequest>
): Promise<OutboundRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    case_id: caseId,
    user_id: user.id,
    request_category: data.requestCategory || "public_records",
    request_subtype: data.requestSubtype || null,
    jurisdiction: data.jurisdiction || null,
    statute_reference: data.statuteReference || null,
    title: data.title || "Untitled Request",
    recipient_name: data.recipientName || null,
    recipient_agency: data.recipientAgency || null,
    recipient_email: data.recipientEmail || null,
    recipient_address: data.recipientAddress || null,
    records_sought: data.recordsSought || null,
    generated_content: data.generatedContent || null,
    status: data.status || "draft",
    sent_date: data.sentDate || null,
    response_due_date: data.responseDueDate || null,
    response_date: data.responseDate || null,
    fee_amount: data.feeAmount ?? null,
    fee_waiver_requested: data.feeWaiverRequested ?? false,
    tracking_number: data.trackingNumber || null,
    notes: data.notes || null,
  };

  const { data: result, error } = await supabase
    .from("outbound_requests")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  const created = mapRow(result as unknown as OutboundRequestRow);
  await syncRequestTimeline(created);
  return created;
}

export async function getOutboundRequests(caseId: string): Promise<OutboundRequest[]> {
  const { data, error } = await supabase
    .from("outbound_requests")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data as unknown as OutboundRequestRow[]) || []).map(mapRow);
}

export async function getOutboundRequest(id: string): Promise<OutboundRequest | null> {
  const { data, error } = await supabase
    .from("outbound_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as unknown as OutboundRequestRow) : null;
}

export async function updateOutboundRequest(
  id: string,
  updates: Partial<OutboundRequest>
): Promise<OutboundRequest> {
  const { data, error } = await supabase
    .from("outbound_requests")
    .update(mapUpdatesToRow(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  const updated = mapRow(data as unknown as OutboundRequestRow);
  await syncRequestTimeline(updated);
  return updated;
}

export async function deleteOutboundRequest(id: string): Promise<void> {
  const { error } = await supabase.from("outbound_requests").delete().eq("id", id);
  if (error) throw error;
}

// ─── AI generation ─────────────────────────────────────────────

export interface GenerateRequestInput {
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

export async function generateRequest(
  input: GenerateRequestInput
): Promise<{ content: string; statuteReference: string | null }> {
  const { data, error } = await supabase.functions.invoke("generate-request", {
    body: input,
  });
  if (error) throw error;
  return { content: data.content, statuteReference: data.statuteReference ?? null };
}

// ─── Email delivery ────────────────────────────────────────────

/**
 * Email a request to its recipient, mark it sent, compute the statutory
 * response deadline, and sync the case timeline.
 */
export async function sendRequestEmail(request: OutboundRequest): Promise<OutboundRequest> {
  if (!request.recipientEmail) throw new Error("No recipient email on this request");
  if (!request.generatedContent) throw new Error("Nothing to send — generate the request first");

  const subject = request.title || REQUEST_CATEGORY_LABELS[request.requestCategory];
  const html = `<div style="font-family: 'Times New Roman', serif; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(
    request.generatedContent
  )}</div>`;

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      to: request.recipientEmail,
      subject,
      html,
      case_id: request.case_id,
      message_type: "outbound_request",
    },
  });
  if (error) throw error;

  const sentDate = request.sentDate || new Date().toISOString().slice(0, 10);
  const responseDueDate =
    request.responseDueDate || computeResponseDueDate(sentDate, request.jurisdiction);

  return updateOutboundRequest(request.id, {
    status: "sent",
    sentDate,
    responseDueDate: responseDueDate || undefined,
  });
}

// ─── Deadlines ─────────────────────────────────────────────────

export async function getUpcomingRequestDeadlines(caseId: string): Promise<RequestDeadline[]> {
  const { data, error } = await supabase
    .from("outbound_requests")
    .select("id, title, request_category, jurisdiction, sent_date, response_due_date, status")
    .eq("case_id", caseId)
    .not("response_due_date", "is", null)
    .in("status", ["sent", "acknowledged", "partial", "appealed"]);

  if (error) throw error;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const rows = (data as unknown as Array<{
    id: string;
    title: string | null;
    request_category: RequestCategory;
    jurisdiction: string | null;
    sent_date: string | null;
    response_due_date: string;
  }> | null) || [];

  const deadlines: RequestDeadline[] = rows.map((r) => {
    const due = new Date(`${r.response_due_date}T00:00:00`);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const status: RequestDeadline["status"] =
      diffDays < 0 ? "overdue" : diffDays === 0 ? "due_today" : "upcoming";
    return {
      id: r.id,
      title: r.title || REQUEST_CATEGORY_LABELS[r.request_category],
      requestCategory: r.request_category,
      jurisdiction: r.jurisdiction,
      sentDate: r.sent_date,
      dueDate: r.response_due_date,
      daysRemaining: diffDays,
      status,
    };
  });

  return deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ─── Smart timeline integration ────────────────────────────────

/**
 * Keep the case timeline in sync with a request's lifecycle. Emits up to three
 * events (sent / response-due / responded) tagged with source_request_id, and
 * replaces any prior events for this request so re-syncs stay idempotent.
 * These events flow into the unified smart timeline alongside document-derived
 * events; timeline synthesis dedupes and orders them.
 */
export async function syncRequestTimeline(request: OutboundRequest): Promise<void> {
  try {
    // Clear prior events for this request, then re-derive from current state.
    await supabase.from("timeline_events").delete().eq("source_request_id", request.id);

    const label = REQUEST_CATEGORY_LABELS[request.requestCategory];
    const who = request.recipientAgency || request.recipientName || "recipient";
    const events: Array<Record<string, unknown>> = [];

    if (request.sentDate) {
      events.push({
        case_id: request.case_id,
        user_id: request.user_id,
        source_request_id: request.id,
        title: `${label} sent to ${who}`,
        description: request.title || request.recordsSought || label,
        event_date: request.sentDate,
        event_type: request.requestCategory === "subpoena" ? "filing" : "communication",
        importance: "medium",
        event_category: "request",
        is_ai_generated: false,
      });
    }

    if (request.responseDueDate && request.status !== "fulfilled" && request.status !== "denied") {
      const statuteNote = request.statuteReference
        ? ` (${request.statuteReference})`
        : "";
      events.push({
        case_id: request.case_id,
        user_id: request.user_id,
        source_request_id: request.id,
        title: `Response due: ${request.title || label}`,
        description: `Statutory response deadline${statuteNote} for ${label} to ${who}.`,
        event_date: request.responseDueDate,
        event_type: "deadline",
        importance: "high",
        event_category: "deadline",
        is_ai_generated: false,
        next_required_action: "Follow up with the custodian or prepare an appeal if no response.",
      });
    }

    if (request.responseDate) {
      const outcome =
        request.status === "denied"
          ? "denied"
          : request.status === "partial"
          ? "partially fulfilled"
          : "responded to";
      events.push({
        case_id: request.case_id,
        user_id: request.user_id,
        source_request_id: request.id,
        title: `${label} ${outcome} by ${who}`,
        description: request.notes || `${who} ${outcome} the ${label}.`,
        event_date: request.responseDate,
        event_type: "communication",
        importance: request.status === "denied" ? "high" : "medium",
        event_category: "request",
        is_ai_generated: false,
      });
    }

    if (events.length > 0) {
      await supabase.from("timeline_events").insert(events);
    }
  } catch (err) {
    // Timeline sync is best-effort; never block the primary request operation.
    console.error("syncRequestTimeline failed:", err);
  }
}

// ─── Display metadata ──────────────────────────────────────────

export const REQUEST_CATEGORY_LABELS: Record<RequestCategory, string> = {
  public_records: "Public Records / FOIA Request",
  discovery_demand: "Discovery Demand",
  preservation_letter: "Preservation Letter",
  subpoena: "Third-Party Subpoena",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  acknowledged: "Acknowledged",
  partial: "Partial Response",
  fulfilled: "Fulfilled",
  denied: "Denied",
  appealed: "Appealed",
  overdue: "Overdue",
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  acknowledged: "bg-indigo-100 text-indigo-800 border-indigo-200",
  partial: "bg-amber-100 text-amber-800 border-amber-200",
  fulfilled: "bg-green-100 text-green-800 border-green-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  appealed: "bg-purple-100 text-purple-800 border-purple-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
};

export const REQUEST_SUBTYPES: Record<RequestCategory, { value: string; label: string }[]> = {
  public_records: [
    { value: "foia_federal", label: "Federal FOIA Request" },
    { value: "state_public_records", label: "State Public-Records Request" },
  ],
  discovery_demand: [
    { value: "interrogatories", label: "Interrogatories" },
    { value: "rfp", label: "Requests for Production" },
    { value: "rfa", label: "Requests for Admission" },
  ],
  preservation_letter: [
    { value: "litigation_hold", label: "Litigation Hold / Preservation" },
  ],
  subpoena: [
    { value: "subpoena_duces_tecum", label: "Subpoena Duces Tecum (Documents)" },
    { value: "subpoena_testimony", label: "Subpoena for Testimony" },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Re-export for convenience in UI. */
export { computeResponseDueDate, getJurisdiction };
