import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAndProcessFile, shouldRetryDocumentInsertWithoutContentHash } from "@/lib/upload/unified-upload-handler";
import { supabase } from "@/integrations/supabase/client";
import { QueueManager } from "@/lib/queue-manager";
import { hashFile } from "@/lib/hashing";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock("@/lib/queue-manager", () => ({
  QueueManager: {
    enqueueFile: vi.fn(),
  },
}));

vi.mock("@/lib/hashing", () => ({
  hashFile: vi.fn(),
}));

describe("uploadAndProcessFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries document insert without content_hash when schema is behind", async () => {
    vi.mocked(hashFile).mockResolvedValue("hash-123");

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    const insertWithHash = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Could not find the 'content_hash' column of 'documents' in the schema cache",
          },
        }),
      }),
    });

    const insertWithoutHash = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "doc-1" },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ insert: insertWithHash } as never)
      .mockReturnValueOnce({ insert: insertWithoutHash } as never);

    vi.mocked(QueueManager.enqueueFile).mockResolvedValue(["job-1"]);

    const file = new File(["abc"], "test.pdf", { type: "application/pdf" });
    const result = await uploadAndProcessFile(file, "case-1", "user-1");

    expect(insertWithHash).toHaveBeenCalledWith(
      expect.objectContaining({
        content_hash: "hash-123",
      })
    );
    expect(insertWithoutHash).toHaveBeenCalledWith(
      expect.not.objectContaining({ content_hash: expect.anything() })
    );
    expect(QueueManager.enqueueFile).toHaveBeenCalled();
    expect(result.fileId).toBe("doc-1");
  });

  it("detects content_hash schema-cache errors", () => {
    expect(
      shouldRetryDocumentInsertWithoutContentHash(
        "Could not find the 'content_hash' column of 'documents' in the schema cache"
      )
    ).toBe(true);
    expect(shouldRetryDocumentInsertWithoutContentHash("some other postgres error")).toBe(false);
  });
});
