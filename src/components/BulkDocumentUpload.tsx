import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Upload, FileText, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bulkUploadDocuments } from "@/lib/api";
import { Document } from "@/lib/api";

interface BulkDocumentUploadProps {
  caseId: string;
  onUploadComplete?: (documents: Document[]) => void;
}

interface UploadFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  batesNumber?: string;
}

export function BulkDocumentUpload({ caseId, onUploadComplete }: BulkDocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generateBates, setGenerateBates] = useState(true);
  const [chunkedMode, setChunkedMode] = useState(false);
  const [perFileProgress, setPerFileProgress] = useState<Record<string, number>>({});
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const [batesPrefix, setBatesPrefix] = useState("DOC");
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: "pending" as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc", ".docx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/tiff": [".tiff", ".tif"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB max per file
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({ title: "No files selected", description: "Please select files to upload.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setPerFileProgress({});
    const updatedFiles = [...files];
    let successCount = 0;
    let failCount = 0;
    const uploadedDocs: Document[] = [];
    for (let i = 0; i < files.length; i++) {
      const uf = files[i];
      updatedFiles[i] = { ...uf, status: "uploading" };
      setFiles([...updatedFiles]);
      try {
        if (chunkedMode && uf.file.size > CHUNK_SIZE) {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: { user } } = await (supabase as any).auth.getUser();
          if (!user) throw new Error("Not authenticated");
          const totalChunks = Math.ceil(uf.file.size / CHUNK_SIZE);
          const storagePath = `${user.id}/${caseId}/${Date.now()}-${uf.file.name}`;
          for (let c = 0; c < totalChunks; c++) {
            const start = c * CHUNK_SIZE;
            const chunk = uf.file.slice(start, Math.min(start + CHUNK_SIZE, uf.file.size));
            const { error } = await (supabase as any).storage.from("case-documents").upload(
              c === 0 ? storagePath : `${storagePath}.part${c}`, chunk, { upsert: true });
            if (error) throw new Error(error.message);
            setPerFileProgress(prev => ({ ...prev, [uf.file.name]: Math.round(((c + 1) / totalChunks) * 100) }));
          }
          const { data: pub } = (supabase as any).storage.from("case-documents").getPublicUrl(storagePath);
          const { data: doc, error: dbErr } = await (supabase as any).from("documents").insert({
            case_id: caseId, user_id: user.id, name: uf.file.name,
            file_type: uf.file.type, file_size: uf.file.size, file_url: pub.publicUrl,
            ...(generateBates ? { bates_number: `${batesPrefix}-${String(i + 1).padStart(4, "0")}` } : {}),
          }).select("*").single();
          if (dbErr) throw new Error(dbErr.message);
          uploadedDocs.push(doc);
          updatedFiles[i] = { ...updatedFiles[i], status: "success", batesNumber: doc.bates_number };
        } else {
          const result = await bulkUploadDocuments({
            files: [uf.file], case_id: caseId, generate_bates: generateBates, bates_prefix: batesPrefix,
          });
          if (result.failed > 0) throw new Error(result.errors[0] || "Upload failed");
          uploadedDocs.push(...result.documents);
          updatedFiles[i] = { ...updatedFiles[i], status: "success", batesNumber: result.documents[0]?.bates_number };
          setPerFileProgress(prev => ({ ...prev, [uf.file.name]: 100 }));
        }
        successCount++;
      } catch (err) {
        updatedFiles[i] = { ...updatedFiles[i], status: "error", error: err instanceof Error ? err.message : "Failed" };
        failCount++;
      }
      setFiles([...updatedFiles]);
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    setIsUploading(false);
    toast({
      title: "Upload complete",
      description: `${successCount} uploaded${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    if (onUploadComplete && successCount > 0) onUploadComplete(uploadedDocs);
  };

  const totalFiles = files.length;
  const successfulUploads = files.filter(f => f.status === "success").length;
  const failedUploads = files.filter(f => f.status === "error").length;
  const pendingUploads = files.filter(f => f.status === "pending" || f.status === "uploading").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Document Upload</CardTitle>
          <CardDescription>
            Upload multiple documents at once. Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, TIFF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and drop area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-gold-500 bg-gold-50"
                : "border-border hover:border-gold-400 hover:bg-gold-50/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse files
            </p>
            <Button type="button" variant="outline">
              Select Files
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Max 50MB per file • Max 100 files at once
            </p>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="bulk-chunked" checked={chunkedMode}
                onChange={e => setChunkedMode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="bulk-chunked" className="text-xs text-muted-foreground cursor-pointer">
                📱 Low-memory mode — upload in 5MB chunks (recommended on mobile)
              </label>
            </div>
          </div>

          {/* Bates numbering options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generate-bates"
                checked={generateBates}
                onChange={(e) => setGenerateBates(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gold-600 focus:ring-gold-500"
              />
              <label htmlFor="generate-bates" className="text-sm font-medium">
                Generate Bates numbers automatically
              </label>
            </div>
            
            {generateBates && (
              <div className="space-y-2">
                <label htmlFor="bates-prefix" className="text-sm font-medium">
                  Bates prefix
                </label>
                <input
                  type="text"
                  id="bates-prefix"
                  value={batesPrefix}
                  onChange={(e) => setBatesPrefix(e.target.value.toUpperCase())}
                  className="w-32 px-3 py-2 border border-input rounded-md text-sm"
                  placeholder="DOC"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Files will be numbered as {batesPrefix}-0001, {batesPrefix}-0002, etc.
                </p>
              </div>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Selected Files ({totalFiles})</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiles([])}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.file.name}-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {file.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                          {file.status === "pending" && "Ready to upload"}
                          {file.status === "uploading" && "Uploading..."}
                          {file.status === "success" && `Uploaded${file.batesNumber ? ` • ${file.batesNumber}` : ""}`}
                          {file.status === "error" && `Failed: ${file.error}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {file.status === "success" && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {file.status === "error" && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      {file.status === "uploading" && (
                        <Loader2 className="h-5 w-5 animate-spin text-gold-600" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading files...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Summary */}
              {!isUploading && files.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Upload Summary</p>
                    <div className="flex items-center space-x-4 text-xs">
                      <span className="flex items-center">
                        <CheckCircle className="h-3 w-3 text-green-600 mr-1" />
                        Ready: {pendingUploads}
                      </span>
                      {successfulUploads > 0 && (
                        <span className="flex items-center">
                          <CheckCircle className="h-3 w-3 text-green-600 mr-1" />
                          Success: {successfulUploads}
                        </span>
                      )}
                      {failedUploads > 0 && (
                        <span className="flex items-center">
                          <XCircle className="h-3 w-3 text-red-600 mr-1" />
                          Failed: {failedUploads}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    Total size:{" "}
                    {(files.reduce((acc, file) => acc + file.file.size, 0) / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setFiles([])}
            disabled={files.length === 0 || isUploading}
          >
            Clear Selection
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className="bg-gold-600 hover:bg-gold-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {files.length} File{files.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">Upload Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Organize files before uploading for better Bates numbering</li>
                <li>• PDFs and images will be automatically OCR processed</li>
                <li>• Documents are automatically associated with this case</li>
                <li>• You can add metadata and analysis after uploading</li>
                <li>• Large files may take longer to process</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}