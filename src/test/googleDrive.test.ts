import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadGoogleAPI,
  getGoogleAccessToken,
  getGoogleDriveFolder,
  listGoogleDriveFolders,
  listFolderContents,
  countFilesInFolder,
} from "@/lib/googleDrive";

afterEach(() => {
  delete (window as Record<string, unknown>).google;
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("loadGoogleAPI", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-123.apps.googleusercontent.com");
  });

  it("resolves immediately when oauth is already available", async () => {
    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient: vi.fn() } },
    };

    const appendSpy = vi.spyOn(document.body, "appendChild");

    await expect(loadGoogleAPI()).resolves.toBeUndefined();
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("loads the identity script and waits for oauth readiness", async () => {
    vi.useFakeTimers();

    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const script = node as HTMLScriptElement;

      if (script.id === "google-identity-script") {
        (window as Record<string, unknown>).google = {
          accounts: { oauth2: { initTokenClient: vi.fn() } },
        };
      }

      queueMicrotask(() => script.onload?.(new Event("load")));
      return node;
    });

    const promise = loadGoogleAPI();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();

    expect(appendSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("rejects when google identity services never exposes oauth2", async () => {
    vi.useFakeTimers();

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => script.onload?.(new Event("load")));
      return node;
    });

    const promise = loadGoogleAPI();
    const rejection = expect(promise).rejects.toThrow(/could not finish loading/i);

    await vi.advanceTimersByTimeAsync(10050);
    await rejection;
    vi.useRealTimers();
  });
});

describe("getGoogleAccessToken", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-123.apps.googleusercontent.com");
  });

  it("rejects when oauth2 is not loaded", async () => {
    (window as Record<string, unknown>).google = {};

    await expect(getGoogleAccessToken()).rejects.toThrow(/sign-in is not ready/i);
  });

  it("resolves with the access token returned by the token client", async () => {
    const requestAccessToken = vi.fn().mockImplementation(function (this: unknown) {
      const self = this as { _callback: (response: { access_token: string }) => void };
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

    await expect(getGoogleAccessToken()).resolves.toBe("access-tok-abc");
  });

  it("rejects when the oauth response contains an error", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn().mockImplementation(({ callback }) => {
      callback({ error: "access_denied" });
      return { requestAccessToken };
    });

    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient } },
    };

    await expect(getGoogleAccessToken()).rejects.toThrow("access_denied");
  });

  it("rejects when no access_token is returned", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn().mockImplementation(({ callback }) => {
      callback({});
      return { requestAccessToken };
    });

    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient } },
    };

    await expect(getGoogleAccessToken()).rejects.toThrow("No access token returned");
  });
});

describe("listGoogleDriveFolders", () => {
  it("lists child folders and builds their paths", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [{ id: "folder-a", name: "Evidence", parents: ["root"] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "root", name: "My Drive" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(listGoogleDriveFolders("root", "token")).resolves.toEqual([
      {
        id: "folder-a",
        name: "Evidence",
        path: "/My Drive/Evidence",
        parentId: "root",
      },
    ]);
  });

  it("throws when the folder listing request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(listGoogleDriveFolders("root", "token")).rejects.toThrow(/failed to list google drive folders/i);
  });
});

describe("getGoogleDriveFolder", () => {
  it("returns folder metadata with the full path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "child", name: "Child", parents: ["parent"] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "child", name: "Child", parents: ["parent"] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "parent", name: "Parent", parents: ["root"] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "root", name: "My Drive", parents: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(getGoogleDriveFolder("child", "token")).resolves.toEqual({
      id: "child",
      name: "Child",
      path: "/My Drive/Parent/Child",
    });
  });
});

describe("listFolderContents", () => {
  it("returns files with isFolder flag set correctly", async () => {
    const mockFiles = [
      { id: "f1", name: "contract.pdf", mimeType: "application/pdf" },
      { id: "f2", name: "Exhibits", mimeType: "application/vnd.google-apps.folder" },
      { id: "f3", name: "photo.jpg", mimeType: "image/jpeg" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ files: mockFiles }),
      })
    );

    const result = await listFolderContents("folder-1", "access-token");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: "f1", name: "contract.pdf", mimeType: "application/pdf", isFolder: false });
    expect(result[1]).toEqual({
      id: "f2",
      name: "Exhibits",
      mimeType: "application/vnd.google-apps.folder",
      isFolder: true,
    });
    expect(result[2].isFolder).toBe(false);
  });

  it("returns empty array when folder has no files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ files: [] }),
      })
    );

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

    await expect(listFolderContents("folder-1", "token")).rejects.toThrow("Failed to list folder contents");
  });

  it("handles missing files field gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })
    );

    const result = await listFolderContents("folder-1", "token");
    expect(result).toEqual([]);
  });
});

describe("countFilesInFolder", () => {
  it("categorises files by MIME type", async () => {
    const rootFiles = [
      { id: "a", name: "brief.pdf", mimeType: "application/pdf", isFolder: false },
      { id: "b", name: "recording.mp3", mimeType: "audio/mpeg", isFolder: false },
      { id: "c", name: "deposition.mp4", mimeType: "video/mp4", isFolder: false },
      { id: "d", name: "exhibit.png", mimeType: "image/png", isFolder: false },
      { id: "e", name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", isFolder: false },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: rootFiles.map(({ id, name, mimeType }) => ({ id, name, mimeType })),
        }),
      })
    );

    const counts = await countFilesInFolder("root-folder", "token");

    expect(counts.total).toBe(5);
    expect(counts.audio).toBe(1);
    expect(counts.video).toBe(1);
    expect(counts.images).toBe(1);
    expect(counts.documents).toBe(2);
  });

  it("recurses into sub-folders", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        const data =
          callCount === 1
            ? {
                files: [
                  { id: "sub-1", name: "Sub", mimeType: "application/vnd.google-apps.folder" },
                  { id: "f1", name: "doc.pdf", mimeType: "application/pdf" },
                ],
              }
            : { files: [{ id: "f2", name: "evidence.jpg", mimeType: "image/jpeg" }] };

        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue(data) });
      })
    );

    const counts = await countFilesInFolder("root-folder", "token");

    expect(counts.total).toBe(2);
    expect(counts.documents).toBe(1);
    expect(counts.images).toBe(1);
  });

  it("returns all-zero counts for an empty folder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ files: [] }),
      })
    );

    const counts = await countFilesInFolder("empty-folder", "token");

    expect(counts).toEqual({ total: 0, documents: 0, audio: 0, video: 0, images: 0 });
  });
});
