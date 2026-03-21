import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, Loader2, AlertCircle, CheckCircle2, FileText, Music, Video, Image, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  loadGoogleAPI,
  getGoogleAccessToken,
  listGoogleDriveFolders,
  getGoogleDriveFolder,
  countFilesInFolder,
  type GoogleDriveFolder,
  type GoogleDriveFolderListItem,
} from '@/lib/googleDrive';

interface GoogleDriveFolderImportProps {
  caseId: string;
  onImportStarted?: (importJobId: string) => void;
}

export function GoogleDriveFolderImport({ caseId, onImportStarted }: GoogleDriveFolderImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('/My Drive');
  const [folderHistory, setFolderHistory] = useState<GoogleDriveFolder[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolderListItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsApiLoading(true);
      setApiError(null);
      loadGoogleAPI()
        .then(() => {
          setIsApiLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load Google API:', error);
          setIsApiLoading(false);
          const errorMessage = error instanceof Error ? error.message : 'Failed to load Google Drive integration';
          setApiError(errorMessage);
          toast.error(errorMessage);
        });
    }
  }, [isOpen]);

  const loadFolders = async (folderId: string, token: string, history: GoogleDriveFolder[]): Promise<void> => {
    setIsLoadingFolders(true);

    try {
      const nextFolders = await listGoogleDriveFolders(folderId, token);
      setFolders(nextFolders);
      setFolderHistory(history);
      setCurrentFolderId(folderId);
      setCurrentFolderPath(history[history.length - 1]?.path || '/My Drive');
    } catch (error) {
      console.error('Error loading folders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load Google Drive folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleAuthenticate = async () => {
    try {
      setIsAuthenticating(true);
      const token = await getGoogleAccessToken();
      setAccessToken(token);
      setSelectedFolder(null);
      setFileCounts(null);
      await loadFolders('root', token, []);
    } catch (error) {
      console.error('Error authenticating with Google Drive:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Google Drive');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOpenFolder = async (folder: GoogleDriveFolderListItem) => {
    if (!accessToken) {
      return;
    }

    await loadFolders(folder.id, accessToken, [...folderHistory, { id: folder.id, name: folder.name, path: folder.path }]);
  };

  const handleNavigateBack = async () => {
    if (!accessToken || folderHistory.length === 0) {
      return;
    }

    const nextHistory = folderHistory.slice(0, -1);
    const previousFolder = nextHistory[nextHistory.length - 1];
    await loadFolders(previousFolder?.id || 'root', accessToken, nextHistory);
  };

  const handleSelectCurrentFolder = async () => {
    if (!accessToken) {
      return;
    }

    try {
      setIsCountingFiles(true);
      const folder =
        currentFolderId === 'root'
          ? { id: 'root', name: 'My Drive', path: '/My Drive' }
          : await getGoogleDriveFolder(currentFolderId, accessToken);

      setSelectedFolder(folder);
      const counts = await countFilesInFolder(folder.id, accessToken);
      setFileCounts(counts);
      toast.success(`Selected "${folder.name}" for import.`);
    } catch (error) {
      console.error('Error selecting folder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to inspect selected folder');
    } finally {
      setIsCountingFiles(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFolder || !accessToken) return;

    try {
      setIsImporting(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('import-google-drive', {
        body: {
          folderId: selectedFolder.id,
          folderName: selectedFolder.name,
          folderPath: selectedFolder.path,
          caseId: caseId,
          accessToken: accessToken,
        },
      });

      if (error) throw error;

      toast.success(`Importing files from "${selectedFolder.name}". This may take a while for large folders.`);

      if (onImportStarted && data.importJobId) {
        onImportStarted(data.importJobId);
      }

      handleCancel();
    } catch (error) {
      console.error('Error starting import:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFolder(null);
    setFileCounts(null);
    setAccessToken(null);
    setApiError(null);
    setFolders([]);
    setFolderHistory([]);
    setCurrentFolderId('root');
    setCurrentFolderPath('/My Drive');
    setIsOpen(false);
  };

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
            Connect with Google OAuth, browse your Drive folders, and import documents, audio, images, and video.
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
                This import now uses Google OAuth only. Supported: PDFs, Word docs, images, audio (MP3, WAV, M4A), and video (MP4, MOV, AVI).
              </AlertDescription>
            </Alert>
          )}

          {!accessToken ? (
            <Button
              onClick={handleAuthenticate}
              disabled={isAuthenticating || isApiLoading || apiError !== null}
              className="w-full gap-2"
              size="lg"
            >
              {isAuthenticating || isApiLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isApiLoading ? 'Loading Google OAuth...' : 'Connecting to Google Drive...'}
                </>
              ) : (
                <>
                  <FolderOpen className="h-5 w-5" />
                  Connect Google Drive
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Current folder</p>
                    <p className="text-sm text-muted-foreground">{currentFolderPath}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleNavigateBack} disabled={folderHistory.length === 0 || isLoadingFolders}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <Button size="sm" onClick={handleSelectCurrentFolder} disabled={isLoadingFolders || isCountingFiles}>
                      {isCountingFiles ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Inspecting...
                        </>
                      ) : (
                        'Select this folder'
                      )}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-56 rounded-md border">
                  <div className="p-2">
                    {isLoadingFolders ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading folders...
                      </div>
                    ) : folders.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No subfolders found here. You can still import the current folder.
                      </div>
                    ) : (
                      folders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => handleOpenFolder(folder)}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <FolderOpen className="h-4 w-4 text-primary" />
                            {folder.name}
                          </span>
                          <span className="text-xs text-muted-foreground">Open</span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {selectedFolder && (
                <div className="rounded-lg border p-4 space-y-3">
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

                  {fileCounts && (
                    <div className="space-y-2 border-t pt-2">
                      <p className="text-sm font-medium">Files to import:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span>{fileCounts.documents} documents</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Music className="h-4 w-4 text-green-500" />
                          <span>{fileCounts.audio} audio</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Video className="h-4 w-4 text-purple-500" />
                          <span>{fileCounts.video} video</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Image className="h-4 w-4 text-orange-500" />
                          <span>{fileCounts.images} images</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <Badge>{fileCounts.total} total files</Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleStartImport} disabled={!selectedFolder || isImporting || isCountingFiles}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Import...
              </>
            ) : (
              'Start Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
