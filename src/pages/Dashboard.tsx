import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  FolderOpen,
  Gavel,
  Loader2,
  Scale,
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

const fallbackTimelineEvents: TimelineEvent[] = [
  {
    id: "event-1",
    label: "Event",
    date: "2023-01-10",
    summary: "Initial interview notes collected for transcript review.",
  },
  {
    id: "event-2",
    label: "Event",
    date: "2023-02-15",
    summary: "Discovery packet updated with witness statement revisions.",
  },
  {
    id: "event-3",
    label: "Event",
    date: "2023-03-01",
    summary: "Motion strategy revised after timeline discrepancies surfaced.",
  },
  {
    id: "event-4",
    label: "Event",
    date: "2024-05-12",
    summary: "Exhibit preparation finalized for hearing presentation.",
  },
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
  const [selectedEventId, setSelectedEventId] = useState<string>(fallbackTimelineEvents[0].id);

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
    const mappedEvents = cases
      .slice(0, 4)
      .map((caseItem, index) => ({
        id: caseItem.id,
        label: index === 0 ? "Lead" : "Event",
        date: caseItem.next_deadline ?? caseItem.updated_at,
        summary: `${caseItem.name} • ${caseItem.case_type} • ${caseItem.status}`,
      }));

    return mappedEvents.length > 0 ? mappedEvents : fallbackTimelineEvents;
  }, [cases]);

  const selectedEvent =
    timelineEvents.find((event) => event.id === selectedEventId) ?? timelineEvents[0] ?? fallbackTimelineEvents[0];

  const activeCases = cases.filter((caseItem) => caseItem.status === "active").length;
  const deadlinesCount = cases.filter((caseItem) => caseItem.next_deadline).length;
  const totalDocuments = documentStats?.total ?? 0;
  const analyzedDocuments = documentStats?.analyzed ?? 0;

  const loading = casesLoading || statsLoading;
  const hasError = casesError || statsError;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-200">
        <header className="border-b border-slate-800 bg-slate-900/50 p-4 sm:p-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  CaseBuddy intelligence cockpit
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Case strategy dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Review the core record, surface contradictions, and prioritize courtroom strategy from a single workspace.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300 shadow-lg shadow-slate-950/30">
                <div className="flex items-center gap-2 text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  <span>Today</span>
                </div>
                <p className="mt-1 font-medium text-white">{format(new Date(), "MMMM d, yyyy")}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 overflow-x-auto pb-2" aria-label="Case timeline events">
              {timelineEvents.map((event) => {
                const isSelected = selectedEvent.id === event.id;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      "flex-shrink-0 rounded-md border px-4 py-2 text-left text-xs transition-colors",
                      isSelected
                        ? "border-blue-500 bg-slate-800 text-white"
                        : "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-blue-500"
                    )}
                  >
                    <span className="block font-bold uppercase tracking-wider text-blue-400">{event.label}</span>
                    <span>{formatTimelineDate(event.date)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-7xl flex-1 flex-col overflow-hidden lg:flex-row">
          <section className="overflow-y-auto border-b border-slate-800 bg-slate-950 p-6 lg:w-2/3 lg:border-b-0 lg:border-r">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  Source Document: Transcript_A1.pdf
                </h2>
                <p className="mt-2 text-sm text-slate-400">{selectedEvent.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard icon={FolderOpen} label="Active matters" value={loading ? "..." : String(activeCases)} />
                <MetricCard icon={Waypoints} label="Deadlines" value={loading ? "..." : String(deadlinesCount)} />
                <MetricCard icon={FileText} label="Documents" value={loading ? "..." : String(totalDocuments)} />
                <MetricCard icon={Scale} label="AI analyzed" value={loading ? "..." : String(analyzedDocuments)} />
              </div>
            </div>

            <div className="space-y-4 font-serif text-lg leading-relaxed text-slate-300">
              {transcriptExcerpt.map((entry) => {
                if ("note" in entry) {
                  return (
                    <p
                      key={entry.id}
                      className="border-l-4 border-amber-500 bg-amber-900/20 p-3 text-base italic text-amber-100"
                    >
                      *{entry.note}*
                    </p>
                  );
                }

                return (
                  <p key={entry.id}>
                    <span className="mr-2 font-bold text-blue-500">{entry.timestamp}</span>
                    {entry.text}
                  </p>
                );
              })}
            </div>

            {hasError ? (
              <div className="mt-6 rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Live case metrics are temporarily unavailable.
                </div>
                <p className="mt-2 text-amber-200/90">
                  The dashboard is still showing a working strategy view while data services recover.
                </p>
              </div>
            ) : null}
          </section>

          <aside className="flex flex-col bg-slate-900 lg:w-1/3">
            <div className="border-b border-slate-800 p-4">
              <div className="flex space-x-4 text-xs font-bold uppercase">
                {insightTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "border-b-2 pb-1 transition-colors",
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {activeTab === "judicial-stats" ? (
                <>
                  <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <h3 className="mb-2 text-sm font-bold text-slate-100">Judge&apos;s Ruling Patterns</h3>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                      <div className="h-full w-[65%] bg-blue-500" />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      65% favorability on Motion to Suppress over recent comparable matters.
                    </p>
                  </section>

                  <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4 text-blue-400" />}
                      Priority insight
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      Lead with the timeline inconsistency before the witness can frame it as an innocent memory lapse.
                    </p>
                  </section>
                </>
              ) : (
                <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <h3 className="text-sm font-bold text-slate-100">Witness Reliability Tracker</h3>
                  <ul className="mt-3 space-y-3 text-sm text-slate-300">
                    <li className="flex items-start justify-between gap-4">
                      <span>Primary witness credibility</span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">Under review</span>
                    </li>
                    <li className="flex items-start justify-between gap-4">
                      <span>Statement consistency</span>
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-300">Flagged</span>
                    </li>
                    <li className="flex items-start justify-between gap-4">
                      <span>Exhibit foundation readiness</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">Ready</span>
                    </li>
                  </ul>
                </section>
              )}

              <section className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
                <h3 className="text-sm font-bold text-red-400">Strategy Priority</h3>
                <ul className="mt-2 space-y-2 text-xs text-slate-200">
                  <li>• Cross-examine on the 03:00 timeline gap.</li>
                  <li>• Introduce Exhibit D before lunch recess.</li>
                </ul>
              </section>
            </div>
          </aside>
        </main>
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
    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
