import { describe, expect, it } from "vitest";

import { getLitigationPhaseLabel, groupTimelineByPhase, normalizeLitigationPhase } from "@/lib/timeline-phase";

describe("timeline phase helpers", () => {
  it("normalizes known phases and infers from event type", () => {
    expect(normalizeLitigationPhase("trial", "")).toBe("trial");
    expect(normalizeLitigationPhase(undefined, "summary_judgment")).toBe("dispositive");
    expect(normalizeLitigationPhase(undefined, "deposition_notice")).toBe("discovery");
  });

  it("groups timeline events by phase and preserves next action", () => {
    const grouped = groupTimelineByPhase([
      {
        id: "1",
        date: "2026-02-10",
        title: "Deposition notice served",
        phase: "discovery",
        eventType: "deposition",
        nextRequiredAction: "Prepare deposition outline.",
      },
      {
        id: "2",
        date: "2026-01-10",
        title: "Complaint filed",
        phase: "pleadings",
        eventType: "filing",
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].phase).toBe("pleadings");
    expect(grouped[1].phase).toBe("discovery");
    expect(grouped[1].nextAction).toBe("Prepare deposition outline.");
    expect(getLitigationPhaseLabel(grouped[0].phase)).toBe("Pleadings");
  });
});
