import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Save, Download, Mail, Loader2, FileText } from "lucide-react";
import type { Case } from "@/lib/api";
import {
  generateRequest,
  updateOutboundRequest,
  sendRequestEmail,
  computeResponseDueDate,
  getJurisdiction,
  escapeHtml,
  REQUEST_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_SUBTYPES,
  type OutboundRequest,
  type RequestStatus,
} from "@/lib/outbound-requests-api";
import { JURISDICTIONS } from "@/lib/public-records-jurisdictions";

const STATUSES: RequestStatus[] = [
  "draft",
  "sent",
  "acknowledged",
  "partial",
  "fulfilled",
  "denied",
  "appealed",
  "overdue",
];

interface RequestGeneratorProps {
  request: OutboundRequest;
  activeCase?: Case;
  onSaved: (updated: OutboundRequest) => void;
}

/** Build a printable HTML document for a request (used for PDF print + .doc export). */
function buildRequestHtml(request: OutboundRequest): string {
  const heading = request.title || REQUEST_CATEGORY_LABELS[request.requestCategory];
  const body = escapeHtml(request.generatedContent || "");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
    heading
  )}</title><style>
    body { font-family: 'Times New Roman', serif; margin: 1in; color: #111; line-height: 1.5; }
    h1 { font-size: 16px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 18px; }
    .body { white-space: pre-wrap; font-size: 13px; }
    @media print { body { margin: 1in; } }
  </style></head><body>
    <h1>${escapeHtml(heading)}</h1>
    <div class="meta">
      ${request.recipientAgency ? `<div><strong>To:</strong> ${escapeHtml(request.recipientAgency)}</div>` : ""}
      ${request.recipientName ? `<div><strong>Attn:</strong> ${escapeHtml(request.recipientName)}</div>` : ""}
      ${request.statuteReference ? `<div><strong>Authority:</strong> ${escapeHtml(request.statuteReference)}</div>` : ""}
    </div>
    <div class="body">${body}</div>
  </body></html>`;
}

export function RequestGenerator({ request, activeCase, onSaved }: RequestGeneratorProps) {
  const [draft, setDraft] = useState<OutboundRequest>(request);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setDraft(request);
  }, [request]);

  const set = <K extends keyof OutboundRequest>(key: K, value: OutboundRequest[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const isPublicRecords = draft.requestCategory === "public_records";
  const jurisdiction = getJurisdiction(draft.jurisdiction);

  const handleJurisdictionChange = (code: string) => {
    const jur = getJurisdiction(code);
    setDraft((prev) => ({
      ...prev,
      jurisdiction: code,
      statuteReference: jur?.citation ?? prev.statuteReference,
      responseDueDate: prev.sentDate
        ? computeResponseDueDate(prev.sentDate, code) ?? prev.responseDueDate
        : prev.responseDueDate,
    }));
  };

  const handleSentDateChange = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      sentDate: value,
      responseDueDate:
        value && prev.jurisdiction
          ? computeResponseDueDate(value, prev.jurisdiction) ?? prev.responseDueDate
          : prev.responseDueDate,
    }));
  };

  const handleGenerate = async () => {
    if (!draft.recordsSought?.trim()) {
      toast.error("Describe the records or relief sought first");
      return;
    }
    setIsGenerating(true);
    try {
      const { content, statuteReference } = await generateRequest({
        caseId: draft.case_id,
        requestCategory: draft.requestCategory,
        requestSubtype: draft.requestSubtype || undefined,
        jurisdiction: draft.jurisdiction || undefined,
        jurisdictionName: jurisdiction?.name,
        statuteReference: draft.statuteReference || jurisdiction?.citation,
        recordsSought: draft.recordsSought,
        recipientName: draft.recipientName || undefined,
        recipientAgency: draft.recipientAgency || undefined,
      });
      setDraft((prev) => ({
        ...prev,
        generatedContent: content,
        statuteReference: statuteReference || prev.statuteReference,
      }));
      toast.success("Draft generated — review and edit before sending");
    } catch (err) {
      toast.error("Generation failed. Check that an AI key is configured.");
    } finally {
      setIsGenerating(false);
    }
  };

  const persist = async (overrides: Partial<OutboundRequest> = {}) => {
    const payload: Partial<OutboundRequest> = {
      title: draft.title,
      requestCategory: draft.requestCategory,
      requestSubtype: draft.requestSubtype,
      jurisdiction: draft.jurisdiction,
      statuteReference: draft.statuteReference,
      recipientName: draft.recipientName,
      recipientAgency: draft.recipientAgency,
      recipientEmail: draft.recipientEmail,
      recipientAddress: draft.recipientAddress,
      recordsSought: draft.recordsSought,
      generatedContent: draft.generatedContent,
      status: draft.status,
      sentDate: draft.sentDate,
      responseDueDate: draft.responseDueDate,
      responseDate: draft.responseDate,
      trackingNumber: draft.trackingNumber,
      feeWaiverRequested: draft.feeWaiverRequested,
      notes: draft.notes,
      ...overrides,
    };
    const updated = await updateOutboundRequest(draft.id, payload);
    onSaved(updated);
    return updated;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persist();
      toast.success("Request saved");
    } catch {
      toast.error("Failed to save request");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!draft.generatedContent) {
      toast.error("Generate the request first");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocked — allow popups to print/save as PDF");
      return;
    }
    win.document.write(buildRequestHtml(draft));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  const handleDownloadDoc = () => {
    if (!draft.generatedContent) {
      toast.error("Generate the request first");
      return;
    }
    const blob = new Blob([buildRequestHtml(draft)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (draft.title || "request").replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
    a.href = url;
    a.download = `${safe}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    if (!draft.recipientEmail?.trim()) {
      toast.error("Add a recipient email to send");
      return;
    }
    if (!draft.generatedContent?.trim()) {
      toast.error("Generate the request before sending");
      return;
    }
    setIsSending(true);
    try {
      // Save current edits first so the email reflects them.
      const saved = await persist();
      const sent = await sendRequestEmail(saved);
      onSaved(sent);
      setDraft(sent);
      toast.success("Request sent — deadline added to the case timeline");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkResponded = async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const updated = await persist({ responseDate: today, status: "fulfilled" });
      setDraft(updated);
      toast.success("Marked as responded");
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Request Editor</CardTitle>
          <Badge variant="outline">{REQUEST_CATEGORY_LABELS[draft.requestCategory]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. FOIA Request — Incident Reports"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Subtype</Label>
            <Select
              value={draft.requestSubtype || ""}
              onValueChange={(v) => set("requestSubtype", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_SUBTYPES[draft.requestCategory].map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isPublicRecords && (
            <div className="space-y-2">
              <Label>Jurisdiction</Label>
              <Select value={draft.jurisdiction || ""} onValueChange={handleJurisdictionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {JURISDICTIONS.map((j) => (
                    <SelectItem key={j.code} value={j.code}>
                      {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {isPublicRecords && jurisdiction && (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            <strong>{jurisdiction.statuteName}</strong> — {jurisdiction.citation}. Response window:{" "}
            {jurisdiction.responseDays} {jurisdiction.responseDayType} days
            {jurisdiction.noFixedDeadline ? " (no fixed statutory deadline — estimate)" : ""}.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Recipient / Agency</Label>
            <Input
              value={draft.recipientAgency || ""}
              onChange={(e) => set("recipientAgency", e.target.value)}
              placeholder="Records custodian / agency"
            />
          </div>
          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              type="email"
              value={draft.recipientEmail || ""}
              onChange={(e) => set("recipientEmail", e.target.value)}
              placeholder="records@agency.gov"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Records / Relief Sought</Label>
          <Textarea
            value={draft.recordsSought || ""}
            onChange={(e) => set("recordsSought", e.target.value)}
            placeholder="Describe the records or relief you are requesting..."
            className="min-h-[80px]"
          />
        </div>

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {draft.generatedContent ? "Regenerate Draft" : "Generate Draft"}
        </Button>

        <div className="space-y-2">
          <Label>Draft (editable)</Label>
          <Textarea
            value={draft.generatedContent || ""}
            onChange={(e) => set("generatedContent", e.target.value)}
            placeholder="The generated request will appear here for editing..."
            className="min-h-[220px] font-serif text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => set("status", v as RequestStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {REQUEST_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sent</Label>
            <Input type="date" value={draft.sentDate || ""} onChange={(e) => handleSentDateChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Response Due</Label>
            <Input
              type="date"
              value={draft.responseDueDate || ""}
              onChange={(e) => set("responseDueDate", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadDoc} className="gap-1">
            <Download className="h-4 w-4" />
            .doc
          </Button>
          <Button variant="outline" size="sm" onClick={handleSend} disabled={isSending} className="gap-1">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send
          </Button>
          {draft.status !== "fulfilled" && (
            <Button variant="ghost" size="sm" onClick={handleMarkResponded}>
              Mark responded
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
