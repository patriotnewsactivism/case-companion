export type LitigationPhase = "pre-suit" | "pleadings" | "discovery" | "dispositive" | "trial" | "post-trial";

export interface TimelineItemForPhase {
  id: string;
  date: string;
  title: string;
  description?: string;
  phase?: string;
  eventType?: string;
  nextRequiredAction?: string | null;
}

export interface PhaseGroup {
  phase: LitigationPhase;
  events: TimelineItemForPhase[];
  nextAction: string | null;
}

const PHASE_ORDER: LitigationPhase[] = [
  "pre-suit",
  "pleadings",
  "discovery",
  "dispositive",
  "trial",
  "post-trial",
];

const PHASE_LABELS: Record<LitigationPhase, string> = {
  "pre-suit": "Pre-Suit",
  pleadings: "Pleadings",
  discovery: "Discovery",
  dispositive: "Dispositive",
  trial: "Trial",
  "post-trial": "Post-Trial",
};

export function normalizeLitigationPhase(phase: string | undefined, eventType: string | undefined): LitigationPhase {
  const normalized = (phase || "").trim().toLowerCase();
  if (PHASE_ORDER.includes(normalized as LitigationPhase)) {
    return normalized as LitigationPhase;
  }

  const eventTypeNormalized = (eventType || "").toLowerCase();
  if (/complaint|answer|service|summons|pleading/.test(eventTypeNormalized)) return "pleadings";
  if (/interrogatory|production|admission|deposition|discovery|subpoena/.test(eventTypeNormalized)) return "discovery";
  if (/summary_judgment|dismiss|dispositive|daubert|in limine/.test(eventTypeNormalized)) return "dispositive";
  if (/trial|verdict|jury|pretrial/.test(eventTypeNormalized)) return "trial";
  if (/appeal|post-trial|enforcement/.test(eventTypeNormalized)) return "post-trial";

  return "discovery";
}

export function getLitigationPhaseLabel(phase: LitigationPhase): string {
  return PHASE_LABELS[phase];
}

export function groupTimelineByPhase(events: TimelineItemForPhase[]): PhaseGroup[] {
  const groups = new Map<LitigationPhase, TimelineItemForPhase[]>();

  for (const event of events) {
    const phase = normalizeLitigationPhase(event.phase, event.eventType);
    const phaseEvents = groups.get(phase) || [];
    phaseEvents.push(event);
    groups.set(phase, phaseEvents);
  }

  return PHASE_ORDER
    .filter((phase) => groups.has(phase))
    .map((phase) => {
      const phaseEvents = (groups.get(phase) || []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const nextAction = phaseEvents.find((event) => event.nextRequiredAction?.trim())?.nextRequiredAction?.trim() || null;

      return {
        phase,
        events: phaseEvents,
        nextAction,
      };
    });
}
