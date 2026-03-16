import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  X,
  Gavel,
  AlertTriangle,
  FileText,
  ArrowRight,
} from "lucide-react";
import {
  scanForMotionOpportunities,
  getMotionSuggestions,
  dismissSuggestion,
  type MotionSuggestion,
} from "@/services/motionIntelligence";
import { cn } from "@/lib/utils";

// ─── Urgency config ───────────────────────────────────────────────────────────

type Urgency = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

const URGENCY_CONFIG: Record<
  Urgency,
  { label: string; badgeClass: string; borderClass: string; sortOrder: number }
> = {
  URGENT: {
    label: "URGENT",
    badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300",
    borderClass: "border-red-400 ring-1 ring-red-400 animate-pulse",
    sortOrder: 0,
  },
  HIGH: {
    label: "HIGH",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
    borderClass: "border-orange-300",
    sortOrder: 1,
  },
  MEDIUM: {
    label: "MEDIUM",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300",
    borderClass: "border-yellow-200",
    sortOrder: 2,
  },
  LOW: {
    label: "LOW",
    badgeClass: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300",
    borderClass: "border-green-200",
    sortOrder: 3,
  },
};

function getUrgencyConfig(urgency: string) {
  return (
    URGENCY_CONFIG[urgency as Urgency] ?? {
      label: urgency,
      badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
      borderClass: "border-gray-200",
      sortOrder: 99,
    }
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "All", label: "All" },
  { key: "URGENT", label: "URGENT" },
  { key: "dispositive", label: "Dispositive" },
  { key: "discovery", label: "Discovery" },
  { key: "evidentiary", label: "Evidentiary" },
  { key: "emergency", label: "Emergency" },
];

// ─── Strength meter ───────────────────────────────────────────────────────────

function StrengthMeter({ strength }: { strength: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, strength)) * 100);
  const color =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 50
      ? "bg-amber-500"
      : pct >= 25
      ? "bg-orange-500"
      : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Strength</span>
        <span className="font-mono font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Motion card ──────────────────────────────────────────────────────────────

function MotionCard({
  suggestion,
  caseId,
  onDismiss,
  dismissing,
}: {
  suggestion: MotionSuggestion;
  caseId: string;
  onDismiss: (id: string) => void;
  dismissing: boolean;
}) {
  const urgencyCfg = getUrgencyConfig(suggestion.urgency);

  return (
    <Card
      className={cn(
        "border transition-shadow hover:shadow-md",
        urgencyCfg.borderClass
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase tracking-wider py-0 h-5 font-semibold",
                  urgencyCfg.badgeClass,
                  suggestion.urgency === "URGENT" && "animate-pulse"
                )}
              >
                {urgencyCfg.label}
              </Badge>
              {suggestion.motion_category && (
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase tracking-wider py-0 h-5 capitalize"
                >
                  {suggestion.motion_category}
                </Badge>
              )}
            </div>
            <p className="font-semibold text-foreground leading-tight">
              {suggestion.motion_type}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => suggestion.id && onDismiss(suggestion.id)}
            disabled={dismissing || !suggestion.id}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted disabled:opacity-50"
            aria-label="Dismiss suggestion"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Strength meter */}
        <StrengthMeter strength={suggestion.estimated_strength} />

        {/* Why applicable */}
        {suggestion.why_applicable && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {suggestion.why_applicable}
          </p>
        )}

        {/* Key argument */}
        {suggestion.key_argument && (
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-2 italic line-clamp-2">
            {suggestion.key_argument}
          </p>
        )}

        {/* Deadline warning */}
        {suggestion.deadline_warning && (
          <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {suggestion.deadline_warning}
          </div>
        )}

        {/* Authorizing rule */}
        {suggestion.authorizing_rule && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3 h-3 shrink-0" />
            {suggestion.authorizing_rule}
          </div>
        )}

        {/* Generate button */}
        <Link
          to={`/cases/${caseId}/motions/generate?type=${encodeURIComponent(suggestion.motion_type)}`}
          className="block"
        >
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1 text-xs h-8 border-primary/40 text-primary hover:bg-primary/5"
          >
            Generate This Motion
            <ArrowRight className="w-3 h-3 ml-1.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CaseMotions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("All");

  // ── Case query ───────────────────────────────────────────────────────────────

  const { data: caseData } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("name, case_type")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Motion suggestions query ─────────────────────────────────────────────────

  const {
    data: suggestions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["motion_suggestions", id],
    queryFn: () => getMotionSuggestions(id!),
    enabled: !!id,
  });

  // ── Scan mutation ────────────────────────────────────────────────────────────

  const scanMutation = useMutation({
    mutationFn: () => scanForMotionOpportunities(id!),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["motion_suggestions", id] });
      refetch();
      toast.success(
        `Found ${results.length} motion opportunit${results.length === 1 ? "y" : "ies"}`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Scan failed");
    },
  });

  // ── Dismiss mutation ─────────────────────────────────────────────────────────

  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const handleDismiss = async (suggestionId: string) => {
    setDismissingId(suggestionId);
    try {
      await dismissSuggestion(id!, suggestionId);
      queryClient.invalidateQueries({ queryKey: ["motion_suggestions", id] });
      refetch();
      toast.success("Suggestion dismissed");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to dismiss");
    } finally {
      setDismissingId(null);
    }
  };

  // ── Sort and filter ──────────────────────────────────────────────────────────

  const sorted = [...suggestions].sort((a, b) => {
    const aUrgency = getUrgencyConfig(a.urgency).sortOrder;
    const bUrgency = getUrgencyConfig(b.urgency).sortOrder;
    if (aUrgency !== bUrgency) return aUrgency - bUrgency;
    return b.estimated_strength - a.estimated_strength;
  });

  const filtered = sorted.filter((s) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "URGENT") return s.urgency === "URGENT";
    return (s.motion_category ?? "").toLowerCase() === activeFilter.toLowerCase();
  });

  // ── Render ───────────────────────────────────────────────────────────────────

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
                Motion Intelligence
              </p>
              <h1 className="text-xl font-bold text-foreground">
                {caseData?.name ?? "Case Motions"}
              </h1>
            </div>
          </div>

          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="shrink-0"
          >
            {scanMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {scanMutation.isPending ? "Scanning..." : "Scan for Motions"}
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-3">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "All"
                ? sorted.length
                : tab.key === "URGENT"
                ? sorted.filter((s) => s.urgency === "URGENT").length
                : sorted.filter(
                    (s) =>
                      (s.motion_category ?? "").toLowerCase() ===
                      tab.key.toLowerCase()
                  ).length;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                  activeFilter === tab.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full",
                      activeFilter === tab.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Gavel className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">No motion suggestions yet</p>
              <p className="text-sm mt-1">
                Click "Scan for Motions" to analyze your case and identify viable motions.
              </p>
              <Button
                className="mt-4"
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
              >
                {scanMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Scan for Motions
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="font-medium">No motions match this filter</p>
              <Button
                variant="link"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setActiveFilter("All")}
              >
                Show all {sorted.length} suggestions
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s, i) => (
              <MotionCard
                key={s.id ?? i}
                suggestion={s}
                caseId={id!}
                onDismiss={handleDismiss}
                dismissing={dismissingId === s.id}
              />
            ))}
          </div>
        )}

        {/* Bulk generate CTA */}
        {filtered.length > 0 && (
          <div className="flex justify-center pt-2">
            <Link to={`/cases/${id}/motions/generate`}>
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Generate a Custom Motion
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
