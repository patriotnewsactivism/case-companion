import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Plus,
  FileSearch,
  Calendar,
  Loader2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import type { Case } from "@/lib/api";
import type { DiscoveryRequest, DiscoveryDeadline, DiscoveryType, DiscoveryStatus } from "@/lib/discovery-api";
import {
  getDiscoveryRequests,
  getUpcomingDeadlines,
  createDiscoveryRequest,
  updateDiscoveryRequest,
  deleteDiscoveryRequest,
  generateResponse,
  bulkUpdateStatus,
  DISCOVERY_TYPE_LABELS,
} from "@/lib/discovery-api";
import { DiscoveryTimeline } from "./DiscoveryTimeline";
import { DiscoveryList } from "./DiscoveryList";
import { DiscoveryRequestCard } from "./DiscoveryRequestCard";
import { ResponseGenerator } from "./ResponseGenerator";
import { DeadlineAlerts } from "./DeadlineAlerts";

interface DiscoveryManagerProps {
  cases: Case[];
  selectedCaseId?: string;
  onCaseChange?: (caseId: string) => void;
}

export function DiscoveryManager({
  cases,
  selectedCaseId,
  onCaseChange,
}: DiscoveryManagerProps) {
  const [activeCaseId, setActiveCaseId] = useState<string>(selectedCaseId || cases[0]?.id || '');
  const [requests, setRequests] = useState<DiscoveryRequest[]>([]);
  const [deadlines, setDeadlines] = useState<DiscoveryDeadline[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DiscoveryRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<DiscoveryType | 'all'>('all');
  
  const [newRequest, setNewRequest] = useState({
    requestType: 'interrogatory' as DiscoveryType,
    requestNumber: '',
    question: '',
    servedDate: '',
    responseDueDate: '',
    notes: '',
  });

  const activeCase = cases.find(c => c.id === activeCaseId);

  const loadData = async () => {
    if (!activeCaseId) return;
    setIsLoading(true);
    try {
      const [requestsData, deadlinesData] = await Promise.all([
        getDiscoveryRequests(activeCaseId),
        getUpcomingDeadlines(activeCaseId),
      ]);
      setRequests(requestsData);
      setDeadlines(deadlinesData);
    } catch (error) {
      toast.error("Failed to load discovery data");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [activeCaseId]);

  React.useEffect(() => {
    if (selectedCaseId && selectedCaseId !== activeCaseId) {
      setActiveCaseId(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleCaseChange = (caseId: string) => {
    setActiveCaseId(caseId);
    setSelectedRequest(null);
    onCaseChange?.(caseId);
  };

  const handleSelectRequest = (request: DiscoveryRequest) => {
    setSelectedRequest(request);
    setShowRightPanel(true);
  };

  const handleUpdateRequest = async (id: string, updates: Partial<DiscoveryRequest>) => {
    try {
      const updated = await updateDiscoveryRequest(id, updates);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      if (selectedRequest?.id === id) {
        setSelectedRequest(updated);
      }
      await loadData();
      toast.success("Request updated");
    } catch (error) {
      toast.error("Failed to update request");
    }
  };

  const handleGenerateResponse = async (requestId: string): Promise<string> => {
    try {
      const response = await generateResponse(requestId);
      return response;
    } catch (error) {
      throw new Error("Failed to generate response");
    }
  };

  const handleBulkUpdate = async (ids: string[], status: DiscoveryStatus) => {
    try {
      await bulkUpdateStatus(ids, status);
      await loadData();
      toast.success(`Updated ${ids.length} requests`);
    } catch (error) {
      toast.error("Failed to update requests");
    }
  };

  const handleCreateRequest = async () => {
    if (!activeCaseId || !newRequest.requestNumber || !newRequest.question) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await createDiscoveryRequest(activeCaseId, {
        requestType: newRequest.requestType,
        requestNumber: newRequest.requestNumber,
        question: newRequest.question,
        servedDate: newRequest.servedDate || undefined,
        responseDueDate: newRequest.responseDueDate || undefined,
        notes: newRequest.notes || undefined,
      });
      await loadData();
      setIsNewDialogOpen(false);
      setNewRequest({
        requestType: 'interrogatory',
        requestNumber: '',
        question: '',
        servedDate: '',
        responseDueDate: '',
        notes: '',
      });
      toast.success("Request created");
    } catch (error) {
      toast.error("Failed to create request");
    }
  };

  const handleDeadlineClick = (id: string) => {
    const request = requests.find(r => r.id === id);
    if (request) {
      handleSelectRequest(request);
    }
  };

  const handleViewOverdue = () => {
    const overdue = requests.find(r => {
      if (!r.responseDueDate || r.status === 'responded') return false;
      const due = new Date(r.responseDueDate);
      return due < new Date();
    });
    if (overdue) handleSelectRequest(overdue);
  };

  const handleViewDueToday = () => {
    const today = requests.find(r => {
      if (!r.responseDueDate || r.status === 'responded') return false;
      const due = new Date(r.responseDueDate);
      const now = new Date();
      return due.toDateString() === now.toDateString();
    });
    if (today) handleSelectRequest(today);
  };

  const handleViewThisWeek = () => {
    const thisWeek = requests.find(r => {
      if (!r.responseDueDate || r.status === 'responded') return false;
      const due = new Date(r.responseDueDate);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return due >= now && due <= weekFromNow;
    });
    if (thisWeek) handleSelectRequest(thisWeek);
  };

  const filteredDeadlines = useMemo(() => {
    if (timelineFilter === 'all') return deadlines;
    return deadlines.filter(d => d.requestType === timelineFilter);
  }, [deadlines, timelineFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={activeCaseId} onValueChange={handleCaseChange}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a case" />
            </SelectTrigger>
            <SelectContent>
              {cases.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} - {c.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">
            {requests.length} requests
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Add Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Discovery Request</DialogTitle>
                <DialogDescription>
                  Add a new discovery request to track
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newRequest.requestType}
                      onValueChange={(v) => setNewRequest(prev => ({ ...prev, requestType: v as DiscoveryType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interrogatory">Interrogatory</SelectItem>
                        <SelectItem value="request_for_production">Request for Production</SelectItem>
                        <SelectItem value="request_for_admission">Request for Admission</SelectItem>
                        <SelectItem value="deposition">Deposition Notice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Request Number *</Label>
                    <Input
                      value={newRequest.requestNumber}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, requestNumber: e.target.value }))}
                      placeholder="INT-001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Question/Request *</Label>
                  <Textarea
                    value={newRequest.question}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Enter the discovery question or request..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Served Date</Label>
                    <Input
                      type="date"
                      value={newRequest.servedDate}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, servedDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Response Due Date</Label>
                    <Input
                      type="date"
                      value={newRequest.responseDueDate}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, responseDueDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newRequest.notes}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRequest}>
                  Create Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DeadlineAlerts
        deadlines={deadlines}
        onViewOverdue={handleViewOverdue}
        onViewDueToday={handleViewDueToday}
        onViewThisWeek={handleViewThisWeek}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={cn(
          "transition-all duration-300",
          showRightPanel ? "lg:col-span-3" : "lg:col-span-3"
        )}>
          <DiscoveryTimeline
            deadlines={filteredDeadlines}
            onDeadlineClick={handleDeadlineClick}
            filterType={timelineFilter}
            onFilterChange={setTimelineFilter}
          />
        </div>

        <div className={cn(
          "transition-all duration-300",
          showRightPanel ? "lg:col-span-5" : "lg:col-span-9"
        )}>
          <DiscoveryList
            requests={requests}
            onSelectRequest={handleSelectRequest}
            onBulkUpdate={handleBulkUpdate}
            isLoading={isLoading}
          />
        </div>

        {showRightPanel && selectedRequest && (
          <div className="lg:col-span-4">
            <div className="sticky top-20">
              <div className="flex items-center justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRightPanel(false)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
              <ResponseGenerator
                request={selectedRequest}
                onGenerateResponse={handleGenerateResponse}
                onSave={handleUpdateRequest}
              />
            </div>
          </div>
        )}

        {!showRightPanel && (
          <div className="fixed bottom-4 right-4">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowRightPanel(true)}
              className="gap-1"
            >
              <PanelLeft className="h-4 w-4" />
              Show Editor
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
