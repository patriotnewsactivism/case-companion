import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkUploadDocuments } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("bulkUploadDocuments OCR queue enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1735689600000);
  });

  it("uploads files and enqueues OCR jobs asynchronously through queue processor", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    let insertedCount = 0;
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn((columns: string) => {
        if (columns === "bates_number") {
          return {
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }

        return { eq: vi.fn() };
      }),
      insert: vi.fn((payload: Record<string, unknown>) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: `doc-${++insertedCount}`,
              case_id: payload.case_id,
              user_id: payload.user_id,
              name: payload.name,
              file_url: payload.file_url,
              file_type: payload.file_type,
              file_size: payload.file_size,
              bates_number: payload.bates_number ?? null,
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
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
            error: null,
          }),
        }),
      })),
    }) as never);

    const upload = vi
      .fn()
      .mockResolvedValueOnce({ data: { path: "path-1" }, error: null })
      .mockResolvedValueOnce({ data: { path: "path-2" }, error: null });
    const getPublicUrl = vi
      .fn()
      .mockReturnValueOnce({ data: { publicUrl: "https://files/1" } })
      .mockReturnValueOnce({ data: { publicUrl: "https://files/2" } });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload,
      getPublicUrl,
    } as never);

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { processed: 0, remaining: 2, failed: 0, jobs: [] },
      error: null,
    } as never);

    const result = await bulkUploadDocuments({
      case_id: "case-1",
      files: [
        new File(["pdf"], "first.pdf", { type: "application/pdf" }),
        new File(["img"], "second.png", { type: "image/png" }),
      ],
      generate_bates: true,
      bates_prefix: "BATES",
      ocr_priority: 8,
    });

    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.documents).toHaveLength(2);
    expect(result.ocr_enqueue_requested).toBe(true);
    expect(result.ocr_enqueue_error).toBeNull();

    expect(supabase.functions.invoke).toHaveBeenCalledWith("ocr-queue-processor", {
      body: {
        action: "enqueue",
        caseId: "case-1",
        documentIds: ["doc-1", "doc-2"],
        priority: 8,
      },
    });
  });
});
