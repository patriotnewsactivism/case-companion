/**
 * Google Drive Integration Utilities
 * Handles OAuth authentication and folder selection
 */

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"].join(" ");
const GOOGLE_API_SCRIPT_ID = "google-api-script";
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-script";
const GOOGLE_SCRIPT_TIMEOUT_MS = 10000;
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

interface GoogleTokenResponse {
  error?: string;
  access_token?: string;
}

interface GooglePickerDoc {
  id: string;
  name: string;
}

interface GooglePickerResponse {
  action: string;
  docs: GooglePickerDoc[];
}

interface GooglePickerDocsView {
  setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
  setIncludeFolders: (enabled: boolean) => GooglePickerDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GooglePickerDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerResponse) => void | Promise<void>) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface GooglePicker {
  PickerBuilder: new () => GooglePickerBuilder;
  DocsView: new (viewId: unknown) => GooglePickerDocsView;
  ViewId: { FOLDERS: unknown };
  Action: { PICKED: string; CANCEL: string };
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient: (options: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
    }) => { requestAccessToken: () => void };
  };
}

interface GoogleApi {
  accounts?: GoogleAccounts;
  picker?: GooglePicker;
}

interface Gapi {
  load: (api: string, callback: () => void) => void;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

interface DriveListResponse {
  files?: DriveFile[];
}

declare global {
  interface Window {
    gapi?: Gapi;
    google?: GoogleApi;
  }
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  path: string;
}

function isGooglePickerReady(): boolean {
  return Boolean(
    window.gapi?.load &&
      window.google?.accounts?.oauth2?.initTokenClient &&
      window.google?.picker?.PickerBuilder &&
      window.google?.picker?.DocsView &&
      window.google?.picker?.Action
  );
}

function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

function getGoogleApiKey(): string {
  return import.meta.env.VITE_GOOGLE_API_KEY || "";
}

function validateGoogleConfiguration(): void {
  const googleApiKey = getGoogleApiKey();
  const googleClientId = getGoogleClientId();

  if (!googleApiKey || googleApiKey.trim() === "") {
    throw new Error(
      "Google Drive integration is not configured. Please add VITE_GOOGLE_API_KEY to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions."
    );
  }

  if (!googleClientId || googleClientId.trim() === "") {
    throw new Error(
      "Google Drive integration is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions."
    );
  }
}

async function ensureScriptLoaded(id: string, src: string): Promise<void> {
  const existingScript = document.getElementById(id) as HTMLScriptElement | null;
  if (existingScript) {
    if (existingScript.dataset.loaded === "true") {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const handleLoad = () => {
        existingScript.dataset.loaded = "true";
        resolve();
      };
      const handleError = () => reject(new Error(`Failed to load ${src}`));

      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

async function waitForGooglePickerReady(timeoutMs = GOOGLE_SCRIPT_TIMEOUT_MS): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (isGooglePickerReady()) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  throw new Error(
    "Google Drive integration could not finish loading. Verify your Google OAuth client, API key, and allowed origins."
  );
}

function loadPickerLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi?.load) {
      reject(new Error("Google API loader did not initialize correctly."));
      return;
    }

    window.gapi.load("picker", () => {
      if (!window.google?.picker?.PickerBuilder) {
        reject(new Error("Google Picker failed to initialize."));
        return;
      }
      resolve();
    });
  });
}

async function fetchDriveFileMetadata(fileId: string, accessToken: string): Promise<DriveFile> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,parents`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to read Google Drive folder metadata (${response.status})`);
  }

  return (await response.json()) as DriveFile;
}

/**
 * Load Google API libraries
 */
export async function loadGoogleAPI(): Promise<void> {
  validateGoogleConfiguration();

  if (isGooglePickerReady()) {
    return;
  }

  await ensureScriptLoaded(GOOGLE_API_SCRIPT_ID, "https://apis.google.com/js/api.js");
  await loadPickerLibrary();
  await ensureScriptLoaded(GOOGLE_IDENTITY_SCRIPT_ID, "https://accounts.google.com/gsi/client");
  await waitForGooglePickerReady();
}

/**
 * Get Google OAuth access token
 */
export async function getGoogleAccessToken(): Promise<string> {
  validateGoogleConfiguration();

  if (!window.google?.accounts?.oauth2?.initTokenClient) {
    throw new Error(
      "Google Sign-In is not ready yet. Please verify the Google Identity script loaded and that your app origin is allowed in Google Cloud."
    );
  }

  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: getGoogleClientId(),
      scope: SCOPES,
      callback: (response: GoogleTokenResponse) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        if (!response.access_token) {
          reject(new Error("No access token returned"));
          return;
        }

        resolve(response.access_token);
      },
    });

    tokenClient?.requestAccessToken();
  });
}

/**
 * Show Google Drive folder picker
 */
export async function showGoogleDriveFolderPicker(accessToken: string): Promise<GoogleDriveFolder | null> {
  if (!window.google?.picker || !window.gapi?.load) {
    throw new Error("Google Picker is not loaded");
  }

  return new Promise((resolve, reject) => {
    const picker = new window.google!.picker!.PickerBuilder()
      .addView(
        new window.google!.picker!.DocsView(window.google!.picker!.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setIncludeFolders(true)
      )
      .setOAuthToken(accessToken)
      .setDeveloperKey(getGoogleApiKey())
      .setCallback(async (data: GooglePickerResponse) => {
        try {
          if (data.action === window.google!.picker!.Action.PICKED) {
            const folder = data.docs[0];
            const path = await getFolderPath(folder.id, accessToken);

            resolve({
              id: folder.id,
              name: folder.name,
              path,
            });
            return;
          }

          if (data.action === window.google!.picker!.Action.CANCEL) {
            resolve(null);
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Failed to inspect selected Google Drive folder"));
        }
      })
      .build();

    picker.setVisible(true);
  });
}

/**
 * Get the full path of a folder in Google Drive
 */
async function getFolderPath(folderId: string, accessToken: string): Promise<string> {
  const path: string[] = [];
  let currentId: string | undefined = folderId;

  try {
    while (currentId) {
      const file = await fetchDriveFileMetadata(currentId, accessToken);
      path.unshift(file.name);
      currentId = file.parents?.[0];
    }
  } catch (error) {
    console.error("Error getting folder path:", error);
  }

  return `/${path.join("/")}`;
}

/**
 * List files in a Google Drive folder (non-recursive)
 * Useful for previewing what will be imported
 */
export async function listFolderContents(
  folderId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string; isFolder: boolean }>> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to list folder contents");
    }

    const data = (await response.json()) as DriveListResponse;
    return (data.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    }));
  } catch (error) {
    console.error("Error listing folder contents:", error);
    throw error;
  }
}

/**
 * Count total files recursively in a folder (for preview)
 */
export async function countFilesInFolder(
  folderId: string,
  accessToken: string
): Promise<{ total: number; documents: number; audio: number; video: number; images: number }> {
  const counts = {
    total: 0,
    documents: 0,
    audio: 0,
    video: 0,
    images: 0,
  };

  const foldersToProcess = [folderId];

  while (foldersToProcess.length > 0) {
    const currentFolderId = foldersToProcess.shift();
    if (!currentFolderId) {
      continue;
    }

    const contents = await listFolderContents(currentFolderId, accessToken);

    for (const item of contents) {
      if (item.isFolder) {
        foldersToProcess.push(item.id);
      } else {
        counts.total++;
        if (item.mimeType.startsWith("audio/")) {
          counts.audio++;
        } else if (item.mimeType.startsWith("video/")) {
          counts.video++;
        } else if (item.mimeType.startsWith("image/")) {
          counts.images++;
        } else {
          counts.documents++;
        }
      }
    }
  }

  return counts;
}
