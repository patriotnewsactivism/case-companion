/**
 * Google Drive Integration Utilities
 * Uses Google Identity Services for OAuth and Drive REST APIs for browsing.
 */

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"].join(" ");
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-script";
const GOOGLE_SCRIPT_TIMEOUT_MS = 10000;
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const ROOT_FOLDER_ID = "root";
const ROOT_FOLDER_NAME = "My Drive";

interface GoogleTokenResponse {
  error?: string;
  access_token?: string;
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
    google?: GoogleApi;
  }
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  path: string;
}

export interface GoogleDriveFolderItem {
  id: string;
  name: string;
  isFolder: boolean;
}

function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

function validateGoogleConfiguration(): void {
  const googleClientId = getGoogleClientId();

  if (!googleClientId || googleClientId.trim() === "") {
    throw new Error(
      "Google Drive integration is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions."
    );
  }
}

function isGoogleIdentityReady(): boolean {
  return Boolean(window.google?.accounts?.oauth2?.initTokenClient);
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

async function waitForGoogleIdentityReady(timeoutMs = GOOGLE_SCRIPT_TIMEOUT_MS): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (isGoogleIdentityReady()) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  throw new Error(
    "Google Drive integration could not finish loading. Verify your Google OAuth client and allowed origins."
  );
}

async function fetchDriveJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function fetchDriveFileMetadata(fileId: string, accessToken: string): Promise<DriveFile> {
  return fetchDriveJson<DriveFile>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,parents`,
    accessToken
  );
}

/**
 * Load Google Identity Services.
 */
export async function loadGoogleAPI(): Promise<void> {
  validateGoogleConfiguration();

  if (isGoogleIdentityReady()) {
    return;
  }

  await ensureScriptLoaded(GOOGLE_IDENTITY_SCRIPT_ID, "https://accounts.google.com/gsi/client");
  await waitForGoogleIdentityReady();
}

/**
 * Get Google OAuth access token.
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
 * Get the full path of a folder in Google Drive.
 */
export async function getFolderPath(folderId: string, accessToken: string): Promise<string> {
  const path: string[] = [];
  let currentId: string | undefined = folderId;

  try {
    while (currentId && currentId !== ROOT_FOLDER_ID) {
      const file = await fetchDriveFileMetadata(currentId, accessToken);
      path.unshift(file.name);
      currentId = file.parents?.[0];
    }
  } catch (error) {
    console.error("Error getting folder path:", error);
  }

  return `/${ROOT_FOLDER_NAME}${path.length > 0 ? `/${path.join("/")}` : ""}`;
}

/**
 * List folders in a Google Drive folder for custom browsing.
 */
export async function listGoogleDriveFolders(
  folderId: string,
  accessToken: string
): Promise<GoogleDriveFolderItem[]> {
  const query = folderId === ROOT_FOLDER_ID ? "'root'+in+parents+and+trashed=false" : `'${folderId}'+in+parents+and+trashed=false`;
  const data = await fetchDriveJson<DriveListResponse>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=name`,
    accessToken
  );

  return (data.files || [])
    .filter((file) => file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE)
    .map((file) => ({
      id: file.id,
      name: file.name,
      isFolder: true,
    }));
}

/**
 * List files in a Google Drive folder (non-recursive)
 * Useful for previewing what will be imported.
 */
export async function listFolderContents(
  folderId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string; isFolder: boolean }>> {
  try {
    const data = await fetchDriveJson<DriveListResponse>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}'+in+parents+and+trashed=false`)}&fields=files(id,name,mimeType)`,
      accessToken
    );

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
 * Count total files recursively in a folder (for preview).
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
