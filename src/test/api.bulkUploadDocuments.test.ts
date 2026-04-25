import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "@/integrations/supabase/client";
import { bulkUploadDocuments } from "@/lib/api";
import { uploadAndProcessFile } from "@/lib/upload/unified-upload-handler";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock("@/lib/upload/unified-upload-handler", () => ({
  uploadAndProcessFile: vi.fn(),
}));

describe("bulkUploadDocuments OCR queue enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1735689600000);
  });

  it("uploads files and marks OCR enqueue requested after queue submission", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn((columns: string) => {
        if (columns === "bates_number") {
          return {
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }

        return { eq: vi.fn() };
      }),
    }) as never);

    vi.mocked(uploadAndProcessFile)
      .mockResolvedValueOnce({
        fileId: "doc-1",
        document: { id: "doc-1", name: "first.pdf" },
        storagePath: "cases/case-1/hash-1/first.pdf",
        queueJobIds: ["job-1"],
        contentHash: "hash-1",
      })
      .mockResolvedValueOnce({
        fileId: "doc-2",
        document: { id: "doc-2", name: "second.png" },
        storagePath: "cases/case-1/hash-2/second.png",
        queueJobIds: ["job-2"],
        contentHash: "hash-2",
      });

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

    expect(uploadAndProcessFile).toHaveBeenNthCalledWith(
      1,
      expect.any(File),
      "case-1",
      "user-1",
      undefined,
      { bates_number: "BATES-0001" },
      8
    );

    expect(uploadAndProcessFile).toHaveBeenNthCalledWith(
      2,
      expect.any(File),
      "case-1",
      "user-1",
      undefined,
      { bates_number: "BATES-0002" },
      8
    );
  });
});
