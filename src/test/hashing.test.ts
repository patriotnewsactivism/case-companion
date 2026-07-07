import { beforeAll, describe, expect, it } from "vitest";
import { hashFile, hashText } from "@/lib/hashing";

// jsdom's File/Blob may not implement arrayBuffer() in all versions –
// provide a polyfill so crypto.subtle.digest can receive the data.
beforeAll(() => {
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

describe("hashText", () => {
  it("returns a 64-character hex string", async () => {
    const hash = await hashText("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("produces the same hash for identical input", async () => {
    const a = await hashText("same content");
    const b = await hashText("same content");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashText("content A");
    const b = await hashText("content B");
    expect(a).not.toBe(b);
  });

  it("handles empty string", async () => {
    const hash = await hashText("");
    expect(hash).toHaveLength(64);
  });
});

describe("hashFile", () => {
  it("returns a 64-character hex string for a File", async () => {
    const file = new File(["legal document content"], "brief.pdf", { type: "application/pdf" });
    const hash = await hashFile(file);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("produces the same hash for identical file content", async () => {
    const content = "identical content";
    const file1 = new File([content], "a.txt");
    const file2 = new File([content], "b.txt"); // different name, same content
    const [h1, h2] = await Promise.all([hashFile(file1), hashFile(file2)]);
    expect(h1).toBe(h2);
  });

  it("produces different hashes for files with different content", async () => {
    const file1 = new File(["content one"], "one.txt");
    const file2 = new File(["content two"], "two.txt");
    const [h1, h2] = await Promise.all([hashFile(file1), hashFile(file2)]);
    expect(h1).not.toBe(h2);
  });

  it("produces the same hash as hashText for the same string content", async () => {
    const content = "cross-function consistency check";
    const file = new File([content], "test.txt");
    const [fileHash, textHash] = await Promise.all([hashFile(file), hashText(content)]);
    expect(fileHash).toBe(textHash);
  });
});
