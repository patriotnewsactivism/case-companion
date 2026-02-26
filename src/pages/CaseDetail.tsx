import { Layout } from "@/components/Layout";
import { memo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FixedSizeList as List, ListChildComponentProps } from "react-window";
import { GoogleDriveFolderImport } from "@/components/GoogleDriveFolderImport";
import { ImportJobsViewer } from "@/components/ImportJobsViewer";
import { BulkDocumentUpload } from "@/components/BulkDocumentUpload";
import { TrialSimulator } from "@/components/TrialSimulator";
import { VideoRoom } from "@/components/VideoRoom";
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
import { toast } from "sonner";
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
  MessageSquare,
  Video,
  Gavel,
  Target,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
// Define types locally to avoid type mismatch with auto-generated types
interface Document {
  id: string;
  case_id: string;
  user_id: string;
  name: string;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  bates_number: string | null;
  summary: string | null;
  key_facts: string[] | null;
  favorable_findings: string[] | null;
  adverse_findings: string[] | null;
  action_items: string[] | null;
  ai_analyzed: boolean | null;
  ocr_text: string | null;
  ocr_page_count: number | null;
  ocr_processed_at: string | null;
  transcription_text?: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelineEvent {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  linked_document_id: string | null;
  importance: string | null;
  created_at: string;
  updated_at: string;
}

interface OcrFunctionResponse {
  success: boolean;
  hasAnalysis?: boolean;
  analysisProvider?: "openai" | "gemini" | "none";
  requestedTimelineEvents?: number;
  timelineEventsInserted?: number;
  timelineInsertWarning?: string | null;
}

interface Case {
  id: string;
  user_id: string;
  name: string;
  case_type: string;
  client_name: string;
  status: string;
  representation: string;
  case_theory: string | null;
  key_issues: string[] | null;
  winning_factors: string[] | null;
  next_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_ROW_HEIGHT = 72;
const DOCUMENT_LIST_MAX_HEIGHT = 640;

type DocumentRowData = {
  docs: Document[];
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onDelete: (id: string) => void;
  onOcr: (documentId: string, fileUrl: string) => void;
  onTranscribe: (documentId: string) => void;
  processingOcr: string | null;
  transcribing: string | null;
};

const DocumentRow = memo(({ index, style, data }: ListChildComponentProps<DocumentRowData>) => {
  const doc = data.docs[index];

  if (!doc) {
    return null;
  }

  return (
    <div
      style={style}
      className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors border-b border-border"
    >
      <div className="col-span-1">
        <div className="rounded bg-muted p-1.5 w-8 h-8 flex items-center justify-center">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="col-span-2">
        {doc.bates_number ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {doc.bates_number}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>

      <div className="col-span-4 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        {doc.summary && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {doc.summary}
          </p>
        )}
      </div>

      <div className="col-span-2">
        <span className="text-xs text-muted-foreground">
          {doc.file_type?.split('/')[1]?.toUpperCase() || "File"}
        </span>
      </div>

      <div className="col-span-1 flex flex-col gap-0.5">
        {doc.ai_analyzed && (
                <Badge className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
            AI
          </Badge>
        )}
        {doc.ocr_processed_at && !doc.ai_analyzed && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
            OCR
          </Badge>
        )}
        {doc.transcription_text && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
            TXT
          </Badge>
        )}
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1">
        {/* OCR Button for PDF/Image files */}
        {doc.file_url && (doc.file_type?.includes('pdf') || doc.file_type?.includes('image')) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={doc.ai_analyzed ? "Re-analyze with OCR" : "Analyze with OCR"}
            onClick={() => data.onOcr(doc.id, doc.file_url!)}
            disabled={data.processingOcr === doc.id}
          >
            {data.processingOcr === doc.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Scan className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        {/* Transcribe Button for Audio/Video files */}
        {doc.file_url && (doc.file_type?.includes('audio') || doc.file_type?.includes('video')) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={doc.transcription_text ? "Re-transcribe" : "Transcribe"}
            onClick={() => data.onTranscribe(doc.id)}
            disabled={data.transcribing === doc.id}
          >
            {data.transcribing === doc.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Music className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        {doc.file_url && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="View"
              onClick={() => data.onView(doc)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Download"
              onClick={() => data.onDownload(doc)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Delete"
          onClick={() => data.onDelete(doc.id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
});

DocumentRow.displayName = "DocumentRow";

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
  const queryClient = useQueryClient();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLinkImportOpen, setIsLinkImportOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingOcr, setProcessingOcr] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "analyzed" | "pending">("all");
  const [filterFileType, setFilterFileType] = useState<"all" | "pdf" | "image" | "audio" | "video" | "other">("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [showFilters, setShowFilters] = useState(false);

  // Video room state
  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [videoRoomName, setVideoRoomName] = useState("");

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
      toast.success("Your document has been added to the case.");
      
      // Trigger OCR if there's a file URL
      if (data.file_url) {
        triggerOcr(data.id, data.file_url);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Trigger OCR processing
  const triggerOcr = async (documentId: string, fileUrl: string) => {
    setProcessingOcr(documentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Use direct fetch with mode: 'cors' to handle CORS properly
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ documentId, fileUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OCR function error:', errorText);
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as OcrFunctionResponse;

      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline_events", id] });

      const inserted = data.timelineEventsInserted ?? 0;
      const requested = data.requestedTimelineEvents ?? 0;

      if (data.hasAnalysis) {
        toast.success(
          requested > 0
            ? `OCR and AI complete. Timeline events added: ${inserted}/${requested}.`
            : "OCR and AI analysis complete."
        );
      } else {
        toast.warning("OCR completed, but AI analysis returned no structured findings.");
      }

      if (data.timelineInsertWarning) {
        toast.warning(`Timeline warning: ${data.timelineInsertWarning}`);
      }
    } catch (error) {
      console.error("OCR error:", error);
      toast.error(error instanceof Error ? error.message : "OCR processing failed");
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
      toast.success("Audio/video has been transcribed successfully.");
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error(error instanceof Error ? error.message : "Transcription failed");
    } finally {
      setTranscribing(null);
    }
  };

  // Batch re-analyze all unprocessed documents
  const triggerBatchOcr = async () => {
    const unanalyzedDocs = documents.filter(
      (doc) => !doc.ai_analyzed && doc.file_url &&
      (doc.file_type?.includes('pdf') || doc.file_type?.includes('image') || doc.file_type?.includes('text'))
    );

    if (unanalyzedDocs.length === 0) {
      toast.info("All documents have already been analyzed.");
      return;
    }

    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: unanalyzedDocs.length });

    toast.info(`Processing ${unanalyzedDocs.length} documents...`);

    try {
      const result = await batchAnalyzeDocuments(
        unanalyzedDocs.map(doc => doc.id),
        (completed, total) => {
          setBatchProgress({ current: completed, total });
        }
      );

      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline_events", id] });

      if (result.failed > 0) {
        toast.error(`Successfully analyzed ${result.successful} documents, ${result.failed} failed.`);
      } else {
        toast.success(`Successfully analyzed ${result.successful} documents.`);
      }
    } catch (error) {
      console.error("Batch OCR error:", error);
      toast.error(error instanceof Error ? error.message : "Batch OCR processing failed");
    } finally {
      setBatchProcessing(false);
    }
  };

  // Count unanalyzed documents
  const unanalyzedCount = documents.filter(
    (doc) => !doc.ai_analyzed && doc.file_url && 
    (doc.file_type?.includes('pdf') || doc.file_type?.includes('image'))
  ).length;

  // Filter documents based on search and filters
  const filteredDocuments = documents.filter((doc) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchLower) ||
      doc.bates_number?.toLowerCase().includes(searchLower) ||
      doc.summary?.toLowerCase().includes(searchLower);

    // AI status filter
    const matchesStatus = 
      filterStatus === "all" ||
      (filterStatus === "analyzed" && doc.ai_analyzed) ||
      (filterStatus === "pending" && !doc.ai_analyzed);

    // File type filter
    const fileType = doc.file_type?.toLowerCase() || "";
    const matchesFileType = 
      filterFileType === "all" ||
      (filterFileType === "pdf" && fileType.includes("pdf")) ||
      (filterFileType === "image" && (fileType.includes("image") || fileType.includes("jpeg") || fileType.includes("png") || fileType.includes("gif"))) ||
      (filterFileType === "audio" && fileType.includes("audio")) ||
      (filterFileType === "video" && fileType.includes("video")) ||
      (filterFileType === "other" && !fileType.includes("pdf") && !fileType.includes("image") && !fileType.includes("audio") && !fileType.includes("video"));

    // Date range filter
    const docDate = new Date(doc.created_at);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const matchesDate = 
      filterDateRange === "all" ||
      (filterDateRange === "today" && docDate >= today) ||
      (filterDateRange === "week" && docDate >= weekAgo) ||
      (filterDateRange === "month" && docDate >= monthAgo);

    return matchesSearch && matchesStatus && matchesFileType && matchesDate;
  });

  // Count active filters
  const activeFilterCount = [
    filterStatus !== "all",
    filterFileType !== "all",
    filterDateRange !== "all"
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterFileType("all");
    setFilterDateRange("all");
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
      toast.success("The document has been removed from the case.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      toast.success("The timeline event has been added to the case.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let fileUrl: string | undefined;
      const batesNumber = docForm.bates_number || generateNextBatesNumber(documents, caseData?.name?.substring(0, 3).toUpperCase() || 'DOC');

      if (docForm.file && user) {
        console.log("Attempting to upload file:", docForm.file.name, "Type:", docForm.file.type, "Size:", docForm.file.size);
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
      toast.error(error instanceof Error ? error.message : "Failed to upload document");
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
      toast.error("This document doesn't have an associated file.");
      return;
    }
    window.open(doc.file_url, '_blank');
  };

  const handleDownloadDocument = async (doc: Document) => {
    if (!doc.file_url) {
      toast.error("This document doesn't have an associated file.");
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
      toast.error("Could not download the document.");
    }
  };

  const copyDocumentLink = (doc: Document) => {
    if (doc.file_url) {
      navigator.clipboard.writeText(doc.file_url);
      toast.success("Document link copied to clipboard.");
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
          {/* Header with case number, status, and actions */}
          <motion.div variants={item} className="space-y-4">
            {/* Top row with badges and actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge className="font-mono text-xs">
                  {`CV-${new Date(caseData.created_at).getFullYear()}-${caseData.id.substring(0, 5).toUpperCase()}`}
                </Badge>
                <Badge className={getStatusColor(caseData.status)}>{caseData.status}</Badge>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Only you
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setVideoRoomName(`${caseData.name} - Video Conference`);
                    setShowVideoRoom(true);
                  }}
                >
                  <Video className="h-4 w-4" />
                  Video Call
                </Button>
                <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-600">
                  <Plus className="h-4 w-4" />
                  Add Evidence
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Case title and description */}
            <div>
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">{caseData.name}</h1>
              {caseData.notes && (
                <p className="text-muted-foreground mt-1">{caseData.notes}</p>
              )}
            </div>
          </motion.div>

          {/* Tabs for Discovery, Timeline, Trial Prep, Briefs, AI */}
          <motion.div variants={item}>
            <Tabs defaultValue="discovery" className="w-full">
              <TabsList className="mb-4 bg-transparent border-b border-border rounded-none w-full justify-start h-auto p-0 gap-0">
                <TabsTrigger value="discovery" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Search className="h-4 w-4" />
                  Discovery
                </TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="trial-prep" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Gavel className="h-4 w-4" />
                  Trial Prep
                </TabsTrigger>
                <TabsTrigger value="briefs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <FileText className="h-4 w-4" />
                  Briefs
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI
                </TabsTrigger>
              </TabsList>

              {/* Discovery Tab */}
              <TabsContent value="discovery" className="space-y-4">
                {/* Search and Filter Bar */}
                <Card className="glass-card">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search Bates, files, summaries..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Button 
                        variant={showFilters || activeFilterCount > 0 ? "default" : "outline"} 
                        className="gap-2"
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <Filter className="h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                          <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                    </div>

                    {/* Expanded Filters */}
                    {showFilters && (
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
                        {/* AI Status Filter */}
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">AI Status:</Label>
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="all">All</option>
                            <option value="analyzed">Analyzed</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>

                        {/* File Type Filter */}
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Type:</Label>
                          <select
                            value={filterFileType}
                            onChange={(e) => setFilterFileType(e.target.value as typeof filterFileType)}
                            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="all">All Types</option>
                            <option value="pdf">PDF</option>
                            <option value="image">Images</option>
                            <option value="audio">Audio</option>
                            <option value="video">Video</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Added:</Label>
                          <select
                            value={filterDateRange}
                            onChange={(e) => setFilterDateRange(e.target.value as typeof filterDateRange)}
                            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="all">Any Time</option>
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                          </select>
                        </div>

                        {/* Clear Filters */}
                        {activeFilterCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                            Clear all
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Results count */}
                    {(searchQuery || activeFilterCount > 0) && (
                      <div className="text-sm text-muted-foreground">
                        Showing {filteredDocuments.length} of {documents.length} documents
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex flex-wrap justify-end items-center gap-2">
                  <div className="flex gap-2">
                    {/* Batch Re-analyze Button */}
                    {unanalyzedCount > 0 && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={triggerBatchOcr}
                        disabled={batchProcessing}
                      >
                        {batchProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing {batchProgress.current}/{batchProgress.total}
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4" />
                            Analyze All ({unanalyzedCount})
                          </>
                        )}
                      </Button>
                    )}

                    {/* Google Drive Folder Import */}
                    <GoogleDriveFolderImport
                      caseId={id!}
                      onImportStarted={(importJobId) => {
                        toast.success(`Import job ${importJobId} has been started.`);
                        queryClient.invalidateQueries({ queryKey: ['documents', id] });
                      }}
                    />

                    {/* Bulk Document Upload Dialog */}
                    <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Upload className="h-4 w-4" />
                          Bulk Upload
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Bulk Document Upload</DialogTitle>
                          <DialogDescription>
                            Upload multiple documents at once. All documents will be automatically processed with OCR and AI analysis.
                          </DialogDescription>
                        </DialogHeader>
                        <BulkDocumentUpload 
                          caseId={id!}
                          onUploadComplete={(uploadedDocs) => {
                            toast.success(`Successfully uploaded ${uploadedDocs.length} documents.`);
                            queryClient.invalidateQueries({ queryKey: ['documents', id] });
                            setIsBulkUploadOpen(false);
                          }}
                        />
                      </DialogContent>
                    </Dialog>

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

                {/* Document List */}
                {docsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : documents.length === 0 ? (
                  <Card className="glass-card">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <File className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No discovery files yet. Add evidence to get started.</h3>
                      <div className="flex gap-2 mt-4">
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
                ) : filteredDocuments.length === 0 ? (
                  <Card className="glass-card">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Search className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No documents match your filters.</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Try adjusting your search or clearing filters.
                      </p>
                      <Button variant="outline" onClick={clearFilters}>
                        Clear all filters
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="glass-card overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <div className="col-span-1">Type</div>
                      <div className="col-span-2">Bates Number</div>
                      <div className="col-span-4">File Name / Summary</div>
                      <div className="col-span-2">Source</div>
                      <div className="col-span-1">Tags</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    <List
                      height={Math.min(DOCUMENT_LIST_MAX_HEIGHT, Math.max(filteredDocuments.length * DOCUMENT_ROW_HEIGHT, DOCUMENT_ROW_HEIGHT))}
                      itemCount={filteredDocuments.length}
                      itemSize={DOCUMENT_ROW_HEIGHT}
                      width="100%"
                      itemData={{
                        docs: filteredDocuments,
                        onView: handleViewDocument,
                        onDownload: handleDownloadDocument,
                        onDelete: setDeleteDocId,
                        onOcr: triggerOcr,
                        onTranscribe: triggerTranscription,
                        processingOcr,
                        transcribing,
                      }}
                      itemKey={(index, data) => data.docs[index]?.id ?? index}
                    >
                      {DocumentRow}
                    </List>
                  </Card>
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
                                   <Badge className="text-xs">
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

              {/* Trial Prep Tab */}
              <TabsContent value="trial-prep" className="space-y-4">
                <div className="grid gap-6">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gavel className="h-5 w-5" />
                        Trial Preparation Tools
                      </CardTitle>
                      <CardDescription>
                        Organize witnesses, exhibits, and prepare your trial strategy for this case
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <Card className="border-border hover:border-gold-300 transition-colors">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg bg-blue-100 p-2">
                                <Brain className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-medium">Trial Simulator</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Practice deposition questions and cross-examination techniques with AI assistance
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-border hover:border-gold-300 transition-colors">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg bg-purple-100 p-2">
                                <Target className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <h3 className="font-medium">Deposition Questions</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Generate trap questions and impeachment material from your documents
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <TrialSimulator 
                        caseData={caseData}
                        documents={documents}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Briefs Tab */}
              <TabsContent value="briefs" className="space-y-4">
                <Card className="glass-card">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Legal Briefs</h3>
                    <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                      Draft and manage legal briefs, motions, and court filings
                    </p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Brief
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Tab */}
              <TabsContent value="ai" className="space-y-4">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      AI Case Assistant
                    </CardTitle>
                    <CardDescription>
                      Get AI-powered insights and analysis for your case
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {caseData.case_theory && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Case Theory</h4>
                        <p className="text-sm text-muted-foreground">{caseData.case_theory}</p>
                      </div>
                    )}

                    {caseData.key_issues && caseData.key_issues.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Key Issues
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {caseData.key_issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {caseData.winning_factors && caseData.winning_factors.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Winning Factors
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {caseData.winning_factors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {caseData.notes && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Case Notes</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{caseData.notes}</p>
                      </div>
                    )}

                    {!caseData.case_theory && !caseData.key_issues?.length && !caseData.winning_factors?.length && !caseData.notes && (
                      <div className="text-center py-8">
                        <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Upload documents to get AI-powered analysis and insights
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
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

      {/* Video Room Dialog */}
      <Dialog open={showVideoRoom} onOpenChange={setShowVideoRoom}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-accent" />
              Video Conference
            </DialogTitle>
            <DialogDescription>
              Secure, encrypted video conference for case collaboration
            </DialogDescription>
          </DialogHeader>
          {showVideoRoom && id && (
            <VideoRoom
              caseId={id}
              roomName={videoRoomName}
              onLeave={() => setShowVideoRoom(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
