import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FileText,
  FolderOpen,
  Gavel,
  Loader2,
  Scale,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { getCases, getDocumentStats } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  label: string;
  date: string;
  summary: string;
}

interface InsightTab {
  id: "judicial-stats" | "witness-tracker";
  label: string;
}

const insightTabs: InsightTab[] = [
  { id: "judicial-stats", label: "Judicial Stats" },
  { id: "witness-tracker", label: "Witness Tracker" },
];

const transcriptExcerpt = [
  {
    id: "line-1",
    timestamp: "[09:12:04]",
    text: '"I was never present at the location on the night in question..."',
  },
  {
    id: "note-1",
    note: "SYSTEM NOTE: This conflicts with GPS logs in Exhibit B.",
  },
  {
    id: "line-2",
    timestamp: "[09:18:41]",
    text: '"The meeting ended before midnight, and no further contact occurred."',
  },
  {
    id: "line-3",
    timestamp: "[09:23:10]",
    text: '"Phone activity suggests an additional exchange around 03:00 that needs explanation."',
  },
] as const;

function formatTimelineDate(value: string): string {
  return format(new Date(value), "MMM dd, yyyy");
}

export default function Dashboard(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<InsightTab["id"]>("judicial-stats");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const {
    data: cases = [],
    isLoading: casesLoading,
    isError: casesError,
  } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const {
    data: documentStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ["document-stats"],
    queryFn: getDocumentStats,
  });

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    return cases.slice(0, 5).map((caseItem, index) => ({
      id: caseItem.id,
      label: index === 0 ? "Lead" : `Queue ${index}`,
      date: caseItem.next_deadline ?? caseItem.updated_at,
      summary: `${caseItem.name} • ${caseItem.case_type} • ${caseItem.status}`,
    }));
  }, [cases]);

  const selectedEvent = timelineEvents.find((event) => event.id === selectedEventId) ?? timelineEvents[0] ?? null;

  const activeCases = cases.filter((caseItem) => caseItem.status === "active").length;
  const deadlinesCount = cases.filter((caseItem) => caseItem.next_deadline).length;
  const totalDocuments = documentStats?.total ?? 0;
  const analyzedDocuments = documentStats?.analyzed ?? 0;

  const loading = casesLoading || statsLoading;
  const hasError = casesError || statsError;
  const hasCases = timelineEvents.length > 0;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <header className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300/70">
                  CaseBuddy intelligence cockpit
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Case strategy dashboard
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300">
                  Review the core record, surface contradictions, and prioritize courtroom strategy from a single workspace.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-200">Today</p>
                  <p className="mt-1 text-base font-semibold text-white">{format(new Date(), "MMMM d, yyyy")}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200">Status</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-100">
                    <Sparkles className="h-4 w-4" />
                    Strategy systems online
                  </p>
                </div>
              </div>
            </div>

            {hasCases ? (
              <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-1" aria-label="Case timeline events">
                {timelineEvents.map((event) => {
                  const isSelected = selectedEvent?.id === event.id;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className={cn(
                        "min-w-[180px] rounded-xl border px-4 py-3 text-left text-xs transition-all",
                        isSelected
                          ? "border-blue-400 bg-blue-500/15 text-white shadow-md shadow-blue-950/40"
                          : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-blue-400/60 hover:bg-slate-900"
                      )}
                    >
                      <span className="block font-semibold uppercase tracking-wider text-blue-300">{event.label}</span>
                      <span className="mt-1 block text-slate-200">{formatTimelineDate(event.date)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
                {hasError
                  ? "Case data is temporarily unavailable. Try again once the connection recovers."
                  : "No matters yet. Create your first case to unlock the strategy timeline and insights workspace."}
              </div>
            )}
          </header>

          <main className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/40 sm:p-6">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                    Source Document: Transcript_A1.pdf
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    {selectedEvent?.summary ?? "Select a case to review deadlines, document coverage, and strategic insights."}
                  </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-auto">
                  <MetricCard icon={FolderOpen} label="Active matters" value={loading ? "..." : String(activeCases)} />
                  <MetricCard icon={Waypoints} label="Deadlines" value={loading ? "..." : String(deadlinesCount)} />
                  <MetricCard icon={FileText} label="Documents" value={loading ? "..." : String(totalDocuments)} />
                  <MetricCard icon={Scale} label="AI analyzed" value={loading ? "..." : String(analyzedDocuments)} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  Transcript excerpt
                </div>

                <div className="space-y-4 font-serif text-lg leading-relaxed text-slate-200">
                  {transcriptExcerpt.map((entry) => {
                    if ("note" in entry) {
                      return (
                        <p
                          key={entry.id}
                          className="rounded-md border-l-4 border-amber-400 bg-amber-400/10 p-3 text-base italic text-amber-100"
                        >
                          *{entry.note}*
                        </p>
                      );
                    }

                    return (
                      <p key={entry.id}>
                        <span className="mr-2 font-bold text-blue-300">{entry.timestamp}</span>
                        {entry.text}
                      </p>
                    );
                  })}
                </div>
              </div>

              {hasError ? (
                <div className="mt-5 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-100">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Live case metrics are temporarily unavailable.
                  </div>
                  <p className="mt-2 text-amber-100/90">
                    The dashboard is still showing a working strategy view while data services recover.
                  </p>
                </div>
              ) : null}
            </section>

            <aside className="rounded-2xl border border-slate-800/70 bg-slate-900/70 shadow-xl shadow-slate-950/40">
              <div className="border-b border-slate-800 p-4">
                <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/40 p-1">
                  {insightTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                        activeTab === tab.id
                          ? "bg-blue-500/20 text-blue-200"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 p-4">
                {activeTab === "judicial-stats" ? (
                  <>
                    <section className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
                      <h3 className="mb-2 text-sm font-bold text-slate-100">Judge&apos;s Ruling Patterns</h3>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full w-[65%] bg-blue-500" />
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        65% favorability on Motion to Suppress over recent comparable matters.
                      </p>
                    </section>

                    <section className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4 text-blue-300" />}
                        Priority insight
                      </div>
                      <p className="mt-3 text-sm text-slate-300">
                        {hasCases
                          ? "Lead with the timeline inconsistency before the witness can frame it as an innocent memory lapse."
                          : "Build a case record to generate timeline-driven courtroom strategy recommendations."}
                      </p>
                    </section>
                  </>
                ) : (
                  <section className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
                    <h3 className="text-sm font-bold text-slate-100">Witness Reliability Tracker</h3>
                    <ul className="mt-3 space-y-3 text-sm text-slate-300">
                      <li className="flex items-start justify-between gap-4">
                        <span>Primary witness credibility</span>
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">Under review</span>
                      </li>
                      <li className="flex items-start justify-between gap-4">
                        <span>Statement consistency</span>
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-200">Flagged</span>
                      </li>
                      <li className="flex items-start justify-between gap-4">
                        <span>Exhibit foundation readiness</span>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">Ready</span>
                      </li>
                    </ul>
                  </section>
                )}

                <section className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                  <h3 className="text-sm font-bold text-red-300">Strategy Priority</h3>
                  <ul className="mt-2 space-y-2 text-xs text-slate-200">
                    {hasCases ? (
                      <>
                        <li className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-red-300" />
                          Cross-examine on the 03:00 timeline gap.
                        </li>
                        <li className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-red-300" />
                          Introduce Exhibit D before lunch recess.
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-red-300" />
                          Add a case with deadlines to populate the strategy queue.
                        </li>
                        <li className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-red-300" />
                          Import documents to unlock transcript and exhibit insights.
                        </li>
                      </>
                    )}
                  </ul>
                </section>
              </div>
            </aside>
          </main>
        </div>
      </div>
    </Layout>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function MetricCard({ icon: Icon, label, value }: MetricCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
