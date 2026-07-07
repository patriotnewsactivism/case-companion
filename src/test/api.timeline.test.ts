import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTimelineEventsByCase,
  getAllTimelineEvents,
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const mockEvent = {
  id: "event-1",
  case_id: "case-1",
  user_id: "user-1",
  title: "Trial date",
  description: "Day 1 of trial",
  event_date: "2026-06-01",
  event_type: "trial",
  phase: "trial",
  next_required_action: "Prepare opening statement",
  linked_document_id: null,
  importance: "high",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("timeline events api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTimelineEventsByCase", () => {
    it("returns events ordered by event_date ascending", async () => {
      const order = vi.fn().mockResolvedValue({ data: [mockEvent], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getTimelineEventsByCase("case-1");

      expect(supabase.from).toHaveBeenCalledWith("timeline_events");
      expect(eq).toHaveBeenCalledWith("case_id", "case-1");
      expect(order).toHaveBeenCalledWith("event_date", { ascending: true });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Trial date");
    });

    it("returns empty array when no events exist", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getTimelineEventsByCase("case-1");
      expect(result).toEqual([]);
    });

    it("throws on database error", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      await expect(getTimelineEventsByCase("case-1")).rejects.toThrow("DB error");
    });
  });

  describe("getAllTimelineEvents", () => {
    it("returns all events ordered by event_date ascending", async () => {
      const order = vi.fn().mockResolvedValue({ data: [mockEvent], error: null });
      const select = vi.fn().mockReturnValue({ order });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getAllTimelineEvents();

      expect(order).toHaveBeenCalledWith("event_date", { ascending: true });
      expect(result).toHaveLength(1);
    });
  });

  describe("createTimelineEvent", () => {
    it("attaches user_id and inserts timeline event", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      } as never);

      const single = vi.fn().mockResolvedValue({ data: mockEvent, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      vi.mocked(supabase.from).mockReturnValue({ insert } as never);

      const result = await createTimelineEvent({
        case_id: "case-1",
        title: "Trial date",
        event_date: "2026-06-01",
        importance: "high",
      });

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          case_id: "case-1",
          title: "Trial date",
          event_date: "2026-06-01",
          importance: "high",
        })
      );
      expect(result.id).toBe("event-1");
    });

    it("throws when not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        createTimelineEvent({ case_id: "case-1", title: "Event", event_date: "2026-06-01", importance: "low" })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("updateTimelineEvent", () => {
    it("updates event fields by id", async () => {
      const updatedEvent = { ...mockEvent, title: "Updated title" };
      const single = vi.fn().mockResolvedValue({ data: updatedEvent, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      const result = await updateTimelineEvent("event-1", { title: "Updated title" });

      expect(update).toHaveBeenCalledWith({ title: "Updated title" });
      expect(eq).toHaveBeenCalledWith("id", "event-1");
      expect(result.title).toBe("Updated title");
    });

    it("throws on database error", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: new Error("Update failed") });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      await expect(updateTimelineEvent("event-1", { title: "x" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteTimelineEvent", () => {
    it("deletes event by id", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);

      await deleteTimelineEvent("event-1");

      expect(del).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith("id", "event-1");
    });

    it("throws on database error", async () => {
      const eq = vi.fn().mockResolvedValue({ error: new Error("Delete failed") });
      const del = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);

      await expect(deleteTimelineEvent("event-1")).rejects.toThrow("Delete failed");
    });
  });
});
