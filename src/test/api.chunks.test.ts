import { describe, expect, it } from "vitest";
import { getDocumentChunks, getDocumentChunksForContext } from "@/lib/api";
import type { Document } from "@/lib/api";

function makeDoc(ocr_text: string | null): Document {
  return {
    id: "doc-1",
    case_id: "case-1",
    user_id: "user-1",
    name: "test.pdf",
    file_url: null,
    file_type: null,
    file_size: null,
    bates_number: null,
    summary: null,
    key_facts: null,
    favorable_findings: null,
    adverse_findings: null,
    action_items: null,
    ai_analyzed: false,
    ocr_text,
    ocr_processed_at: null,
    ocr_provider: null,
    extracted_tables: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("getDocumentChunks", () => {
  it("returns empty array when ocr_text is null", () => {
    const chunks = getDocumentChunks(makeDoc(null));
    expect(chunks).toEqual([]);
  });

  it("returns empty array when ocr_text is empty string", () => {
    const chunks = getDocumentChunks(makeDoc(""));
    expect(chunks).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const doc = makeDoc("This is a short legal document.");
    const chunks = getDocumentChunks(doc);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("This is a short legal document.");
    expect(chunks[0].startIndex).toBe(0);
    expect(chunks[0].metadata.chunkIndex).toBe(0);
    expect(chunks[0].metadata.totalChunks).toBe(1);
    expect(chunks[0].id).toBe("doc-1-chunk-0");
  });

  it("splits long text into multiple chunks", () => {
    // Create text longer than the default 8000 char chunk size
    const longText = "A".repeat(20000);
    const chunks = getDocumentChunks(makeDoc(longText));

    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should reference the document id
    chunks.forEach((chunk, i) => {
      expect(chunk.id).toBe(`doc-1-chunk-${i}`);
      expect(chunk.metadata.totalChunks).toBe(chunks.length);
    });
  });

  it("prefers breaking at sentence boundaries", () => {
    // Build text where there's a sentence break just before the chunk limit
    const sentence = "The defendant denies all allegations. ";
    const repeated = sentence.repeat(300); // ~11,400 chars
    const chunks = getDocumentChunks(makeDoc(repeated), 8000);

    // First chunk should end at a period/newline rather than mid-word
    const firstChunk = chunks[0];
    const lastChar = firstChunk.content[firstChunk.content.length - 1];
    // Should break at a sentence boundary (period or newline)
    expect(['.', '\n', ' ']).toContain(lastChar);
  });

  it("computes word count and char count metadata correctly", () => {
    const text = "Hello world foo bar";
    const [chunk] = getDocumentChunks(makeDoc(text));

    expect(chunk.metadata.wordCount).toBe(4);
    expect(chunk.metadata.charCount).toBe(text.length);
  });

  it("respects custom maxChunkSize", () => {
    const text = "word ".repeat(100); // 500 chars
    const chunks = getDocumentChunks(makeDoc(text), 100);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(150); // allow boundary overflow
    });
  });

  it("covers entire text with no gaps between chunks", () => {
    const text = "A".repeat(25000);
    const chunks = getDocumentChunks(makeDoc(text), 8000);

    let reconstructed = "";
    for (const chunk of chunks) {
      reconstructed += chunk.content;
    }
    expect(reconstructed).toBe(text);
  });
});

describe("getDocumentChunksForContext", () => {
  it("returns empty string when ocr_text is null", () => {
    const result = getDocumentChunksForContext(makeDoc(null));
    expect(result).toBe("");
  });

  it("returns full text for document within token budget", () => {
    const text = "Short document text.";
    const result = getDocumentChunksForContext(makeDoc(text), 4000);
    expect(result).toBe(text);
  });

  it("truncates to fit within maxTokens budget", () => {
    // maxTokens=10 => maxChars=40 (10 * avgCharsPerToken=4)
    const text = "A".repeat(200);
    const result = getDocumentChunksForContext(makeDoc(text), 10);
    // Should be shorter than full text
    expect(result.length).toBeLessThan(text.length);
  });

  it("trims trailing whitespace from result", () => {
    const text = "Hello world.";
    const result = getDocumentChunksForContext(makeDoc(text));
    expect(result).not.toMatch(/\s+$/);
  });
});
