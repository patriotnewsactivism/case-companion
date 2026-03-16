import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDocumentsByCase,
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  triggerDocumentAnalysis,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockDocument = {
  id: "doc-1",
  case_id: "case-1",
  user_id: "user-1",
  name: "Contract.pdf",
  file_url: "https://example.com/contract.pdf",
  file_type: "application/pdf",
  file_size: 1024,
  bates_number: "DOC-0001",
  summary: null,
  key_facts: null,
  favorable_findings: null,
  adverse_findings: null,
  action_items: null,
  ai_analyzed: false,
  ocr_text: null,
  ocr_processed_at: null,
  ocr_provider: null,
  extracted_tables: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("documents api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDocumentsByCase", () => {
    it("returns documents for a case ordered by created_at descending", async () => {
      const order = vi.fn().mockResolvedValue({ data: [mockDocument], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getDocumentsByCase("case-1");

      expect(supabase.from).toHaveBeenCalledWith("documents");
      expect(eq).toHaveBeenCalledWith("case_id", "case-1");
      expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Contract.pdf");
    });

    it("returns empty array when no documents exist", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getDocumentsByCase("case-1");
      expect(result).toEqual([]);
    });

    it("throws on database error", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: new Error("Query error") });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      await expect(getDocumentsByCase("case-1")).rejects.toThrow("Query error");
    });
  });

  describe("getAllDocuments", () => {
    it("returns all documents ordered by created_at descending", async () => {
      const order = vi.fn().mockResolvedValue({ data: [mockDocument], error: null });
      const select = vi.fn().mockReturnValue({ order });
      vi.mocked(supabase.from).mockReturnValue({ select } as never);

      const result = await getAllDocuments();

      expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(result).toHaveLength(1);
    });
  });

  describe("createDocument", () => {
    it("attaches user_id and inserts document", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      } as never);

      const single = vi.fn().mockResolvedValue({ data: mockDocument, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      vi.mocked(supabase.from).mockReturnValue({ insert } as never);

      const result = await createDocument({
        case_id: "case-1",
        name: "Contract.pdf",
        file_url: "https://example.com/contract.pdf",
        file_type: "application/pdf",
        file_size: 1024,
      });

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-1", case_id: "case-1", name: "Contract.pdf" })
      );
      expect(result.id).toBe("doc-1");
    });

    it("throws when not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      await expect(
        createDocument({ case_id: "case-1", name: "doc.pdf", file_url: null, file_type: null, file_size: null })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("updateDocument", () => {
    it("updates document fields by id", async () => {
      const single = vi.fn().mockResolvedValue({ data: { ...mockDocument, summary: "A contract" }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      const result = await updateDocument("doc-1", { summary: "A contract" });

      expect(update).toHaveBeenCalledWith({ summary: "A contract" });
      expect(eq).toHaveBeenCalledWith("id", "doc-1");
      expect(result.summary).toBe("A contract");
    });

    it("throws on database error", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: new Error("Update failed") });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as never);

      await expect(updateDocument("doc-1", { summary: "x" })).rejects.toThrow("Update failed");
    });
  });

  describe("deleteDocument", () => {
    it("deletes document by id", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);

      await deleteDocument("doc-1");

      expect(del).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith("id", "doc-1");
    });

    it("throws on database error", async () => {
      const eq = vi.fn().mockResolvedValue({ error: new Error("Delete failed") });
      const del = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as never);

      await expect(deleteDocument("doc-1")).rejects.toThrow("Delete failed");
    });
  });

  describe("triggerDocumentAnalysis", () => {
    it("calls OCR edge function with document id and file url", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: "tok-1" } },
        error: null,
      } as never);

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      vi.stubGlobal("import", { meta: { env: { VITE_SUPABASE_URL: "https://proj.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "anon-key" } } });

      await triggerDocumentAnalysis("doc-1", "https://example.com/file.pdf");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("ocr-document"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ documentId: "doc-1", fileUrl: "https://example.com/file.pdf" }),
        })
      );

      vi.unstubAllGlobals();
    });

    it("throws when not authenticated", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as never);

      await expect(
        triggerDocumentAnalysis("doc-1", "https://example.com/file.pdf")
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when OCR endpoint returns an error response", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: "tok-1" } },
        error: null,
      } as never);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        triggerDocumentAnalysis("doc-1", "https://example.com/file.pdf")
      ).rejects.toThrow("Internal Server Error");

      vi.unstubAllGlobals();
    });
  });
});
