import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentStats, getProfile, updateProfile } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

describe("getDocumentStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes totals, analyzed, pending and withTimeline counts", async () => {
    const documents = [
      { id: "doc-1", ai_analyzed: true },
      { id: "doc-2", ai_analyzed: false },
      { id: "doc-3", ai_analyzed: true },
    ];
    const timelineLinkedDocs = [
      { linked_document_id: "doc-1" },
      { linked_document_id: "doc-2" },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockResolvedValue({ data: documents, error: null }),
        } as never;
      }
      // timeline_events
      return {
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: timelineLinkedDocs, error: null }),
        }),
      } as never;
    });

    const stats = await getDocumentStats();

    expect(stats.total).toBe(3);
    expect(stats.analyzed).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.withTimeline).toBe(2);
  });

  it("returns zeros when there are no documents", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as never;
      }
      return {
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as never;
    });

    const stats = await getDocumentStats();
    expect(stats.total).toBe(0);
    expect(stats.analyzed).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.withTimeline).toBe(0);
  });

  it("counts unique documents linked to timeline (deduplicates)", async () => {
    const documents = [{ id: "doc-1", ai_analyzed: true }];
    // Same doc linked to two timeline events
    const timelineLinkedDocs = [
      { linked_document_id: "doc-1" },
      { linked_document_id: "doc-1" },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockResolvedValue({ data: documents, error: null }),
        } as never;
      }
      return {
        select: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: timelineLinkedDocs, error: null }),
        }),
      } as never;
    });

    const stats = await getDocumentStats();
    expect(stats.withTimeline).toBe(1);
  });

  it("throws when document query fails", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockResolvedValue({ data: null, error: new Error("Doc query failed") }),
        } as never;
      }
      return {} as never;
    });

    await expect(getDocumentStats()).rejects.toThrow("Doc query failed");
  });
});

describe("profile api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProfile = {
    id: "profile-1",
    user_id: "user-1",
    full_name: "Jane Attorney",
    firm_name: "Law Offices of Jane",
    bar_number: "12345",
    phone: "555-0100",
    address: "123 Main St",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  describe("getProfile", () => {
    it("returns profile for the current user", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      } as never);

      const maybeSingle = vi.fn().mockResolvedValue({ data: mockProfile, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getProfile();

      expect(eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(result?.full_name).toBe("Jane Attorney");
    });

    it("returns null when user is not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const result = await getProfile();
      expect(result).toBeNull();
    });

    it("returns null when profile does not exist yet", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      } as never);

      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getProfile();
      expect(result).toBeNull();
    });
  });

  describe("updateProfile", () => {
    it("updates profile fields for the current user", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      } as never);

      const updated = { ...mockProfile, full_name: "Jane B. Attorney" };
      const single = vi.fn().mockResolvedValue({ data: updated, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      const result = await updateProfile({ full_name: "Jane B. Attorney" });

      expect(update).toHaveBeenCalledWith({ full_name: "Jane B. Attorney" });
      expect(eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(result.full_name).toBe("Jane B. Attorney");
    });

    it("throws when not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(updateProfile({ full_name: "x" })).rejects.toThrow("Not authenticated");
    });
  });
});
