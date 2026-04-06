import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  FileText,
  FolderOpen,
  Image,
  Loader2,
  Music,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  countFilesInFolder,
  getGoogleAccessToken,
  GoogleDriveFolder,
  GoogleDriveFolderItem,
  listGoogleDriveFolders,
  loadGoogleAPI,
} from "@/lib/googleDrive";

interface GoogleDriveFolderImportProps {
  caseId: string;
  onImportStarted?: (importJobId: string) => void;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}

const ROOT_BREADCRUMB: FolderBreadcrumb = {
  id: "root",
  name: "My Drive",
};

export function GoogleDriveFolderImport({ caseId, onImportStarted }: GoogleDriveFolderImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [fileCounts, setFileCounts] = useState<{
    total: number;
    documents: number;
    audio: number;
    video: number;
    images: number;
  } | null>(null);
  const [isCountingFiles, setIsCountingFiles] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<GoogleDriveFolderItem[]>([]);
  const [isBrowsingFolders, setIsBrowsingFolders] = useState(false);
  const [folderTrail, setFolderTrail] = useState<FolderBreadcrumb[]>([ROOT_BREADCRUMB]);

  const currentFolder = folderTrail[folderTrail.length - 1];
  const currentFolderPath = useMemo(() => `/${folderTrail.map((folder) => folder.name).join("/")}`, [folderTrail]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsApiLoading(true);
    setApiError(null);
    loadGoogleAPI()
      .then(() => {
        setIsApiLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load Google API:", error);
        setIsApiLoading(false);
        const errorMessage = error instanceof Error ? error.message : "Failed to load Google Drive integration";
        setApiError(errorMessage);
        toast.error(errorMessage);
      });
  }, [isOpen]);

  const resetFolderBrowser = (): void => {
    setAvailableFolders([]);
    setFolderTrail([ROOT_BREADCRUMB]);
  };

  const fetchFolders = async (token: string, folderId: string): Promise<void> => {
    setIsBrowsingFolders(true);
    try {
      const folders = await listGoogleDriveFolders(folderId, token);
      setAvailableFolders(folders);
    } catch (error) {
      console.error("Error loading Google Drive folders:", error);
      throw error;
    } finally {
      setIsBrowsingFolders(false);
    }
  };

  const handleConnectDrive = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setApiError(null);
      const token = await getGoogleAccessToken();
      setAccessToken(token);
      resetFolderBrowser();
      await fetchFolders(token, ROOT_BREADCRUMB.id);
    } catch (error) {
      console.error("Error connecting Google Drive:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect Google Drive";
      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFolder = async (folder: GoogleDriveFolderItem): Promise<void> => {
    if (!accessToken) {
      return;
    }

    try {
      setFolderTrail((currentTrail) => [...currentTrail, { id: folder.id, name: folder.name }]);
      await fetchFolders(accessToken, folder.id);
    } catch (error) {
      setFolderTrail((currentTrail) => currentTrail.slice(0, -1));
      const errorMessage = error instanceof Error ? error.message : "Failed to open folder";
      setApiError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleGoBack = async (): Promise<void> => {
    if (!accessToken || folderTrail.length <= 1) {
      return;
    }

    const nextTrail = folderTrail.slice(0, -1);
    setFolderTrail(nextTrail);
    try {
      await fetchFolders(accessToken, nextTrail[nextTrail.length - 1].id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load parent folder";
      setApiError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleChooseFolder = async (folder: GoogleDriveFolderItem): Promise<void> => {
    if (!accessToken) {
      return;
    }

    const folderPath = `${currentFolderPath}/${folder.name}`;
    const folderSelection: GoogleDriveFolder = {
      id: folder.id,
      name: folder.name,
      path: folderPath,
    };

    setSelectedFolder(folderSelection);
    setIsCountingFiles(true);
    try {
      const counts = await countFilesInFolder(folder.id, accessToken);
      setFileCounts(counts);
    } catch (error) {
      console.error("Error counting files:", error);
      toast.warning("Could not count files in folder, but import can still proceed.");
    } finally {
      setIsCountingFiles(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFolder || !accessToken) {
      return;
    }

    try {
      setIsImporting(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("import-google-drive", {
        body: {
          folderId: selectedFolder.id,
          folderName: selectedFolder.name,
          folderPath: selectedFolder.path,
          caseId,
          accessToken,
        },
      });

      if (error) {
        throw error;
      }

      toast.success(`Importing files from "${selectedFolder.name}". This may take a while for large folders.`);

      if (onImportStarted && data.importJobId) {
        onImportStarted(data.importJobId);
      }

      setSelectedFolder(null);
      setFileCounts(null);
      setAccessToken(null);
      resetFolderBrowser();
      setIsOpen(false);
    } catch (error) {
      console.error("Error starting import:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFolder(null);
    setFileCounts(null);
    setAccessToken(null);
    setApiError(null);
    resetFolderBrowser();
    setIsOpen(false);
  };

  const handleChooseDifferentFolder = async (): Promise<void> => {
    setSelectedFolder(null);
    setFileCounts(null);
    if (accessToken) {
      await fetchFolders(accessToken, currentFolder.id);
    }
  };

  const showBrowser = !selectedFolder && Boolean(accessToken);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          Import from Google Drive
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Import from Google Drive Folder</DialogTitle>
          <DialogDescription>
            Connect to Google Drive, browse folders, and import all supported documents, audio, and video files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {apiError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This importer now uses Google OAuth directly and does not require a Google Picker developer key. Supported:
                PDFs, Word docs, images, audio, and video.
              </AlertDescription>
            </Alert>
          )}

          {!showBrowser && !selectedFolder ? (
            <Button
              onClick={handleConnectDrive}
              disabled={isLoading || isApiLoading || apiError !== null}
              className="w-full gap-2"
              size="lg"
            >
              {isLoading || isApiLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isApiLoading ? "Loading Google Sign-In..." : "Connecting..."}
                </>
              ) : (
                <>
                  <FolderOpen className="h-5 w-5" />
                  Browse Google Drive Folders
                </>
              )}
            </Button>
          ) : null}

          {showBrowser ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Current location</p>
                  <p className="text-sm text-muted-foreground">{currentFolderPath}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGoBack}
                  disabled={folderTrail.length <= 1 || isBrowsingFolders}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
                {isBrowsingFolders ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading folders...
                  </div>
                ) : availableFolders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subfolders found here. Go back and choose a different location.</p>
                ) : (
                  availableFolders.map((folder) => (
                    <div key={folder.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">{folder.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void handleOpenFolder(folder)}>
                          Open
                        </Button>
                        <Button type="button" size="sm" onClick={() => void handleChooseFolder(folder)}>
                          Choose
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {selectedFolder ? (
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{selectedFolder.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedFolder.path}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Selected
                  </Badge>
                </div>

                {isCountingFiles ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Counting files...
                  </div>
                ) : null}

                {fileCounts ? (
                  <div className="space-y-2 border-t pt-2">
                    <p className="text-sm font-medium">Files to import:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span>{fileCounts.documents} documents</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Image className="h-4 w-4 text-green-500" />
                        <span>{fileCounts.images} images</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Music className="h-4 w-4 text-purple-500" />
                        <span>{fileCounts.audio} audio</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Video className="h-4 w-4 text-red-500" />
                        <span>{fileCounts.video} video</span>
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-sm font-semibold">Total: {fileCounts.total} files</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Large folders may take several minutes to import. You can monitor progress from the import jobs section.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {selectedFolder ? (
            <>
              <Button type="button" variant="ghost" onClick={() => void handleChooseDifferentFolder()}>
                Choose Different Folder
              </Button>
              <Button type="button" onClick={handleStartImport} disabled={isImporting || isCountingFiles}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Import...
                  </>
                ) : (
                  "Start Import"
                )}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
