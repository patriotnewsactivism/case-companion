import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCases, getCase, createCase, updateCase, deleteCase } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const mockCase = {
  id: "case-1",
  user_id: "user-1",
  name: "Smith v. Jones",
  case_type: "civil",
  client_name: "John Smith",
  status: "active",
  representation: "plaintiff",
  case_theory: null,
  key_issues: null,
  winning_factors: null,
  next_deadline: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("cases api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCases", () => {
    it("returns cases ordered by updated_at descending", async () => {
      const order = vi.fn().mockResolvedValue({ data: [mockCase], error: null });
      const select = vi.fn().mockReturnValue({ order });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getCases();

      expect(supabase.from).toHaveBeenCalledWith("cases");
      expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Smith v. Jones");
    });

    it("returns empty array when no cases exist", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: null });
      const select = vi.fn().mockReturnValue({ order });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getCases();
      expect(result).toEqual([]);
    });

    it("throws on database error", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") });
      const select = vi.fn().mockReturnValue({ order });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      await expect(getCases()).rejects.toThrow("DB error");
    });
  });

  describe("getCase", () => {
    it("returns the case by id", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: mockCase, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getCase("case-1");

      expect(eq).toHaveBeenCalledWith("id", "case-1");
      expect(result?.name).toBe("Smith v. Jones");
    });

    it("returns null when case not found", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getCase("nonexistent");
      expect(result).toBeNull();
    });

    it("throws on database error", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("Not found") });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      await expect(getCase("case-1")).rejects.toThrow("Not found");
    });
  });

  describe("createCase", () => {
    it("attaches user_id and inserts the case", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      } as never);

      const single = vi.fn().mockResolvedValue({ data: mockCase, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      vi.mocked(supabase.from).mockReturnValue({ insert } as never);

      const result = await createCase({
        name: "Smith v. Jones",
        case_type: "civil",
        client_name: "John Smith",
      });

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-1", name: "Smith v. Jones" })
      );
      expect(result.id).toBe("case-1");
    });

    it("throws when user is not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        createCase({ name: "Test", case_type: "civil", client_name: "Client" })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("updateCase", () => {
    it("updates case fields and returns updated case", async () => {
      const single = vi.fn().mockResolvedValue({ data: { ...mockCase, name: "Updated Name" }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      const result = await updateCase({ id: "case-1", name: "Updated Name" });

      expect(update).toHaveBeenCalledWith({ name: "Updated Name" });
      expect(eq).toHaveBeenCalledWith("id", "case-1");
      expect(result.name).toBe("Updated Name");
    });

    it("throws on database error", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: new Error("Update failed") });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      await expect(updateCase({ id: "case-1", name: "New" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteCase", () => {
    it("deletes case by id", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);

      await deleteCase("case-1");

      expect(del).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith("id", "case-1");
    });

    it("throws on database error", async () => {
      const eq = vi.fn().mockResolvedValue({ error: new Error("Delete failed") });
      const del = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);

      await expect(deleteCase("case-1")).rejects.toThrow("Delete failed");
    });
  });
});
