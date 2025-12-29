import { Layout } from "@/components/Layout";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GoogleDriveFolderImport } from "@/components/GoogleDriveFolderImport";
import { ImportJobsViewer } from "@/components/ImportJobsViewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  FileText,
  Calendar,
  Upload,
  Trash2,
  Download,
  Eye,
  Clock,
  Loader2,
  File,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Link,
  Scan,
  Copy,
  ExternalLink,
  Brain,
  Music,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Document = Tables<"documents"> & {
  ocr_text?: string | null;
  ocr_page_count?: number | null;
  ocr_processed_at?: string | null;
  transcription_text?: string | null;
};
type TimelineEvent = Tables<"timeline_events">;
type Case = Tables<"cases">;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "discovery":
      return "bg-accent/20 text-accent";
    case "pending":
      return "bg-muted text-muted-foreground";
    case "review":
      return "bg-blue-100 text-blue-700";
    case "closed":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// Generate next Bates number
const generateNextBatesNumber = (documents: Document[], casePrefix: string) => {
  const existingNumbers = documents
    .filter(d => d.bates_number)
    .map(d => {
      const match = d.bates_number?.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  
  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = maxNumber + 1;
  return `${casePrefix}-${String(nextNumber).padStart(4, '0')}`;
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLinkImportOpen, setIsLinkImportOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingOcr, setProcessingOcr] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const [docForm, setDocForm] = useState({
    name: "",
    bates_number: "",
    file: null as File | null,
  });

  const [linkForm, setLinkForm] = useState({
    url: "",
    name: "",
    bates_number: "",
  });

  const [eventForm, setEventForm] = useState({
    title: "",
    event_date: "",
    event_type: "",
    description: "",
    importance: "medium",
  });

  // Fetch case details
  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Case;
    },
    enabled: !!id,
  });

  // Fetch documents
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("case_id", id)
        .order("bates_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Document[];
    },
    enabled: !!id,
  });

  // Fetch timeline events
  const { data: timelineEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["timeline_events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timeline_events")
        .select("*")
        .eq("case_id", id)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as TimelineEvent[];
    },
    enabled: !!id,
  });

  // Create document mutation
  const createDocMutation = useMutation({
    mutationFn: async (input: { 
      name: string; 
      bates_number?: string; 
      file_url?: string; 
      file_type?: string; 
      file_size?: number;
    }) => {
      if (!user || !id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("documents")
        .insert({
          case_id: id,
          user_id: user.id,
          name: input.name,
          bates_number: input.bates_number,
          file_url: input.file_url,
          file_type: input.file_type,
          file_size: input.file_size,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      setIsUploadOpen(false);
      setIsLinkImportOpen(false);
      setDocForm({ name: "", bates_number: "", file: null });
      setLinkForm({ url: "", name: "", bates_number: "" });
      toast({
        title: "Document added",
        description: "Your document has been added to the case.",
      });
      
      // Trigger OCR if there's a file URL
      if (data.file_url) {
        triggerOcr(data.id, data.file_url);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Trigger OCR processing
  const triggerOcr = async (documentId: string, fileUrl: string) => {
    setProcessingOcr(documentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Use direct fetch to bypass CORS issues with supabase.functions.invoke
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentId, fileUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      toast({
        title: "Document analyzed",
        description: "OCR and AI analysis complete.",
      });
    } catch (error) {
      console.error("OCR error:", error);
      toast({
        title: "OCR processing failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setProcessingOcr(null);
    }
  };

  // Trigger transcription for audio/video files
  const triggerTranscription = async (documentId: string) => {
    setTranscribing(documentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke('transcribe-media', {
        body: { documentId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      toast({
        title: "Transcription complete",
        description: "Audio/video has been transcribed successfully.",
      });
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        title: "Transcription failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTranscribing(null);
    }
  };

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: doc, error: fetchError } = await supabase
        .from("documents")
        .select("file_url")
        .eq("id", docId)
        .single();

      if (fetchError) throw fetchError;

      if (doc?.file_url && user) {
        const urlParts = doc.file_url.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'case-documents');
        if (bucketIndex !== -1) {
          const filePath = urlParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('case-documents').remove([filePath]);
        }
      }

      const { error } = await supabase.from("documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      setDeleteDocId(null);
      toast({
        title: "Document deleted",
        description: "The document has been removed from the case.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create timeline event mutation
  const createEventMutation = useMutation({
    mutationFn: async (input: typeof eventForm) => {
      if (!user || !id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("timeline_events")
        .insert({
          case_id: id,
          user_id: user.id,
          title: input.title,
          event_date: input.event_date,
          event_type: input.event_type || null,
          description: input.description || null,
          importance: input.importance,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline_events", id] });
      setIsEventOpen(false);
      setEventForm({ title: "", event_date: "", event_type: "", description: "", importance: "medium" });
      toast({
        title: "Event added",
        description: "The timeline event has been added to the case.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let fileUrl: string | undefined;
      const batesNumber = docForm.bates_number || generateNextBatesNumber(documents, caseData?.name?.substring(0, 3).toUpperCase() || 'DOC');

      if (docForm.file && user) {
        const fileExt = docForm.file.name.split('.').pop();
        const fileName = `${user.id}/${id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('case-documents')
          .upload(fileName, docForm.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('case-documents')
          .getPublicUrl(uploadData.path);

        fileUrl = publicUrl;
      }

      await createDocMutation.mutateAsync({
        name: docForm.name || docForm.file?.name || 'Untitled Document',
        bates_number: batesNumber,
        file_url: fileUrl,
        file_type: docForm.file?.type,
        file_size: docForm.file?.size,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLinkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const batesNumber = linkForm.bates_number || generateNextBatesNumber(documents, caseData?.name?.substring(0, 3).toUpperCase() || 'DOC');
    
    // Determine file type from URL
    const urlLower = linkForm.url.toLowerCase();
    let fileType = 'application/octet-stream';
    if (urlLower.includes('.pdf')) fileType = 'application/pdf';
    else if (urlLower.includes('.doc')) fileType = 'application/msword';
    else if (urlLower.match(/\.(jpg|jpeg)$/)) fileType = 'image/jpeg';
    else if (urlLower.includes('.png')) fileType = 'image/png';
    
    await createDocMutation.mutateAsync({
      name: linkForm.name || 'Linked Document',
      bates_number: batesNumber,
      file_url: linkForm.url,
      file_type: fileType,
    });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    createEventMutation.mutate(eventForm);
  };

  const handleViewDocument = async (doc: Document) => {
    if (!doc.file_url) {
      toast({
        title: "No file available",
        description: "This document doesn't have an associated file.",
        variant: "destructive",
      });
      return;
    }
    window.open(doc.file_url, '_blank');
  };

  const handleDownloadDocument = async (doc: Document) => {
    if (!doc.file_url) {
      toast({
        title: "No file available",
        description: "This document doesn't have an associated file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the document.",
        variant: "destructive",
      });
    }
  };

  const copyDocumentLink = (doc: Document) => {
    if (doc.file_url) {
      navigator.clipboard.writeText(doc.file_url);
      toast({
        title: "Link copied",
        description: "Document link copied to clipboard.",
      });
    }
  };

  const getImportanceColor = (importance: string | null) => {
    switch (importance) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-yellow-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-muted";
    }
  };

  if (caseLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!caseData) {
    return (
      <Layout>
        <div className="p-6 lg:p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Case not found</h1>
          <Button onClick={() => navigate("/cases")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-6xl mx-auto space-y-6"
        >
          {/* Back Button & Header */}
          <motion.div variants={item} className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/cases")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl lg:text-3xl font-serif font-bold">{caseData.name}</h1>
                <Badge className={getStatusColor(caseData.status)}>{caseData.status}</Badge>
              </div>
              <p className="text-muted-foreground">
                {caseData.case_type} • {caseData.client_name} • {caseData.representation}
              </p>
            </div>
          </motion.div>

          {/* Case Info Cards */}
          <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
            {caseData.case_theory && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Case Theory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{caseData.case_theory}</p>
                </CardContent>
              </Card>
            )}
            {caseData.next_deadline && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Next Deadline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{format(new Date(caseData.next_deadline), "PPP")}</p>
                </CardContent>
              </Card>
            )}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-xs text-muted-foreground">
                  {documents.filter(d => d.ai_analyzed).length} analyzed
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tabs for Documents, Timeline, Notes */}
          <motion.div variants={item}>
            <Tabs defaultValue="documents" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="documents" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Documents ({documents.length})
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline ({timelineEvents.length})
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Notes
                </TabsTrigger>
              </TabsList>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Upload discovery documents, pleadings, and evidence
                  </p>
                  <div className="flex gap-2">
                    {/* Google Drive Folder Import */}
                    <GoogleDriveFolderImport
                      caseId={id!}
                      onImportStarted={(importJobId) => {
                        toast({
                          title: "Import Started",
                          description: `Import job ${importJobId} has been started.`,
                        });
                        queryClient.invalidateQueries({ queryKey: ['documents', id] });
                      }}
                    />

                    {/* Link Import Dialog */}
                    <Dialog open={isLinkImportOpen} onOpenChange={setIsLinkImportOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Link className="h-4 w-4" />
                          Import from Link
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleLinkImport}>
                          <DialogHeader>
                            <DialogTitle>Import Document from Link</DialogTitle>
                            <DialogDescription>
                              Paste a link from Google Drive, Dropbox, or any public file URL
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="link_url">Document URL *</Label>
                              <Input
                                id="link_url"
                                placeholder="https://drive.google.com/..."
                                value={linkForm.url}
                                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                                required
                              />
                              <p className="text-xs text-muted-foreground">
                                Supports Google Drive, Dropbox, OneDrive, or direct file URLs
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="link_name">Document Name</Label>
                              <Input
                                id="link_name"
                                placeholder="Deposition of John Doe"
                                value={linkForm.name}
                                onChange={(e) => setLinkForm({ ...linkForm, name: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="link_bates">Bates Number</Label>
                              <Input
                                id="link_bates"
                                placeholder={generateNextBatesNumber(documents, caseData?.name?.substring(0, 3).toUpperCase() || 'DOC')}
                                value={linkForm.bates_number}
                                onChange={(e) => setLinkForm({ ...linkForm, bates_number: e.target.value })}
                              />
                              <p className="text-xs text-muted-foreground">
                                Auto-generated if left blank
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsLinkImportOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createDocMutation.isPending}>
                              {createDocMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                "Import"
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {/* Upload Dialog */}
                    <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <Upload className="h-4 w-4" />
                          Upload Document
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleUpload}>
                          <DialogHeader>
                            <DialogTitle>Upload Document</DialogTitle>
                            <DialogDescription>
                              Add a document to this case for discovery analysis with OCR
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="file">File *</Label>
                              <Input
                                id="file"
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setDocForm({ 
                                    ...docForm, 
                                    file,
                                    name: docForm.name || file?.name || ''
                                  });
                                }}
                                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.mp4,.mov,.avi"
                                required
                              />
                              <p className="text-xs text-muted-foreground">
                                Documents, images, audio (MP3, WAV, M4A), or video (MP4, MOV, AVI) up to 500MB
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="doc_name">Document Name</Label>
                              <Input
                                id="doc_name"
                                placeholder={docForm.file?.name || "Deposition of John Doe"}
                                value={docForm.name}
                                onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="bates">Bates Number</Label>
                              <Input
                                id="bates"
                                placeholder={generateNextBatesNumber(documents, caseData?.name?.substring(0, 3).toUpperCase() || 'DOC')}
                                value={docForm.bates_number}
                                onChange={(e) => setDocForm({ ...docForm, bates_number: e.target.value })}
                              />
                              <p className="text-xs text-muted-foreground">
                                Auto-generated if left blank
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={uploading || createDocMutation.isPending}>
                              {uploading || createDocMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                "Upload & Analyze"
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Import Jobs Viewer */}
                <ImportJobsViewer caseId={id!} />

                {docsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : documents.length === 0 ? (
                  <Card className="glass-card">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <File className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload discovery documents to get started with AI analysis
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsLinkImportOpen(true)}>
                          <Link className="h-4 w-4 mr-2" />
                          Import from Link
                        </Button>
                        <Button onClick={() => setIsUploadOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {documents.map((doc) => (
                      <Card key={doc.id} className="glass-card hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-medium truncate">{doc.name}</h4>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                                    {doc.bates_number && (
                                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded font-semibold">
                                        {doc.bates_number}
                                      </span>
                                    )}
                                    {doc.file_type && <span>{doc.file_type.split('/')[1]?.toUpperCase()}</span>}
                                    <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                                    {doc.file_size && (
                                      <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {doc.file_url && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Copy Link"
                                        onClick={() => copyDocumentLink(doc)}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="View"
                                        onClick={() => handleViewDocument(doc)}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Download"
                                        onClick={() => handleDownloadDocument(doc)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      {!doc.ai_analyzed && processingOcr !== doc.id && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          title="Run OCR Analysis"
                                          onClick={() => triggerOcr(doc.id, doc.file_url!)}
                                        >
                                          <Scan className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {(doc.file_type?.startsWith('audio/') || doc.file_type?.startsWith('video/')) &&
                                       !doc.transcription_text && transcribing !== doc.id && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          title="Transcribe Audio/Video"
                                          onClick={() => triggerTranscription(doc.id)}
                                        >
                                          <Music className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Delete"
                                    onClick={() => setDeleteDocId(doc.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              {/* Processing indicators */}
                              {processingOcr === doc.id && (
                                <div className="flex items-center gap-2 mt-3 text-sm text-primary">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Running OCR & AI analysis...</span>
                                </div>
                              )}
                              {transcribing === doc.id && (
                                <div className="flex items-center gap-2 mt-3 text-sm text-primary">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Transcribing audio/video...</span>
                                </div>
                              )}

                              {/* AI Analysis Results */}
                              {doc.ai_analyzed && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-green-500" />
                                    <span className="text-xs text-green-600 font-medium">AI Analyzed</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-6"
                                      onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                                    >
                                      {selectedDoc?.id === doc.id ? "Hide Details" : "View Analysis"}
                                    </Button>
                                  </div>
                                  
                                  {selectedDoc?.id === doc.id && (
                                    <div className="grid gap-3 mt-3 p-3 bg-muted/50 rounded-lg">
                                      {doc.summary && (
                                        <div>
                                          <h5 className="text-xs font-semibold mb-1">Summary</h5>
                                          <p className="text-sm text-muted-foreground">{doc.summary}</p>
                                        </div>
                                      )}
                                      {doc.key_facts && doc.key_facts.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-semibold mb-1">Key Facts</h5>
                                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                                            {doc.key_facts.map((fact, i) => (
                                              <li key={i}>{fact}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {doc.favorable_findings && doc.favorable_findings.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" /> Favorable
                                          </h5>
                                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                                            {doc.favorable_findings.map((finding, i) => (
                                              <li key={i}>{finding}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {doc.adverse_findings && doc.adverse_findings.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> Adverse
                                          </h5>
                                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                                            {doc.adverse_findings.map((finding, i) => (
                                              <li key={i}>{finding}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {doc.action_items && doc.action_items.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-semibold text-blue-600 mb-1">Action Items</h5>
                                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                                            {doc.action_items.map((item, i) => (
                                              <li key={i}>{item}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Track important dates and events in your case
                  </p>
                  <Dialog open={isEventOpen} onOpenChange={setIsEventOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleCreateEvent}>
                        <DialogHeader>
                          <DialogTitle>Add Timeline Event</DialogTitle>
                          <DialogDescription>
                            Add a key date or event to track in this case
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="event_title">Event Title *</Label>
                            <Input
                              id="event_title"
                              placeholder="Deposition scheduled"
                              value={eventForm.title}
                              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="event_date">Date *</Label>
                              <Input
                                id="event_date"
                                type="date"
                                value={eventForm.event_date}
                                onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="event_type">Event Type</Label>
                              <Input
                                id="event_type"
                                placeholder="Deposition, Hearing, etc."
                                value={eventForm.event_type}
                                onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="importance">Importance</Label>
                            <select
                              id="importance"
                              value={eventForm.importance}
                              onChange={(e) => setEventForm({ ...eventForm, importance: e.target.value })}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="event_desc">Description</Label>
                            <Textarea
                              id="event_desc"
                              placeholder="Additional details..."
                              value={eventForm.description}
                              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsEventOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createEventMutation.isPending}>
                            {createEventMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              "Add Event"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {eventsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <Card className="glass-card">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No timeline events</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add key dates to track your case progress
                      </p>
                      <Button onClick={() => setIsEventOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Event
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {timelineEvents.map((event) => (
                      <Card
                        key={event.id}
                        className={`glass-card border-l-4 ${getImportanceColor(event.importance)}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{event.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(event.event_date), "PPP")}
                                {event.event_type && (
                                  <Badge variant="outline" className="text-xs">
                                    {event.event_type}
                                  </Badge>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {event.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Case Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {caseData.notes ? (
                      <p className="text-muted-foreground whitespace-pre-wrap">{caseData.notes}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No notes added to this case yet.</p>
                    )}
                  </CardContent>
                </Card>

                {caseData.key_issues && caseData.key_issues.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Key Issues
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {caseData.key_issues.map((issue, i) => (
                          <li key={i} className="text-muted-foreground">{issue}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {caseData.winning_factors && caseData.winning_factors.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Winning Factors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {caseData.winning_factors.map((factor, i) => (
                          <li key={i} className="text-muted-foreground">{factor}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>

      {/* Delete Document Alert */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
