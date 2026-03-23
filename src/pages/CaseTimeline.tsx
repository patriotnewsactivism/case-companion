import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle,
  Filter,
  RefreshCw,
  Calendar,
  Loader2,
  AlertCircle,
  Gavel,
  Shield,
} from "lucide-react";
import {
  generateIntelligentTimeline,
  getCaseDocumentsForTimeline,
} from "@/services/timelineIntelligence";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineEventRow {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  importance: string | null;
  linked_document_id: string | null;
  created_at: string;
  updated_at: string;
  // Extended fields set by AI (may or may not be in DB)
  event_category?: string | null;
  source_document_name?: string | null;
  source_page_reference?: string | null;
  ai_confidence?: number | null;
  legal_significance?: string | null;
  is_ai_generated?: boolean | null;
  is_verified?: boolean | null;
  deadline_triggered_by?: string | null;
  gaps_analysis?: Array<{ missing_event: string; why_important: string; recommended_action: string }> | null;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; badgeClass: string; dotClass: string }
> = {
  constitutional_violation: {
    label: "Constitutional Violation",
    color: "red",
    badgeClass: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300",
    dotClass: "bg-red-500",
  },
  arrest: {
    label: "Arrest",
    color: "red",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300",
    dotClass: "bg-rose-500",
  },
  incident: {
    label: "Incident",
    color: "red",
    badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300",
    dotClass: "bg-red-400",
  },
  filing: {
    label: "Filing",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
    dotClass: "bg-blue-500",
  },
  hearing: {
    label: "Hearing",
    color: "blue",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  deadline: {
    label: "Deadline",
    color: "orange",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300",
    dotClass: "bg-orange-500",
  },
  discovery: {
    label: "Discovery",
    color: "amber",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  evidence: {
    label: "Evidence",
    color: "amber",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300",
    dotClass: "bg-yellow-500",
  },
  witness: {
    label: "Witness",
    color: "purple",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300",
    dotClass: "bg-purple-500",
  },
  judicial_order: {
    label: "Judicial Order",
    color: "purple",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  retaliation: {
    label: "Retaliation",
    color: "red",
    badgeClass: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950/30 dark:text-red-200",
    dotClass: "bg-red-600",
  },
  media: {
    label: "Media",
    color: "slate",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-slate-400",
  },
};

function getCategoryConfig(category: string | null | undefined) {
  const key = (category ?? "").toLowerCase();
  return (
    CATEGORY_CONFIG[key] ?? {
      label: key || "Other",
      color: "gray",
      badgeClass: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300",
      dotClass: "bg-gray-400",
    }
  );
}

function formatEventDate(dateStr: string): string {
  try {
    const parsed = parseISO(dateStr);
    if (isValid(parsed)) return format(parsed, "MMM d, yyyy");
  } catch {
    // fall through
  }
  return dateStr;
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: TimelineEventRow }) {
  const category = event.event_category ?? event.event_type ?? "other";
  const cfg = getCategoryConfig(category);
  const isDeadline = category === "deadline";
  const confidence =
    typeof event.ai_confidence === "number"
      ? Math.round(event.ai_confidence * 100)
      : null;

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-3 h-3 rounded-full mt-1.5 ring-2 ring-background shrink-0 z-10",
            cfg.dotClass
          )}
        />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>

      {/* Card */}
      <Card
        className={cn(
          "mb-4 flex-1 border transition-shadow hover:shadow-md",
          isDeadline && "ring-1 ring-orange-400"
        )}
      >
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded shrink-0">
              <Calendar className="w-3 h-3" />
              {formatEventDate(event.event_date)}
            </div>

            {/* Category badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase tracking-wider py-0 h-5",
                cfg.badgeClass,
                isDeadline && "animate-pulse"
              )}
            >
              {cfg.label}
            </Badge>

            {/* AI confidence badge */}
            {event.is_ai_generated && confidence !== null && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider py-0 h-5 bg-purple-50 text-purple-700 border-purple-200"
              >
                <Sparkles className="w-2.5 h-2.5 mr-1" />
                AI {confidence}%
              </Badge>
            )}

            {/* Verified / unverified */}
            <div className="ml-auto shrink-0">
              {event.is_verified ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              ) : event.is_ai_generated ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-500">
                  <AlertCircle className="w-3 h-3" />
                  Unverified
                </span>
              ) : null}
            </div>
          </div>

          {/* Title */}
          <p className="font-semibold text-foreground mb-1">{event.title}</p>

          {/* Description */}
          {event.description && (
            <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
          )}

          {/* Legal significance */}
          {event.legal_significance && (
            <p className="text-xs italic text-muted-foreground border-l-2 border-border pl-2 mb-2">
              <Gavel className="w-3 h-3 inline mr-1 text-muted-foreground" />
              {event.legal_significance}
            </p>
          )}

          {/* Source document */}
          {event.source_document_name && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1">
              <FileText className="w-3 h-3" />
              {event.source_document_name}
              {event.source_page_reference && (
                <span className="text-muted-foreground">({event.source_page_reference})</span>
              )}
            </div>
          )}

          {/* Deadline triggered */}
          {event.deadline_triggered_by && (
            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
              <Clock className="w-3 h-3" />
              Deadline: {event.deadline_triggered_by}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Gap card ─────────────────────────────────────────────────────────────────

function GapCard({
  gap,
}: {
  gap: { missing_event: string; why_important: string; recommended_action: string };
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full mt-1.5 ring-2 ring-background bg-gray-300 border border-dashed border-gray-400 shrink-0 z-10" />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <Card className="mb-4 flex-1 border border-dashed border-gray-300 bg-gray-50/50 dark:bg-gray-900/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="font-semibold text-sm text-foreground">
              Gap: {gap.missing_event}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-1">
            <span className="font-medium">Why it matters:</span> {gap.why_important}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <span className="font-medium">Action:</span> {gap.recommended_action}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const CATEGORIES = [
  "All",
  "constitutional_violation",
  "arrest",
  "incident",
  "filing",
  "hearing",
  "deadline",
  "discovery",
  "evidence",
  "witness",
  "judicial_order",
  "retaliation",
  "media",
  "other",
];

const EVENT_TYPES_FOR_ADD = [
  "incident",
  "arrest",
  "filing",
  "hearing",
  "deadline",
  "discovery",
  "evidence",
  "witness",
  "judicial_order",
  "constitutional_violation",
  "retaliation",
  "media",
  "other",
];

const IMPORTANCE_LEVELS = ["high", "medium", "low"];

export default function CaseTimeline() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState<"all" | "ai" | "manual">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Add event dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("incident");
  const [newImportance, setNewImportance] = useState("medium");
  const [newDescription, setNewDescription] = useState("");

  // Generate state
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const {
    data: events = [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["timeline_events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timeline_events")
        .select("*")
        .eq("case_id", id!)
        .order("event_date");
      if (error) throw error;
      return (data ?? []) as TimelineEventRow[];
    },
    enabled: !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["case_documents_for_timeline", id],
    queryFn: () => getCaseDocumentsForTimeline(id!),
    enabled: !!id,
  });

  // ── Add event mutation ───────────────────────────────────────────────────────

  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!id || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("timeline_events").insert({
        case_id: id,
        user_id: user.id,
        title: newTitle,
        description: newDescription || null,
        event_date: newDate,
        event_type: newType,
        importance: newImportance,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline_events", id] });
      toast.success("Event added to timeline");
      setAddDialogOpen(false);
      setNewTitle("");
      setNewDate("");
      setNewType("incident");
      setNewImportance("medium");
      setNewDescription("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Generate timeline ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!id || !caseData) return;
    setGenerating(true);
    setGenerationProgress("Preparing documents...");
    try {
      setGenerationProgress("Analyzing documents with AI...");
      const result = await generateIntelligentTimeline({
        caseId: id,
        caseType: caseData.case_type,
        jurisdiction: "Federal",
        documents,
        existingFacts: caseData.case_theory ?? "",
        legalTheories: caseData.key_issues ?? [],
      });
      queryClient.invalidateQueries({ queryKey: ["timeline_events", id] });
      toast.success(
        `Timeline generated: ${result.inserted} events added, ${result.gaps.length} gaps identified`
      );
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate timeline");
    } finally {
      setGenerating(false);
      setGenerationProgress("");
    }
  };

  // ── Filter events ────────────────────────────────────────────────────────────

  const filteredEvents = events.filter((e) => {
    const cat = (e.event_category ?? e.event_type ?? "other").toLowerCase();
    if (categoryFilter !== "All" && cat !== categoryFilter) return false;

    if (sourceFilter === "ai" && !e.is_ai_generated) return false;
    if (sourceFilter === "manual" && e.is_ai_generated) return false;

    if (dateFrom && e.event_date < dateFrom) return false;
    if (dateTo && e.event_date > dateTo) return false;

    return true;
  });

  // Collect all gap events from events that have gaps_analysis
  const allGaps: Array<{
    missing_event: string;
    why_important: string;
    recommended_action: string;
  }> = [];
  for (const e of events) {
    if (Array.isArray(e.gaps_analysis)) {
      allGaps.push(...e.gaps_analysis);
    }
  }

  const isLoading = caseLoading || eventsLoading;

  // ── Render ───────────────────────────────────────────────────────────────────

  // Collect deadline events
  const deadlineEvents = events
    .filter(
      (e) =>
        (e.event_category ?? e.event_type ?? "").toLowerCase() === "deadline" ||
        !!e.deadline_triggered_by
    )
    .sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

  const upcomingDeadlines = deadlineEvents.filter(
    (e) => new Date(e.event_date) >= new Date()
  );

  const getDaysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/cases/${id}`)}
              aria-label="Back to case"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Intelligent Timeline
              </p>
              <h1 className="text-xl font-bold text-foreground">
                {caseLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : (
                  caseData?.name ?? "Case Timeline"
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchEvents()}
              disabled={eventsLoading}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", eventsLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Event
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1" />
              )}
              {generating ? "Generating..." : "Generate AI Timeline"}
            </Button>
          </div>
        </div>

        {/* Generation progress */}
        {generating && generationProgress && (
          <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <p className="text-sm text-purple-700 dark:text-purple-300">{generationProgress}</p>
            </CardContent>
          </Card>
        )}

        {/* Filter bar */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                <Filter className="w-3.5 h-3.5" />
                Filters:
              </div>

              {/* Category filter */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Category
                </Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-7 text-xs w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c === "All"
                          ? "All Categories"
                          : getCategoryConfig(c).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source filter */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Source
                </Label>
                <Select
                  value={sourceFilter}
                  onValueChange={(v) =>
                    setSourceFilter(v as "all" | "ai" | "manual")
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Sources</SelectItem>
                    <SelectItem value="ai" className="text-xs">AI Generated</SelectItem>
                    <SelectItem value="manual" className="text-xs">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  From
                </Label>
                <Input
                  type="date"
                  className="h-7 text-xs w-36"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  To
                </Label>
                <Input
                  type="date"
                  className="h-7 text-xs w-36"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {/* Clear */}
              {(categoryFilter !== "All" ||
                sourceFilter !== "all" ||
                dateFrom ||
                dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs self-end"
                  onClick={() => {
                    setCategoryFilter("All");
                    setSourceFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {filteredEvents.length} events
            {filteredEvents.length !== events.length && ` (of ${events.length})`}
          </span>
          {events.filter((e) => e.is_ai_generated).length > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              {events.filter((e) => e.is_ai_generated).length} AI-generated
            </span>
          )}
          {events.filter((e) => e.is_verified).length > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              {events.filter((e) => e.is_verified).length} verified
            </span>
          )}
          {allGaps.length > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {allGaps.length} gaps identified
            </span>
          )}
        </div>

        {/* Two-column layout: Timeline + Deadline Sidebar */}
        <div className="flex gap-6">
          {/* Main timeline column */}
          <div className="flex-1 min-w-0">
            {/* Timeline */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Calendar className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">No timeline events found</p>
                  <p className="text-sm mt-1">
                    {events.length === 0
                      ? "Click \"Generate AI Timeline\" to extract events from your documents, or add events manually."
                      : "No events match your current filters."}
                  </p>
                  {events.length === 0 && (
                    <Button
                      className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={handleGenerate}
                      disabled={generating}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate AI Timeline
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-0">
                {filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}

            {/* Gaps section */}
            {allGaps.length > 0 && (
              <div className="mt-8 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Identified Gaps ({allGaps.length})
                  </h2>
                </div>
                {allGaps.map((gap, i) => (
                  <GapCard key={i} gap={gap} />
                ))}
              </div>
            )}
          </div>

          {/* Deadline Tracker Sidebar */}
          <div className="w-64 shrink-0 hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    Deadline Tracker
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {upcomingDeadlines.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No upcoming deadlines tracked. Deadlines are extracted automatically from documents.
                    </p>
                  ) : (
                    upcomingDeadlines.slice(0, 8).map((dl) => {
                      const daysLeft = getDaysUntil(dl.event_date);
                      const isUrgent = daysLeft <= 7;
                      const isSoon = daysLeft <= 30;
                      return (
                        <div
                          key={dl.id}
                          className={cn(
                            "rounded-lg border p-2.5 space-y-1",
                            isUrgent
                              ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                              : isSoon
                              ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
                              : "border-border bg-muted/30"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                isUrgent
                                  ? "text-red-600"
                                  : isSoon
                                  ? "text-orange-600"
                                  : "text-muted-foreground"
                              )}
                            >
                              {daysLeft <= 0
                                ? "OVERDUE"
                                : daysLeft === 1
                                ? "TOMORROW"
                                : `${daysLeft} days`}
                            </span>
                            {isUrgent && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground leading-tight">
                            {dl.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {formatEventDate(dl.event_date)}
                          </p>
                          {dl.deadline_triggered_by && (
                            <p className="text-[10px] text-orange-600 dark:text-orange-400">
                              {dl.deadline_triggered_by}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Category summary */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    Event Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-1.5">
                    {Object.entries(
                      events.reduce<Record<string, number>>((acc, e) => {
                        const cat = (e.event_category ?? e.event_type ?? "other").toLowerCase();
                        acc[cat] = (acc[cat] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => {
                        const cfg = getCategoryConfig(cat);
                        return (
                          <div
                            key={cat}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn("w-2 h-2 rounded-full", cfg.dotClass)}
                              />
                              <span className="text-muted-foreground">
                                {cfg.label}
                              </span>
                            </div>
                            <span className="font-mono font-medium text-foreground">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Timeline Event
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="evt-title">Title *</Label>
              <Input
                id="evt-title"
                placeholder="Event title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="evt-date">Date *</Label>
                <Input
                  id="evt-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Importance</Label>
                <Select value={newImportance} onValueChange={setNewImportance}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE_LEVELS.map((l) => (
                      <SelectItem key={l} value={l} className="capitalize">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES_FOR_ADD.map((t) => (
                    <SelectItem key={t} value={t}>
                      {getCategoryConfig(t).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evt-desc">Description</Label>
              <Textarea
                id="evt-desc"
                placeholder="Describe what happened..."
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addEventMutation.mutate()}
              disabled={!newTitle || !newDate || addEventMutation.isPending}
            >
              {addEventMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
