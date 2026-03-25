import { useState, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { FolderOpen, Loader2, AlertCircle, CheckCircle2, FileText, Music, Video, Image } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  loadGoogleAPI,
  getGoogleAccessToken,
  showGoogleDriveFolderPicker,
  countFilesInFolder,
  type GoogleDriveFolder,
} from '@/lib/googleDrive';

interface GoogleDriveFolderImportProps {
  caseId: string;
  onImportStarted?: (importJobId: string) => void;
}

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

  // Load Google API when dialog opens
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

  const handleSelectFolder = async () => {
    try {
      setIsLoading(true);

      // Get OAuth access token
      const token = await getGoogleAccessToken();
      setAccessToken(token);

      // Show folder picker
      const folder = await showGoogleDriveFolderPicker(token);

      if (folder) {
        setSelectedFolder(folder);

        // Count files in folder
        setIsCountingFiles(true);
        try {
          const counts = await countFilesInFolder(folder.id, token);
          setFileCounts(counts);
        } catch (error) {
          console.error('Error counting files:', error);
          toast.warning('Could not count files in folder, but import can still proceed.');
        } finally {
          setIsCountingFiles(false);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to select folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFolder || !accessToken) return;

    try {
      setIsImporting(true);

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the import edge function
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

      // Notify parent component
      if (onImportStarted && data.importJobId) {
        onImportStarted(data.importJobId);
      }

      // Reset and close dialog
      setSelectedFolder(null);
      setFileCounts(null);
      setAccessToken(null);
      setIsOpen(false);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import from Google Drive Folder</DialogTitle>
          <DialogDescription>
            Select a folder from Google Drive. All documents, audio, and video files will be imported and processed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!selectedFolder ? (
            <div className="space-y-4">
              {apiError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {apiError}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This will recursively import all supported files from the selected folder and its subfolders.
                    Supported: PDFs, Word docs, images, audio (MP3, WAV, M4A), and video (MP4, MOV, AVI).
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSelectFolder}
                disabled={isLoading || isApiLoading || apiError !== null}
                className="w-full gap-2"
                size="lg"
              >
                {isLoading || isApiLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isApiLoading ? 'Loading Google API...' : 'Loading...'}
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-5 w-5" />
                    Select Google Drive Folder
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{selectedFolder.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedFolder.path}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                </div>

                {isCountingFiles && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Counting files...
                  </div>
                )}

                {fileCounts && (
                  <div className="space-y-2 pt-2 border-t">
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
                    <div className="pt-2 border-t">
                      <p className="text-sm font-semibold">
                        Total: {fileCounts.total} files
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Large folders may take several minutes to import. You can monitor progress from the import jobs section.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {selectedFolder && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedFolder(null);
                  setFileCounts(null);
                }}
              >
                Choose Different Folder
              </Button>
              <Button
                type="button"
                onClick={handleStartImport}
                disabled={isImporting || isCountingFiles}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting Import...
                  </>
                ) : (
                  'Start Import'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
