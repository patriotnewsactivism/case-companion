import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countFilesInFolder,
  getFolderPath,
  getGoogleAccessToken,
  listFolderContents,
  listGoogleDriveFolders,
  loadGoogleAPI,
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

  it("resolves immediately when google identity services is already available", async () => {
    (window as Record<string, unknown>).google = {
      accounts: { oauth2: { initTokenClient: vi.fn() } },
    };

    const appendSpy = vi.spyOn(document.body, "appendChild");
    await expect(loadGoogleAPI()).resolves.toBeUndefined();
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("loads the GIS script and waits for oauth readiness", async () => {
    vi.useFakeTimers();

    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      (window as Record<string, unknown>).google = {
        accounts: { oauth2: { initTokenClient: vi.fn() } },
      };
      queueMicrotask(() => script.onload?.(new Event("load")));
      return node;
    });

    const promise = loadGoogleAPI();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
    expect(appendSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("rejects when oauth never becomes ready", async () => {
    vi.useFakeTimers();

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => script.onload?.(new Event("load")));
      return node;
    });

    const promise = loadGoogleAPI();
    await vi.advanceTimersByTimeAsync(10050);
    await expect(promise).rejects.toThrow(/could not finish loading/i);
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
});

describe("Drive browsing helpers", () => {
  it("lists only folders for the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        files: [
          { id: "folder-1", name: "Exhibits", mimeType: "application/vnd.google-apps.folder" },
          { id: "file-1", name: "notes.pdf", mimeType: "application/pdf" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listGoogleDriveFolders("root", "token")).resolves.toEqual([
      { id: "folder-1", name: "Exhibits", isFolder: true },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("orderBy=name"), expect.any(Object));
  });

  it("builds a full folder path from Drive metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ name: "Subfolder", parents: ["parent-1"] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ name: "Cases", parents: ["root"] }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFolderPath("folder-1", "token")).resolves.toBe("/My Drive/Cases/Subfolder");
  });

  it("returns files with isFolder flag set correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: "f1", name: "contract.pdf", mimeType: "application/pdf" },
            { id: "f2", name: "Exhibits", mimeType: "application/vnd.google-apps.folder" },
          ],
        }),
      })
    );

    await expect(listFolderContents("folder-1", "token")).resolves.toEqual([
      { id: "f1", name: "contract.pdf", mimeType: "application/pdf", isFolder: false },
      { id: "f2", name: "Exhibits", mimeType: "application/vnd.google-apps.folder", isFolder: true },
    ]);
  });

  it("counts files recursively", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount += 1;
        const payload =
          callCount === 1
            ? {
                files: [
                  { id: "sub-1", name: "Sub", mimeType: "application/vnd.google-apps.folder" },
                  { id: "f1", name: "doc.pdf", mimeType: "application/pdf" },
                ],
              }
            : { files: [{ id: "f2", name: "photo.jpg", mimeType: "image/jpeg" }] };

        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue(payload) });
      })
    );

    await expect(countFilesInFolder("folder-1", "token")).resolves.toEqual({
      total: 2,
      documents: 1,
      audio: 0,
      video: 0,
      images: 1,
    });
  });
});
