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

// Declare global gapi and google types (loaded from Google's CDN)
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  path: string;
}

// Track loading state to prevent duplicate requests
let isLoadingGoogleAPI = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Load Google API libraries
 */
export async function loadGoogleAPI(): Promise<void> {
  // Validate that Google API credentials are configured
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY.trim() === '') {
    throw new Error(
      'Google Drive integration is not configured. Please add VITE_GOOGLE_API_KEY to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions.'
    );
  }

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.trim() === '') {
    throw new Error(
      'Google Drive integration is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file. See GOOGLE_DRIVE_SETUP.md for setup instructions.'
    );
  }

  // Check if already loaded and fully initialized
  if (window.gapi?.client && window.google?.accounts) {
    return Promise.resolve();
  }

  // Return existing loading promise if already loading
  if (isLoadingGoogleAPI && loadingPromise) {
    return loadingPromise;
  }

  // Mark as loading and create new promise
  isLoadingGoogleAPI = true;
  loadingPromise = new Promise((resolve, reject) => {
    const SCRIPT_LOAD_TIMEOUT = 15000; // 15 seconds

    // Set timeout for script loading
    const timeoutId: NodeJS.Timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout loading Google APIs. Please check your internet connection and try again.'));
    }, SCRIPT_LOAD_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timeoutId);
      isLoadingGoogleAPI = false;
    };

    // Check if gapi script already exists in DOM
    const existingGapiScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');

    if (existingGapiScript && window.gapi) {
      // Script exists but might not be initialized
      initializeGapi(resolve, reject, cleanup, timeoutId);
    } else {
      // Load gapi script
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;
      gapiScript.onload = () => {
        initializeGapi(resolve, reject, cleanup, timeoutId);
      };
      gapiScript.onerror = () => {
        cleanup();
        reject(new Error('Failed to load Google API script. Please check your internet connection.'));
      };
      document.body.appendChild(gapiScript);
    }
  });

  return loadingPromise;
}

/**
 * Initialize Google API client and load Google Identity Services
 */
function initializeGapi(
  resolve: () => void,
  reject: (error: Error) => void,
  cleanup: () => void,
  timeoutId: NodeJS.Timeout
): void {
  if (!window.gapi) {
    cleanup();
    reject(new Error('Google API object not available'));
    return;
  }

  try {
    window.gapi.load('client:picker', {
      callback: async () => {
        try {
          // Initialize the client
          await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });

          // Check if GIS script already exists
          const existingGisScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

          if (existingGisScript && window.google?.accounts) {
            cleanup();
            resolve();
          } else {
            // Load Google Identity Services
            const gisScript = document.createElement('script');
            gisScript.src = 'https://accounts.google.com/gsi/client';
            gisScript.async = true;
            gisScript.defer = true;
            gisScript.onload = () => {
              // Verify google.accounts is available
              if (window.google?.accounts) {
                cleanup();
                resolve();
              } else {
                cleanup();
                reject(new Error('Google Identity Services loaded but not initialized properly'));
              }
            };
            gisScript.onerror = () => {
              cleanup();
              reject(new Error('Failed to load Google Identity Services script'));
            };
            document.body.appendChild(gisScript);
          }
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error('Failed to initialize Google API client'));
        }
      },
      onerror: () => {
        cleanup();
        reject(new Error('Failed to load Google API client libraries'));
      },
      timeout: 10000, // 10 second timeout for gapi.load
      ontimeout: () => {
        cleanup();
        reject(new Error('Timeout loading Google API client libraries'));
      },
    });
  } catch (error) {
    cleanup();
    reject(error instanceof Error ? error : new Error('Error loading Google API'));
  }
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
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.access_token);
        }
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
      .setCallback(async (data: any) => {
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

    const data = await response.json();
    return (data.files || []).map((file: any) => ({
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
