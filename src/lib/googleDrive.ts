/**
 * Google Drive Integration Utilities
 * Handles OAuth authentication and folder selection
 */

// Google OAuth configuration
// These should be set in your .env file:
// VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

// Google Drive API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly', // Read-only access to Drive files
].join(' ');

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
  setCallback: (
    callback: (data: GooglePickerResponse) => void | Promise<void>
  ) => GooglePickerBuilder;
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
  accounts: GoogleAccounts;
  picker: GooglePicker;
}

interface GapiClient {
  init: (options: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
  drive: {
    files: {
      get: (options: {
        fileId: string;
        fields: string;
      }) => Promise<{ result: { name: string; parents?: string[] } }>;
    };
  };
}

interface Gapi {
  load: (api: string, callback: () => void) => void;
  client: GapiClient;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveListResponse {
  files?: DriveFile[];
}

// Declare global gapi and google types (loaded from Google's CDN)
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

/**
 * Load Google API libraries
 */
export async function loadGoogleAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate that Google API credentials are configured
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.trim() === '') {
      reject(new Error(
        'Google Drive integration is not configured. Please add VITE_GOOGLE_API_KEY to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions.'
      ));
      return;
    }

    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.trim() === '') {
      reject(new Error(
        'Google Drive integration is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions.'
      ));
      return;
    }

    // Check if already loaded
    if (window.gapi && window.google) {
      resolve();
      return;
    }

    // Load gapi script
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      window.gapi.load('client:picker', async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });

          // Load Google Identity Services
          const gisScript = document.createElement('script');
          gisScript.src = 'https://accounts.google.com/gsi/client';
          gisScript.async = true;
          gisScript.defer = true;
          gisScript.onload = () => resolve();
          gisScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
          document.body.appendChild(gisScript);
        } catch (error) {
          reject(error);
        }
      });
    };
    gapiScript.onerror = () => reject(new Error('Failed to load Google API'));
    document.body.appendChild(gapiScript);
  });
}

/**
 * Get Google OAuth access token
 */
export async function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google API not loaded'));
      return;
    }

    // Validate that Google Client ID is configured
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.trim() === '') {
      reject(new Error(
        'Google Drive integration is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions.'
      ));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response: GoogleTokenResponse) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error('No access token returned'));
          return;
        }
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Show Google Drive folder picker
 */
export async function showGoogleDriveFolderPicker(
  accessToken: string
): Promise<GoogleDriveFolder | null> {
  return new Promise((resolve) => {
    if (!window.google || !window.gapi) {
      throw new Error('Google API not loaded');
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setIncludeFolders(true)
      )
      .setOAuthToken(accessToken)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setCallback(async (data: GooglePickerResponse) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const folder = data.docs[0];

          // Get full folder path
          const path = await getFolderPath(folder.id, accessToken);

          resolve({
            id: folder.id,
            name: folder.name,
            path: path,
          });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
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
  let currentId = folderId;

  try {
    while (currentId) {
      const response = await window.gapi.client.drive.files.get({
        fileId: currentId,
        fields: 'name,parents',
      });

      path.unshift(response.result.name);

      // Move to parent folder
      if (response.result.parents && response.result.parents.length > 0) {
        currentId = response.result.parents[0];
      } else {
        break; // Reached root
      }
    }
  } catch (error) {
    console.error('Error getting folder path:', error);
  }

  return '/' + path.join('/');
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
      throw new Error('Failed to list folder contents');
    }

    const data = (await response.json()) as DriveListResponse;
    return (data.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }));
  } catch (error) {
    console.error('Error listing folder contents:', error);
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
    const currentFolderId = foldersToProcess.shift()!;
    const contents = await listFolderContents(currentFolderId, accessToken);

    for (const item of contents) {
      if (item.isFolder) {
        foldersToProcess.push(item.id);
      } else {
        counts.total++;
        if (item.mimeType.startsWith('audio/')) {
          counts.audio++;
        } else if (item.mimeType.startsWith('video/')) {
          counts.video++;
        } else if (item.mimeType.startsWith('image/')) {
          counts.images++;
        } else {
          counts.documents++;
        }
      }
    }
  }

  return counts;
}
