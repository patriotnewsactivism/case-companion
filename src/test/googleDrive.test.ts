// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadGoogleAPI,
  getGoogleAccessToken,
  listFolderContents,
  countFilesInFolder,
} from "@/lib/googleDrive";

// Reset window globals between tests
afterEach(() => {
  delete (window as Record<string, unknown>).gapi;
  delete (window as Record<string, unknown>).google;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── loadGoogleAPI ────────────────────────────────────────────────────────────

describe("loadGoogleAPI", () => {
  beforeEach(() => {
    // Provide valid env vars by default (Vite replaces import.meta.env at
    // module load time, so we stub the module-level constants via env stubs).
    vi.stubEnv("VITE_GOOGLE_API_KEY", "api-key-123");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-123.apps.googleusercontent.com");
  });

  it("resolves immediately when gapi and google are already on window", async () => {
    (window as Record<string, unknown>).gapi = {};
    (window as Record<string, unknown>).google = {};

    // Because the module caches env vars at import time we can't override them
    // mid-test, but we CAN test the early-exit path directly by manually
    // stubbing the env check. Instead, test the observable: the function
    // should not append any script tags and should resolve.
    const appendSpy = vi.spyOn(document.body, "appendChild");

    // Re-import after stubs are in place – since vitest resets modules we
    // test the behaviour that, when both globals exist, no script is appended.
    const { loadGoogleAPI: load } = await import("@/lib/googleDrive");

    // The function reads module-level consts so we need both keys to be set.
    // We rely on the early-exit guard: if window.gapi && window.google → resolve()
    await expect(load()).resolves.toBeUndefined();
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

// ─── getGoogleAccessToken ─────────────────────────────────────────────────────

describe("getGoogleAccessToken", () => {
  it("rejects when window.google is not loaded", async () => {
    delete (window as Record<string, unknown>).google;

    await expect(getGoogleAccessToken()).rejects.toThrow("Google API not loaded");
  });

  it("resolves with the access token returned by the token client", async () => {
    const requestAccessToken = vi.fn().mockImplementation(function (this: unknown) {
      // Simulate immediate callback with a token
      const self = this as { _callback: (r: { access_token: string }) => void };
      self._callback({ access_token: "access-tok-abc" });
    });

    const tokenClient = { requestAccessToken, _callback: null as unknown };
    const initTokenClient = vi.fn().mockImplementation(({ callback }) => {
      tokenClient._callback = callback;
      return tokenClient;
    });

    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient } },
    };

    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-123.apps.googleusercontent.com");
    const { getGoogleAccessToken: getToken } = await import("@/lib/googleDrive");

    await expect(getToken()).resolves.toBe("access-tok-abc");
  });

  it("rejects when the oauth response contains an error", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn().mockImplementation(({ callback }) => {
      // Immediately invoke callback with an error
      callback({ error: "access_denied" });
      return { requestAccessToken };
    });

    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient } },
    };

    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-123.apps.googleusercontent.com");
    const { getGoogleAccessToken: getToken } = await import("@/lib/googleDrive");

    await expect(getToken()).rejects.toThrow("access_denied");
  });

  it("rejects when no access_token is returned", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn().mockImplementation(({ callback }) => {
      callback({}); // no access_token, no error
      return { requestAccessToken };
    });

    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient } },
    };

    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-123.apps.googleusercontent.com");
    const { getGoogleAccessToken: getToken } = await import("@/lib/googleDrive");

    await expect(getToken()).rejects.toThrow("No access token returned");
  });
});

// ─── listFolderContents ───────────────────────────────────────────────────────

describe("listFolderContents", () => {
  it("returns files with isFolder flag set correctly", async () => {
    const mockFiles = [
      { id: "f1", name: "contract.pdf", mimeType: "application/pdf" },
      { id: "f2", name: "Exhibits", mimeType: "application/vnd.google-apps.folder" },
      { id: "f3", name: "photo.jpg", mimeType: "image/jpeg" },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ files: mockFiles }),
    }));

    const result = await listFolderContents("folder-1", "access-token");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: "f1", name: "contract.pdf", mimeType: "application/pdf", isFolder: false });
    expect(result[1]).toEqual({ id: "f2", name: "Exhibits", mimeType: "application/vnd.google-apps.folder", isFolder: true });
    expect(result[2].isFolder).toBe(false);
  });

  it("returns empty array when folder has no files", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    }));

    const result = await listFolderContents("folder-1", "token");
    expect(result).toEqual([]);
  });

  it("includes the access token in Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listFolderContents("folder-1", "my-token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("folder-1"),
      expect.objectContaining({
        headers: { Authorization: "Bearer my-token" },
      })
    );
  });

  it("throws when the API returns an error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(listFolderContents("folder-1", "token")).rejects.toThrow(
      "Failed to list folder contents"
    );
  });

  it("handles missing files field gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}), // no 'files' key
    }));

    const result = await listFolderContents("folder-1", "token");
    expect(result).toEqual([]);
  });
});

// ─── countFilesInFolder ───────────────────────────────────────────────────────

describe("countFilesInFolder", () => {
  it("categorises files by MIME type", async () => {
    const rootFiles = [
      { id: "a", name: "brief.pdf", mimeType: "application/pdf", isFolder: false },
      { id: "b", name: "recording.mp3", mimeType: "audio/mpeg", isFolder: false },
      { id: "c", name: "deposition.mp4", mimeType: "video/mp4", isFolder: false },
      { id: "d", name: "exhibit.png", mimeType: "image/png", isFolder: false },
      { id: "e", name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", isFolder: false },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ files: rootFiles.map(({ id, name, mimeType }) => ({ id, name, mimeType })) }),
    }));

    const counts = await countFilesInFolder("root-folder", "token");

    expect(counts.total).toBe(5);
    expect(counts.audio).toBe(1);
    expect(counts.video).toBe(1);
    expect(counts.images).toBe(1);
    expect(counts.documents).toBe(2); // pdf + docx
  });

  it("recurses into sub-folders", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      callCount++;
      const data = callCount === 1
        // Root folder: one sub-folder + one file
        ? { files: [
            { id: "sub-1", name: "Sub", mimeType: "application/vnd.google-apps.folder" },
            { id: "f1", name: "doc.pdf", mimeType: "application/pdf" },
          ]}
        // Sub-folder: one file
        : { files: [{ id: "f2", name: "evidence.jpg", mimeType: "image/jpeg" }] };

      return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue(data) });
    }));

    const counts = await countFilesInFolder("root-folder", "token");

    expect(counts.total).toBe(2);      // doc.pdf + evidence.jpg
    expect(counts.documents).toBe(1);  // doc.pdf
    expect(counts.images).toBe(1);     // evidence.jpg
  });

  it("returns all-zero counts for an empty folder", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    }));

    const counts = await countFilesInFolder("empty-folder", "token");

    expect(counts).toEqual({ total: 0, documents: 0, audio: 0, video: 0, images: 0 });
  });
});
