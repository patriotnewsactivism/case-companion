import { describe, expect, it } from "vitest";
import {
  chunkText,
  chunkDocumentWithPages,
  mergeChunks,
  getChunksForContext,
  findRelevantChunks,
  formatChunksForAI,
  estimateTokenCount,
  optimizeChunksForTokenLimit,
} from "@/lib/text-chunking";

// ── chunkText ─────────────────────────────────────────────────────────────────

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const text = "This is a brief legal document.";
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].startIndex).toBe(0);
    expect(chunks[0].endIndex).toBe(text.length);
    expect(chunks[0].metadata.totalChunks).toBe(1);
    expect(chunks[0].metadata.chunkIndex).toBe(0);
  });

  it("splits long text into multiple chunks", () => {
    const text = "A ".repeat(5000); // 10,000 chars – exceeds default 8,000
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it("assigns sequential chunkIndex values", () => {
    const text = "Word ".repeat(2000); // ~10,000 chars
    const chunks = chunkText(text);

    chunks.forEach((chunk, i) => {
      expect(chunk.metadata.chunkIndex).toBe(i);
    });
  });

  it("sets totalChunks consistently across all chunks", () => {
    const text = "X ".repeat(5000);
    const chunks = chunkText(text);
    const total = chunks.length;

    chunks.forEach((chunk) => {
      expect(chunk.metadata.totalChunks).toBe(total);
    });
  });

  it("links previousChunkId / nextChunkId correctly", () => {
    const text = "Y ".repeat(5000);
    const chunks = chunkText(text);

    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].metadata.previousChunkId).toBe(chunks[i - 1].id);
      expect(chunks[i - 1].metadata.nextChunkId).toBe(chunks[i].id);
    }
    // First chunk has no previous
    expect(chunks[0].metadata.previousChunkId).toBeUndefined();
    // Last chunk has no next
    expect(chunks[chunks.length - 1].metadata.nextChunkId).toBeUndefined();
  });

  it("respects custom maxChunkSize", () => {
    const text = "A ".repeat(1000); // 2,000 chars
    const chunks = chunkText(text, { maxChunkSize: 500 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      // Each chunk may slightly exceed due to sentence-boundary adjustment
      expect(chunk.content.length).toBeLessThanOrEqual(700);
    });
  });

  it("computes word count correctly", () => {
    const text = "one two three four five";
    const [chunk] = chunkText(text);
    expect(chunk.metadata.wordCount).toBe(5);
  });

  it("computes char count correctly", () => {
    const text = "hello world";
    const [chunk] = chunkText(text);
    expect(chunk.metadata.charCount).toBe(11);
  });
});

// ── chunkDocumentWithPages ────────────────────────────────────────────────────

describe("chunkDocumentWithPages", () => {
  it("assigns correct page numbers to each chunk", () => {
    const page1 = "Page one content. ";
    const page2 = "Page two content. ";
    const text = page1 + page2;
    const pageBreaks = [page1.length];

    const chunks = chunkDocumentWithPages(text, pageBreaks);

    expect(chunks[0].pageNumber).toBe(1);
    // Second page becomes page 2
    expect(chunks[chunks.length - 1].pageNumber).toBeGreaterThanOrEqual(2);
  });

  it("handles document with no page breaks", () => {
    const text = "Single page document.";
    const chunks = chunkDocumentWithPages(text, []);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageNumber).toBe(1);
  });

  it("sets totalChunks consistently", () => {
    const text = "Content. ".repeat(2000);
    const pageBreaks = [text.length / 2];
    const chunks = chunkDocumentWithPages(text, pageBreaks);
    const total = chunks.length;

    chunks.forEach((chunk) => {
      expect(chunk.metadata.totalChunks).toBe(total);
    });
  });
});

// ── mergeChunks ───────────────────────────────────────────────────────────────

describe("mergeChunks", () => {
  function makeChunk(content: string, index = 0) {
    return {
      id: `chunk-${index}`,
      content,
      startIndex: 0,
      endIndex: content.length,
      metadata: { chunkIndex: index, totalChunks: 1, wordCount: content.split(" ").length, charCount: content.length },
    };
  }

  it("concatenates chunks within size limit", () => {
    const chunks = [makeChunk("hello", 0), makeChunk("world", 1)];
    const result = mergeChunks(chunks, 100);
    expect(result).toContain("hello");
    expect(result).toContain("world");
  });

  it("truncates to fit maxResultSize", () => {
    const chunks = [makeChunk("A".repeat(200))];
    const result = mergeChunks(chunks, 50);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("stops adding chunks when size limit is reached", () => {
    const chunks = [makeChunk("AAA"), makeChunk("BBB"), makeChunk("CCC")];
    const result = mergeChunks(chunks, 5);
    expect(result).not.toContain("CCC");
  });
});

// ── getChunksForContext ───────────────────────────────────────────────────────

describe("getChunksForContext", () => {
  const chunks = Array.from({ length: 10 }, (_, i) => ({
    id: `c-${i}`,
    content: `chunk ${i}`,
    startIndex: i * 10,
    endIndex: (i + 1) * 10,
    metadata: { chunkIndex: i, totalChunks: 10, wordCount: 2, charCount: 7 },
  }));

  it("returns surrounding chunks within contextSize", () => {
    const result = getChunksForContext(chunks, 5, 2);
    expect(result).toHaveLength(5); // indices 3,4,5,6,7
    expect(result[0].metadata.chunkIndex).toBe(3);
    expect(result[4].metadata.chunkIndex).toBe(7);
  });

  it("clamps to start of array", () => {
    const result = getChunksForContext(chunks, 0, 3);
    expect(result[0].metadata.chunkIndex).toBe(0);
  });

  it("clamps to end of array", () => {
    const result = getChunksForContext(chunks, 9, 3);
    expect(result[result.length - 1].metadata.chunkIndex).toBe(9);
  });
});

// ── findRelevantChunks ────────────────────────────────────────────────────────

describe("findRelevantChunks", () => {
  const chunks = [
    { id: "c0", content: "contract breach damages plaintiff claims", startIndex: 0, endIndex: 40, metadata: { chunkIndex: 0, totalChunks: 3, wordCount: 5, charCount: 40 } },
    { id: "c1", content: "defendant negligence duty care breach", startIndex: 40, endIndex: 80, metadata: { chunkIndex: 1, totalChunks: 3, wordCount: 5, charCount: 36 } },
    { id: "c2", content: "settlement agreement arbitration clause", startIndex: 80, endIndex: 120, metadata: { chunkIndex: 2, totalChunks: 3, wordCount: 4, charCount: 38 } },
  ];

  it("returns top-K most relevant chunks for a query", () => {
    const result = findRelevantChunks(chunks, "breach contract", 2);
    expect(result).toHaveLength(2);
    // "breach" appears in both c0 and c1; c0 also has "contract"
    expect(result[0].id).toBe("c0");
  });

  it("respects topK limit", () => {
    const result = findRelevantChunks(chunks, "breach", 1);
    expect(result).toHaveLength(1);
  });

  it("returns chunks in score-descending order", () => {
    const result = findRelevantChunks(chunks, "breach", 3);
    // Both c0 and c1 contain "breach" – they should appear before c2
    const ids = result.map((c) => c.id);
    expect(ids.indexOf("c2")).toBeGreaterThan(ids.indexOf("c0"));
  });
});

// ── formatChunksForAI ─────────────────────────────────────────────────────────

describe("formatChunksForAI", () => {
  it("includes chunk headers with total count", () => {
    const chunks = [
      { id: "c0", content: "First chunk.", startIndex: 0, endIndex: 12, metadata: { chunkIndex: 0, totalChunks: 2, wordCount: 2, charCount: 12 } },
      { id: "c1", content: "Second chunk.", startIndex: 12, endIndex: 25, metadata: { chunkIndex: 1, totalChunks: 2, wordCount: 2, charCount: 13 } },
    ];

    const result = formatChunksForAI(chunks);

    expect(result).toContain("[Chunk 1/2]");
    expect(result).toContain("[Chunk 2/2]");
    expect(result).toContain("First chunk.");
    expect(result).toContain("Second chunk.");
  });

  it("includes page number when present", () => {
    const chunks = [
      {
        id: "c0",
        content: "Page content.",
        pageNumber: 3,
        startIndex: 0,
        endIndex: 13,
        metadata: { chunkIndex: 0, totalChunks: 1, wordCount: 2, charCount: 13 },
      },
    ];

    const result = formatChunksForAI(chunks);
    expect(result).toContain("(Page 3)");
  });
});

// ── estimateTokenCount ────────────────────────────────────────────────────────

describe("estimateTokenCount", () => {
  it("estimates 1 token per 4 characters", () => {
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("abcdefgh")).toBe(2);
  });

  it("rounds up fractional tokens", () => {
    expect(estimateTokenCount("abc")).toBe(1); // 3 chars → ceil(3/4)=1
    expect(estimateTokenCount("abcde")).toBe(2); // 5 chars → ceil(5/4)=2
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokenCount("")).toBe(0);
  });
});

// ── optimizeChunksForTokenLimit ───────────────────────────────────────────────

describe("optimizeChunksForTokenLimit", () => {
  function makeChunk(content: string, index = 0) {
    return {
      id: `c-${index}`,
      content,
      startIndex: 0,
      endIndex: content.length,
      metadata: { chunkIndex: index, totalChunks: 3, wordCount: 1, charCount: content.length },
    };
  }

  it("includes chunks up to the token limit", () => {
    const chunks = [
      makeChunk("A".repeat(40), 0), // 10 tokens
      makeChunk("B".repeat(40), 1), // 10 tokens
      makeChunk("C".repeat(40), 2), // 10 tokens
    ];

    const result = optimizeChunksForTokenLimit(chunks, 20); // allow 20 tokens
    expect(result).toHaveLength(2);
  });

  it("truncates a single oversized chunk to fit", () => {
    const chunks = [makeChunk("Z".repeat(400), 0)]; // 100 tokens
    const result = optimizeChunksForTokenLimit(chunks, 10); // 10 tokens = 40 chars

    expect(result).toHaveLength(1);
    expect(result[0].content.length).toBe(40);
  });

  it("returns empty array when chunks list is empty", () => {
    expect(optimizeChunksForTokenLimit([], 100)).toEqual([]);
  });
});
