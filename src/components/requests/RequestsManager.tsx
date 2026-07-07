import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FileSearch } from "lucide-react";
import type { Case } from "@/lib/api";
import {
  getOutboundRequests,
  getUpcomingRequestDeadlines,
  createOutboundRequest,
  getJurisdiction,
  REQUEST_CATEGORY_LABELS,
  REQUEST_SUBTYPES,
  type OutboundRequest,
  type RequestCategory,
  type RequestDeadline,
} from "@/lib/outbound-requests-api";
import { JURISDICTIONS } from "@/lib/public-records-jurisdictions";
import { RequestsList } from "./RequestsList";
import { RequestGenerator } from "./RequestGenerator";
import { RequestDeadlineAlerts } from "./RequestDeadlineAlerts";

interface RequestsManagerProps {
  cases: Case[];
  selectedCaseId?: string;
}

const CATEGORY_OPTIONS: RequestCategory[] = [
  "public_records",
  "discovery_demand",
  "preservation_letter",
  "subpoena",
];

const EMPTY_NEW = {
  title: "",
  requestCategory: "public_records" as RequestCategory,
  requestSubtype: "",
  jurisdiction: "",
  recipientAgency: "",
  recipientEmail: "",
  recordsSought: "",
};

export function RequestsManager({ cases, selectedCaseId }: RequestsManagerProps) {
  const [activeCaseId, setActiveCaseId] = useState<string>(selectedCaseId || cases[0]?.id || "");
  const [requests, setRequests] = useState<OutboundRequest[]>([]);
  const [deadlines, setDeadlines] = useState<RequestDeadline[]>([]);
  const [selected, setSelected] = useState<OutboundRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ ...EMPTY_NEW });

  const activeCase = cases.find((c) => c.id === activeCaseId);

  const loadData = useCallback(async () => {
    if (!activeCaseId) return;
    setIsLoading(true);
    try {
      const [requestsData, deadlinesData] = await Promise.all([
        getOutboundRequests(activeCaseId),
        getUpcomingRequestDeadlines(activeCaseId),
      ]);
      setRequests(requestsData);
      setDeadlines(deadlinesData);
      // Keep the selected request in sync with fresh data.
      setSelected((prev) => (prev ? requestsData.find((r) => r.id === prev.id) ?? null : null));
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  }, [activeCaseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedCaseId && selectedCaseId !== activeCaseId) {
      setActiveCaseId(selectedCaseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId]);

  const handleCaseChange = (caseId: string) => {
    setActiveCaseId(caseId);
    setSelected(null);
  };

  const handleSaved = (updated: OutboundRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected(updated);
    // Refresh deadlines (status/date changes affect them).
    getUpcomingRequestDeadlines(activeCaseId).then(setDeadlines).catch(() => {});
  };

  const handleCreate = async () => {
    if (!activeCaseId) {
      toast.error("Select a case first");
      return;
    }
    if (!newRequest.recordsSought.trim()) {
      toast.error("Describe the records or relief sought");
      return;
    }
    try {
      const jur = getJurisdiction(newRequest.jurisdiction);
      const created = await createOutboundRequest(activeCaseId, {
        title:
          newRequest.title.trim() ||
          `${REQUEST_CATEGORY_LABELS[newRequest.requestCategory]}${
            newRequest.recipientAgency ? ` — ${newRequest.recipientAgency}` : ""
          }`,
        requestCategory: newRequest.requestCategory,
        requestSubtype: newRequest.requestSubtype || undefined,
        jurisdiction: newRequest.jurisdiction || undefined,
        statuteReference: jur?.citation,
        recipientAgency: newRequest.recipientAgency || undefined,
        recipientEmail: newRequest.recipientEmail || undefined,
        recordsSought: newRequest.recordsSought,
        status: "draft",
      });
      await loadData();
      setSelected(created);
      setIsNewOpen(false);
      setNewRequest({ ...EMPTY_NEW });
      toast.success("Request created — generate the draft on the right");
    } catch {
      toast.error("Failed to create request");
    }
  };

  const handleDeadlineSelect = (id: string) => {
    const r = requests.find((x) => x.id === id);
    if (r) setSelected(r);
  };

  const isPublicRecords = newRequest.requestCategory === "public_records";

  if (cases.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <FileSearch className="mb-3 h-10 w-10" />
          <p>Create a case first to start drafting records requests.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={activeCaseId} onValueChange={handleCaseChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a case" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.client_name ? ` — ${c.client_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">{requests.length} requests</Badge>
        </div>

        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Outbound Request</DialogTitle>
              <DialogDescription>
                Create a request to track. You’ll generate and edit the draft next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newRequest.requestCategory}
                    onValueChange={(v) =>
                      setNewRequest((p) => ({
                        ...p,
                        requestCategory: v as RequestCategory,
                        requestSubtype: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {REQUEST_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subtype</Label>
                  <Select
                    value={newRequest.requestSubtype}
                    onValueChange={(v) => setNewRequest((p) => ({ ...p, requestSubtype: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_SUBTYPES[newRequest.requestCategory].map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isPublicRecords && (
                <div className="space-y-2">
                  <Label>Jurisdiction</Label>
                  <Select
                    value={newRequest.jurisdiction}
                    onValueChange={(v) => setNewRequest((p) => ({ ...p, jurisdiction: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select jurisdiction" />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recipient / Agency</Label>
                  <Input
                    value={newRequest.recipientAgency}
                    onChange={(e) => setNewRequest((p) => ({ ...p, recipientAgency: e.target.value }))}
                    placeholder="Records custodian"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recipient Email</Label>
                  <Input
                    type="email"
                    value={newRequest.recipientEmail}
                    onChange={(e) => setNewRequest((p) => ({ ...p, recipientEmail: e.target.value }))}
                    placeholder="records@agency.gov"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Records / Relief Sought *</Label>
                <Textarea
                  value={newRequest.recordsSought}
                  onChange={(e) => setNewRequest((p) => ({ ...p, recordsSought: e.target.value }))}
                  placeholder="Describe the records or relief being requested..."
                  className="min-h-[90px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <RequestDeadlineAlerts deadlines={deadlines} onSelect={handleDeadlineSelect} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <RequestsList
            requests={requests}
            selectedId={selected?.id}
            isLoading={isLoading}
            onSelect={setSelected}
          />
        </div>
        <div className="lg:col-span-7">
          {selected ? (
            <div className="sticky top-20">
              <RequestGenerator request={selected} activeCase={activeCase} onSaved={handleSaved} />
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileSearch className="mb-3 h-10 w-10" />
                <p>Select a request to generate, edit, export, or send it.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
