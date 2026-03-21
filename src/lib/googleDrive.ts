/**
 * Google Drive Integration Utilities
 * Handles OAuth authentication and folder browsing using the Drive REST API.
 */

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"].join(" ");
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-script";

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

export interface GoogleDriveFolderListItem extends GoogleDriveFolder {
  parentId: string | null;
}

function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

function validateGoogleConfiguration(): void {
  const googleClientId = getGoogleClientId();

  if (!googleClientId || googleClientId.trim() === "") {
    throw new Error(
      "Google Drive integration is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file."
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

async function waitForGoogleIdentityReady(timeoutMs = 10000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (window.google?.accounts?.oauth2?.initTokenClient) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }

  throw new Error(
    "Google Drive integration could not finish loading. Verify your Google OAuth client and allowed origins."
  );
}

async function fetchDriveFileMetadata(fileId: string, accessToken: string): Promise<DriveFile> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,parents`,
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

export async function loadGoogleAPI(): Promise<void> {
  validateGoogleConfiguration();

  if (window.google?.accounts?.oauth2?.initTokenClient) {
    return;
  }

  await ensureScriptLoaded(GOOGLE_IDENTITY_SCRIPT_ID, "https://accounts.google.com/gsi/client");
  await waitForGoogleIdentityReady();
}

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

async function getFolderPath(folderId: string, accessToken: string): Promise<string> {
  if (folderId === "root") {
    return "/My Drive";
  }

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

export async function listGoogleDriveFolders(
  folderId: string,
  accessToken: string
): Promise<GoogleDriveFolderListItem[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,parents)&orderBy=name_natural`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list Google Drive folders (${response.status})`);
  }

  const data = (await response.json()) as DriveListResponse;
  const currentPath = await getFolderPath(folderId, accessToken);

  return (data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    path: `${currentPath}/${file.name}`.replace(/\/+/g, "/"),
    parentId: file.parents?.[0] || null,
  }));
}

export async function getGoogleDriveFolder(folderId: string, accessToken: string): Promise<GoogleDriveFolder> {
  const file = await fetchDriveFileMetadata(folderId, accessToken);

  return {
    id: file.id,
    name: file.name,
    path: await getFolderPath(folderId, accessToken),
  };
}

export async function listFolderContents(
  folderId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; mimeType: string; isFolder: boolean }>> {
  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)`,
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
      isFolder: file.mimeType === "application/vnd.google-apps.folder",
    }));
  } catch (error) {
    console.error("Error listing folder contents:", error);
    throw error;
  }
}

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
