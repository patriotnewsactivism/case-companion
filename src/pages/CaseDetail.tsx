// @ts-nocheck
import { Layout } from "@/components/Layout";
import { memo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FixedSizeList as List, ListChildComponentProps } from "react-window";
import { TimelineView } from "@/components/TimelineView";
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
import { batchAnalyzeDocuments, getBriefsByCase, createBrief, updateBrief, deleteBrief, type LegalBrief, type CreateBriefInput } from "@/lib/api";
import { generateMotionDraft } from "@/services/documentGenerator";
import { uploadAndProcessFile } from "@/lib/upload/unified-upload-handler";
import { ProcessingStatusBar } from "@/components/processing/ProcessingStatusBar";
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
  Send,
  Edit2,
  Users,
  Shield,
  Zap,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Lock,
  Star,
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
  entities?: any[] | null;
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
  entities?: any[] | null;
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

  // Briefs state
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [editingBrief, setEditingBrief] = useState<LegalBrief | null>(null);
  const [deleteBriefId, setDeleteBriefId] = useState<string | null>(null);
  const [briefForm, setBriefForm] = useState<CreateBriefInput>({
    case_id: id || "",
    title: "",
    type: "motion",
    status: "draft",
    content: "",
    court: "",
    due_date: "",
  });

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDocumentCount, setChatDocumentCount] = useState<number>(0);

  // AI Brief Drafter state
  const [isDraftingBrief, setIsDraftingBrief] = useState(false);
  const [draftProgress, setDraftProgress] = useState("");

  // Argument Analyzer state
  const [analyzingBriefId, setAnalyzingBriefId] = useState<string | null>(null);
  const [briefAnalysis, setBriefAnalysis] = useState<Record<string, unknown> | null>(null);
  const [showAnalysisFor, setShowAnalysisFor] = useState<string | null>(null);

  // Cross-Document Intelligence state
  const [runningIntelligence, setRunningIntelligence] = useState(false);
  const [crossDocIntelligence, setCrossDocIntelligence] = useState<Record<string, unknown> | null>(null);

  // Witness Prep state
  const [witnessName, setWitnessName] = useState("");
  const [witnessRole, setWitnessRole] = useState("fact_witness");
  const [generatingWitnessPrep, setGeneratingWitnessPrep] = useState(false);
  const [witnessPrepResult, setWitnessPrepResult] = useState<Record<string, unknown> | null>(null);

  // Privilege Log state
  const [generatingPrivilegeLog, setGeneratingPrivilegeLog] = useState(false);
  const [privilegeLogEntries, setPrivilegeLogEntries] = useState<unknown[]>([]);

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
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
        .from("timeline_events")
        .select("*")
        .eq("case_id", id)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as TimelineEvent[];
    },
    enabled: !!id,
  });

  // Fetch briefs
  const { data: briefs = [] } = useQuery({
    queryKey: ["briefs", id],
    queryFn: () => getBriefsByCase(id!),
    enabled: !!id,
  });

  const createBriefMutation = useMutation({
    mutationFn: (input: CreateBriefInput) => createBrief(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefs", id] });
      setIsBriefOpen(false);
      setEditingBrief(null);
      setBriefForm({ case_id: id || "", title: "", type: "motion", status: "draft", content: "", court: "", due_date: "" });
      toast.success("Brief saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBriefMutation = useMutation({
    mutationFn: ({ id: briefId, updates }: { id: string; updates: Partial<CreateBriefInput> }) =>
      updateBrief(briefId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefs", id] });
      setIsBriefOpen(false);
      setEditingBrief(null);
      setBriefForm({ case_id: id || "", title: "", type: "motion", status: "draft", content: "", court: "", due_date: "" });
      toast.success("Brief updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBriefMutation = useMutation({
    mutationFn: (briefId: string) => deleteBrief(briefId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefs", id] });
      setDeleteBriefId(null);
      toast.success("Brief deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateDocumentDerivedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", id] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["timeline_events", id] });
    queryClient.invalidateQueries({ queryKey: ["timeline-events"] });
    queryClient.invalidateQueries({ queryKey: ["document-stats"] });
  };

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
      const { data, error } = await (supabase as any)
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
      invalidateDocumentDerivedQueries();
      setIsUploadOpen(false);
      setIsLinkImportOpen(false);
      setDocForm({ name: "", bates_number: "", file: null });
      setLinkForm({ url: "", name: "", bates_number: "" });
      toast.success("Your document has been added to the case.");
      
      // Route post-upload processing based on media type
      if (data.file_url) {
        const fileType = String(data.file_type || "").toLowerCase();
        const isOcrType =
          !fileType ||
          fileType.includes("pdf") ||
          fileType.includes("image") ||
          fileType.includes("text");
        const isMediaType = fileType.includes("audio") || fileType.includes("video");

        if (isMediaType) {
          triggerTranscription(data.id);
        } else if (isOcrType) {
          triggerOcr(data.id, data.file_url);
        }
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

      invalidateDocumentDerivedQueries();

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

      invalidateDocumentDerivedQueries();
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

      invalidateDocumentDerivedQueries();

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

  // Send AI chat message — uses document-aware-chat for full document context
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("document-aware-chat", {
        body: { messages: newMessages, caseId: id },
      });

      if (error) throw new Error(error.message);

      const assistantContent = data?.choices?.[0]?.message?.content || "No response received.";
      if (data?._documentCount !== undefined) setChatDocumentCount(data._documentCount);
      setChatMessages([...newMessages, { role: "assistant", content: assistantContent }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
      setChatMessages(newMessages); // keep user message
    } finally {
      setChatLoading(false);
    }
  };

  // Draft brief with AI
  const draftBriefWithAI = async () => {
    if (!id || !briefForm.title.trim()) {
      toast.error("Enter a brief title first so the AI knows what to draft");
      return;
    }
    setIsDraftingBrief(true);
    setDraftProgress("Gathering case documents...");
    try {
      const motionType = `${briefForm.type}: ${briefForm.title}`;
      setDraftProgress("Generating draft with AI...");
      const generated = await generateMotionDraft(id, motionType, briefForm.court ? `Court: ${briefForm.court}` : undefined);
      // Flatten sections into content
      const content = [
        generated.caption ? `${generated.caption.document_title}\n\n` : "",
        ...generated.sections.map((s) => {
          let text = `## ${s.title}\n\n${s.content}`;
          if (s.subsections?.length) {
            text += "\n\n" + s.subsections.map((sub) => `### ${sub.heading}\n\n${sub.content}`).join("\n\n");
          }
          return text;
        }),
        generated.verification_flags?.length
          ? `\n\n---\n**VERIFICATION FLAGS (requires attorney review):**\n${generated.verification_flags.map((f) => `• ${f}`).join("\n")}`
          : "",
      ].join("\n\n").trim();

      setBriefForm((f) => ({ ...f, content }));
      toast.success("AI draft complete — review and edit before filing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI drafting failed");
    } finally {
      setIsDraftingBrief(false);
      setDraftProgress("");
    }
  };

  // Analyze argument strength
  const analyzeArgumentStrength = async (brief: LegalBrief) => {
    if (!brief.content) { toast.error("Brief has no content to analyze"); return; }
    setAnalyzingBriefId(brief.id);
    setBriefAnalysis(null);
    setShowAnalysisFor(brief.id);
    try {
      const { data, error } = await supabase.functions.invoke("argument-analyzer", {
        body: { briefId: brief.id, caseId: id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Analysis failed");
      setBriefAnalysis(data.analysis);
      toast.success("Argument analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
      setShowAnalysisFor(null);
    } finally {
      setAnalyzingBriefId(null);
    }
  };

  // Run cross-document intelligence
  const runCrossDocIntelligence = async () => {
    setRunningIntelligence(true);
    setCrossDocIntelligence(null);
    try {
      const { data, error } = await supabase.functions.invoke("cross-document-analysis", {
        body: { caseId: id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Analysis failed");
      setCrossDocIntelligence(data.analysis);
      toast.success("Cross-document analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Intelligence analysis failed");
    } finally {
      setRunningIntelligence(false);
    }
  };

  // Generate witness prep pack
  const generateWitnessPrep = async () => {
    if (!witnessName.trim()) { toast.error("Enter a witness name"); return; }
    setGeneratingWitnessPrep(true);
    setWitnessPrepResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("witness-prep", {
        body: { caseId: id, witnessName: witnessName.trim(), witnessRole },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Generation failed");
      setWitnessPrepResult(data.prepPack);
      toast.success(`Witness prep pack generated — ${data.witnessDocumentCount} documents reference this witness`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Witness prep generation failed");
    } finally {
      setGeneratingWitnessPrep(false);
    }
  };

  // Generate privilege log
  const generatePrivilegeLog = async () => {
    setGeneratingPrivilegeLog(true);
    setPrivilegeLogEntries([]);
    try {
      const { data, error } = await supabase.functions.invoke("privilege-log", {
        body: { caseId: id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Generation failed");
      setPrivilegeLogEntries(data.entries || []);
      toast.success(`Privilege log complete — ${data.privilegedCount} privileged documents identified out of ${data.totalDocumentsReviewed} reviewed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Privilege log generation failed");
    } finally {
      setGeneratingPrivilegeLog(false);
    }
  };

  // Count unanalyzed documents
  const unanalyzedCount = documents.filter(
    (doc) => !doc.ai_analyzed && doc.file_url && 
    (doc.file_type?.includes('pdf') || doc.file_type?.includes('image') || doc.file_type?.includes('text'))
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
      const { data: doc, error: fetchError } = await (supabase as any)
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
          await (supabase as any).storage.from('case-documents').remove([filePath]);
        }
      }

      const { error } = await (supabase as any).from("documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDocumentDerivedQueries();
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
      const { data, error } = await (supabase as any)
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
      queryClient.invalidateQueries({ queryKey: ["timeline-events"] });
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
      const batesNumber = docForm.bates_number || generateNextBatesNumber(documents, caseData?.name?.substring(0, 3).toUpperCase() || 'DOC');

      if (docForm.file && user && id) {
        await uploadAndProcessFile(
          docForm.file,
          id,
          user.id,
          undefined,
          { 
            bates_number: batesNumber,
            name: docForm.name || docForm.file.name 
          }
        );
        
        toast.success("Your document has been added to the queue for processing.");
        invalidateDocumentDerivedQueries();
        setIsUploadOpen(false);
        setDocForm({ name: "", bates_number: "", file: null });
      }
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
                <TabsTrigger value="witnesses" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Users className="h-4 w-4" />
                  Witnesses
                </TabsTrigger>
                <TabsTrigger value="intelligence" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Brain className="h-4 w-4" />
                  Intelligence
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Chat
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
                        invalidateDocumentDerivedQueries();
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
                            invalidateDocumentDerivedQueries();
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

                {/* Privilege Log Generator */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lock className="h-4 w-4 text-purple-500" />
                        Privilege Log Generator
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generatePrivilegeLog}
                        disabled={generatingPrivilegeLog || documents.length === 0}
                        className="gap-1.5 text-xs h-7"
                      >
                        {generatingPrivilegeLog ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />Reviewing documents...</>
                        ) : (
                          <><Shield className="h-3 w-3" />Generate Privilege Log</>
                        )}
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      AI reviews all documents and generates an FRCP 26(b)(5)-compliant privilege log
                    </CardDescription>
                  </CardHeader>
                  {privilegeLogEntries.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-3">
                          {privilegeLogEntries.length} privileged document{privilegeLogEntries.length !== 1 ? 's' : ''} identified
                        </p>
                        {privilegeLogEntries.map((entry: unknown, i) => {
                          const e = entry as Record<string, unknown>;
                          return (
                            <div key={i} className="text-xs border rounded-md p-3 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{e.batesNumber as string || e.documentName as string}</span>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {(e.privilegeType as string || '').replace('_', '-')}
                                </Badge>
                                {e.flagForReview && (
                                  <Badge className="text-xs bg-yellow-100 text-yellow-700">Needs review</Badge>
                                )}
                                <span className="text-muted-foreground">Confidence: {e.confidenceScore as number}%</span>
                              </div>
                              <p className="text-muted-foreground">{e.dateOfDocument as string} · {e.author as string}</p>
                              <p>{e.description as string}</p>
                              {e.basisForPrivilege && (
                                <p className="text-muted-foreground italic">{e.basisForPrivilege as string}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
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
                ) : (
                  <div className="mt-8">
                    <TimelineView 
                      events={timelineEvents} 
                      onEventClick={(event) => {
                        if (event.linked_document_id) {
                          const doc = documents.find(d => d.id === event.linked_document_id);
                          if (doc) handleViewDocument(doc);
                        }
                      }}
                    />
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Legal Briefs & Filings</h3>
                  <Button
                    onClick={() => {
                      setEditingBrief(null);
                      setBriefForm({ case_id: id || "", title: "", type: "motion", status: "draft", content: "", court: "", due_date: "" });
                      setIsBriefOpen(true);
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Brief
                  </Button>
                </div>

                {briefs.length === 0 ? (
                  <Card className="glass-card">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground text-center">
                        No briefs yet. Create your first motion, brief, or court filing.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {briefs.map((brief) => (
                      <Card key={brief.id} className="glass-card">
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-sm truncate">{brief.title}</span>
                                <Badge variant="outline" className="text-xs capitalize shrink-0">{brief.type}</Badge>
                                <Badge
                                  className={`text-xs capitalize shrink-0 ${
                                    brief.status === "filed" ? "bg-green-100 text-green-700" :
                                    brief.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                                    "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {brief.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {brief.court && <span>Court: {brief.court}</span>}
                                {brief.due_date && <span>Due: {format(new Date(brief.due_date), "MMM d, yyyy")}</span>}
                                <span>Created: {format(new Date(brief.created_at), "MMM d, yyyy")}</span>
                              </div>
                              {brief.content && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{brief.content}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Analyze argument strength"
                                disabled={analyzingBriefId === brief.id}
                                onClick={() => analyzeArgumentStrength(brief)}
                              >
                                {analyzingBriefId === brief.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit"
                                onClick={() => {
                                  setEditingBrief(brief);
                                  setBriefForm({
                                    case_id: brief.case_id,
                                    title: brief.title,
                                    type: brief.type,
                                    status: brief.status,
                                    content: brief.content,
                                    court: brief.court || "",
                                    due_date: brief.due_date || "",
                                  });
                                  setIsBriefOpen(true);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Delete"
                                onClick={() => setDeleteBriefId(brief.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {/* Argument Analysis Panel */}
                          {showAnalysisFor === brief.id && briefAnalysis && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-amber-500" />
                                  Argument Strength Analysis
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className={`text-lg font-bold ${
                                    (briefAnalysis.overallScore as number) >= 70 ? "text-green-600" :
                                    (briefAnalysis.overallScore as number) >= 40 ? "text-yellow-600" : "text-red-600"
                                  }`}>{briefAnalysis.overallScore as number}/100</span>
                                  <Badge variant="outline" className="text-xs capitalize">{briefAnalysis.predictedReception as string}</Badge>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAnalysisFor(null)}>
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {briefAnalysis.judgeFirstImpression && (
                                <p className="text-xs text-muted-foreground italic">"{briefAnalysis.judgeFirstImpression as string}"</p>
                              )}
                              {briefAnalysis.overallAssessment && (
                                <p className="text-sm">{briefAnalysis.overallAssessment as string}</p>
                              )}
                              {Array.isArray(briefAnalysis.topThreeImprovements) && (briefAnalysis.topThreeImprovements as string[]).length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold mb-1 text-amber-600">Top improvements:</p>
                                  <ul className="space-y-1">
                                    {(briefAnalysis.topThreeImprovements as string[]).map((imp, i) => (
                                      <li key={i} className="text-xs flex items-start gap-1.5">
                                        <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                                        {imp}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {briefAnalysis.weakestArgument && (
                                <div className="flex items-start gap-2 p-2 bg-red-50 rounded-md">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                  <p className="text-xs text-red-700"><span className="font-medium">Weakest argument: </span>{briefAnalysis.weakestArgument as string}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Brief Dialog */}
                <Dialog open={isBriefOpen} onOpenChange={(open) => { setIsBriefOpen(open); if (!open) setEditingBrief(null); }}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingBrief ? "Edit Brief" : "Create Brief"}</DialogTitle>
                      <DialogDescription>
                        Draft a motion, brief, complaint, or court filing.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label>Title</Label>
                        <Input
                          placeholder="e.g. Motion for Summary Judgment"
                          value={briefForm.title}
                          onChange={(e) => setBriefForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Type</Label>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                            value={briefForm.type}
                            onChange={(e) => setBriefForm((f) => ({ ...f, type: e.target.value }))}
                          >
                            <option value="motion">Motion</option>
                            <option value="brief">Brief</option>
                            <option value="complaint">Complaint</option>
                            <option value="response">Response</option>
                            <option value="order">Order</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Status</Label>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                            value={briefForm.status}
                            onChange={(e) => setBriefForm((f) => ({ ...f, status: e.target.value }))}
                          >
                            <option value="draft">Draft</option>
                            <option value="filed">Filed</option>
                            <option value="served">Served</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Court</Label>
                          <Input
                            placeholder="e.g. Travis County District Court"
                            value={briefForm.court}
                            onChange={(e) => setBriefForm((f) => ({ ...f, court: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={briefForm.due_date}
                            onChange={(e) => setBriefForm((f) => ({ ...f, due_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label>Content</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDraftingBrief || !briefForm.title.trim()}
                            onClick={draftBriefWithAI}
                            className="gap-1.5 text-xs h-7"
                          >
                            {isDraftingBrief ? (
                              <><Loader2 className="h-3 w-3 animate-spin" />{draftProgress || "Drafting..."}</>
                            ) : (
                              <><Sparkles className="h-3 w-3 text-amber-500" />Draft with AI</>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Brief content, argument, or notes — or click 'Draft with AI' to generate..."
                          rows={8}
                          value={briefForm.content}
                          onChange={(e) => setBriefForm((f) => ({ ...f, content: e.target.value }))}
                        />
                        {isDraftingBrief && (
                          <p className="text-xs text-muted-foreground">{draftProgress}</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsBriefOpen(false)}>Cancel</Button>
                      <Button
                        onClick={() => {
                          if (!briefForm.title.trim()) { toast.error("Title is required"); return; }
                          if (editingBrief) {
                            updateBriefMutation.mutate({ id: editingBrief.id, updates: briefForm });
                          } else {
                            createBriefMutation.mutate({ ...briefForm, case_id: id || "" });
                          }
                        }}
                        disabled={createBriefMutation.isPending || updateBriefMutation.isPending}
                      >
                        {(createBriefMutation.isPending || updateBriefMutation.isPending) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : editingBrief ? "Save Changes" : "Create Brief"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Delete Brief Alert */}
                <AlertDialog open={!!deleteBriefId} onOpenChange={() => setDeleteBriefId(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Brief</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this brief? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteBriefId && deleteBriefMutation.mutate(deleteBriefId)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteBriefMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>

              {/* Witnesses Tab */}
              <TabsContent value="witnesses" className="space-y-4">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Witness Preparation Hub
                    </CardTitle>
                    <CardDescription>
                      Generate AI-powered prep packs for any witness — deposition questions, impeachment material, and risk assessment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Witness Name</Label>
                        <Input
                          placeholder="e.g. John Smith"
                          value={witnessName}
                          onChange={(e) => setWitnessName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && generateWitnessPrep()}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Role</Label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                          value={witnessRole}
                          onChange={(e) => setWitnessRole(e.target.value)}
                        >
                          <option value="fact_witness">Fact Witness</option>
                          <option value="plaintiff">Plaintiff</option>
                          <option value="defendant">Defendant</option>
                          <option value="expert">Expert Witness</option>
                          <option value="adverse">Adverse Witness</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button
                          className="w-full gap-2"
                          onClick={generateWitnessPrep}
                          disabled={generatingWitnessPrep || !witnessName.trim()}
                        >
                          {generatingWitnessPrep ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                          ) : (
                            <><Brain className="h-4 w-4" />Generate Prep Pack</>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Witness Prep Results */}
                    {witnessPrepResult && (
                      <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-semibold text-sm">Prep Pack: {witnessName}</h4>

                        {/* Strategic Notes */}
                        {witnessPrepResult.strategicNotes && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Strategic Approach</p>
                            <p className="text-sm text-blue-900">{witnessPrepResult.strategicNotes as string}</p>
                          </div>
                        )}

                        {/* Risk Assessment */}
                        {witnessPrepResult.riskAssessment && (() => {
                          const risk = witnessPrepResult.riskAssessment as Record<string, unknown>;
                          return (
                            <div className="flex items-start gap-3 p-3 border rounded-lg">
                              <div className={`rounded-full w-12 h-12 flex items-center justify-center text-lg font-bold shrink-0 ${
                                (risk.score as number) >= 7 ? "bg-red-100 text-red-700" :
                                (risk.score as number) >= 4 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                              }`}>
                                {risk.score as number}/10
                              </div>
                              <div>
                                <p className="text-sm font-medium">Risk Level</p>
                                <p className="text-xs text-muted-foreground">{risk.rationale as string}</p>
                                {Array.isArray(risk.primaryRisks) && (risk.primaryRisks as string[]).length > 0 && (
                                  <ul className="mt-2 space-y-0.5">
                                    {(risk.primaryRisks as string[]).slice(0, 3).map((r, i) => (
                                      <li key={i} className="text-xs flex items-start gap-1">
                                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                        {r}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Preparation Questions */}
                        {Array.isArray(witnessPrepResult.prepQuestions) && (witnessPrepResult.prepQuestions as unknown[]).length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <Target className="h-4 w-4 text-primary" />
                              Examination Questions ({(witnessPrepResult.prepQuestions as unknown[]).length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {(witnessPrepResult.prepQuestions as Record<string, unknown>[]).map((q, i) => (
                                <div key={i} className="text-xs border rounded-md p-3 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs capitalize">{q.type as string}</Badge>
                                    <Badge className={`text-xs ${
                                      q.riskLevel === "high" ? "bg-red-100 text-red-700" :
                                      q.riskLevel === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                                    }`}>
                                      {q.riskLevel as string} risk
                                    </Badge>
                                    {q.sourceDocument && <span className="text-muted-foreground">[{q.sourceDocument as string}]</span>}
                                  </div>
                                  <p className="font-medium">{q.question as string}</p>
                                  <p className="text-muted-foreground">{q.purpose as string}</p>
                                  {q.trapVariant && <p className="text-amber-600 italic">Trap: {q.trapVariant as string}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Impeachment Material */}
                        {Array.isArray(witnessPrepResult.impeachmentMaterial) && (witnessPrepResult.impeachmentMaterial as unknown[]).length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              Impeachment Material
                            </h5>
                            <div className="space-y-2">
                              {(witnessPrepResult.impeachmentMaterial as Record<string, unknown>[]).map((item, i) => (
                                <div key={i} className="text-xs border border-red-200 rounded-md p-3 bg-red-50 space-y-1">
                                  <p className="font-medium text-red-800">{item.statement as string}</p>
                                  <p className="text-red-600">Source: {item.source as string}</p>
                                  <p className="text-muted-foreground">Contradicts: {item.contradiction as string}</p>
                                  <p className="text-blue-600 italic">{item.impeachmentTechnique as string}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Key Exhibits */}
                        {Array.isArray(witnessPrepResult.keyExhibits) && (witnessPrepResult.keyExhibits as unknown[]).length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-500" />
                              Key Exhibits to Mark
                            </h5>
                            <div className="space-y-1">
                              {(witnessPrepResult.keyExhibits as Record<string, unknown>[]).map((ex, i) => (
                                <div key={i} className="text-xs flex items-start gap-2 p-2 border rounded-md">
                                  <Badge variant="outline" className="text-xs shrink-0">{ex.document as string}</Badge>
                                  <div>
                                    <p>{ex.purpose as string}</p>
                                    <p className="text-muted-foreground">Foundation: {ex.foundation as string}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {documents.filter((d) => d.ai_analyzed).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Analyze documents first — the AI will find all references to the witness across your case record</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Intelligence Tab */}
              <TabsContent value="intelligence" className="space-y-4">
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-blue-500" />
                          Cross-Document Intelligence
                        </CardTitle>
                        <CardDescription>
                          AI analyzes all case documents together to find contradictions, key admissions, and record gaps
                        </CardDescription>
                      </div>
                      <Button
                        onClick={runCrossDocIntelligence}
                        disabled={runningIntelligence || documents.filter((d) => d.ai_analyzed).length < 2}
                      >
                        {runningIntelligence ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                        ) : (
                          <><Sparkles className="h-4 w-4 mr-2" />Run Intelligence Analysis</>
                        )}
                      </Button>
                    </div>
                  </CardHeader>

                  {runningIntelligence && (
                    <CardContent>
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center space-y-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                          <p className="text-sm text-muted-foreground">Analyzing {documents.filter((d) => d.ai_analyzed).length} documents for contradictions, admissions, and gaps...</p>
                        </div>
                      </div>
                    </CardContent>
                  )}

                  {!crossDocIntelligence && !runningIntelligence && (
                    <CardContent>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Brain className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="font-medium mb-2">Run Cross-Document Analysis</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          {documents.filter((d) => d.ai_analyzed).length < 2
                            ? `Need at least 2 analyzed documents (currently ${documents.filter((d) => d.ai_analyzed).length}). Analyze your documents first.`
                            : `Analyzes all ${documents.filter((d) => d.ai_analyzed).length} analyzed documents to surface contradictions, admissions, and strategic intelligence.`
                          }
                        </p>
                      </div>
                    </CardContent>
                  )}

                  {crossDocIntelligence && !runningIntelligence && (() => {
                    const intel = crossDocIntelligence as Record<string, unknown>;
                    return (
                      <CardContent className="space-y-6">
                        {intel.executiveSummary && (
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-700 mb-1">Executive Summary</p>
                            <p className="text-sm text-blue-900">{intel.executiveSummary as string}</p>
                            <p className="text-xs text-blue-600 mt-2">Documents analyzed: {intel.documentsAnalyzed as number}</p>
                          </div>
                        )}

                        {/* Contradictions */}
                        {Array.isArray(intel.contradictions) && (intel.contradictions as unknown[]).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              Factual Contradictions ({(intel.contradictions as unknown[]).length})
                            </h4>
                            <div className="space-y-3">
                              {(intel.contradictions as Record<string, unknown>[]).map((c, i) => (
                                <div key={i} className="border rounded-lg p-4 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className={`text-xs ${c.significance === 'high' ? 'bg-red-100 text-red-700' : c.significance === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                                      {c.significance as string} significance
                                    </Badge>
                                    <span className="text-sm font-medium">{c.topic as string}</span>
                                  </div>
                                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                                    <div className="p-2 bg-muted rounded">
                                      <p className="font-medium text-muted-foreground mb-1">[{c.docA as string}] says:</p>
                                      <p>"{c.stateA as string}"</p>
                                    </div>
                                    <div className="p-2 bg-muted rounded">
                                      <p className="font-medium text-muted-foreground mb-1">[{c.docB as string}] says:</p>
                                      <p>"{c.stateB as string}"</p>
                                    </div>
                                  </div>
                                  {c.exploitStrategy && (
                                    <div className="flex items-start gap-2 p-2 bg-green-50 rounded text-xs">
                                      <Lightbulb className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                                      <p className="text-green-800">{c.exploitStrategy as string}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Key Admissions */}
                        {Array.isArray(intel.admissions) && (intel.admissions as unknown[]).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              Key Admissions ({(intel.admissions as unknown[]).length})
                            </h4>
                            <div className="space-y-2">
                              {(intel.admissions as Record<string, unknown>[]).map((a, i) => (
                                <div key={i} className="border border-green-200 rounded-lg p-3 bg-green-50 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">[{a.doc as string}]</Badge>
                                    <Badge className="text-xs bg-blue-100 text-blue-700 capitalize">{(a.bestUsedAt as string)?.replace('_', ' ')}</Badge>
                                  </div>
                                  <p className="text-sm font-medium text-green-900">"{a.admission as string}"</p>
                                  <p className="text-xs text-green-700">{a.legalSignificance as string}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Record Gaps */}
                        {Array.isArray(intel.gaps) && (intel.gaps as unknown[]).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Search className="h-4 w-4 text-amber-500" />
                              Record Gaps — Discovery Needed ({(intel.gaps as unknown[]).length})
                            </h4>
                            <div className="space-y-2">
                              {(intel.gaps as Record<string, unknown>[]).map((g, i) => (
                                <div key={i} className="border rounded-lg p-3 space-y-1">
                                  <p className="text-sm font-medium">{g.missingFact as string}</p>
                                  <p className="text-xs text-muted-foreground">{g.whyImportant as string}</p>
                                  <p className="text-xs text-blue-600">Where to find: {g.whereToFind as string}</p>
                                  <p className="text-xs font-medium text-amber-700">Discovery action: {g.discoveryAction as string}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Strongest Evidence */}
                        {Array.isArray(intel.strongestEvidence) && (intel.strongestEvidence as unknown[]).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Star className="h-4 w-4 text-amber-500" />
                              Strongest Evidence for Our Position
                            </h4>
                            <div className="space-y-2">
                              {(intel.strongestEvidence as Record<string, unknown>[]).map((e, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                  <span className="font-bold text-amber-500 shrink-0">{i + 1}.</span>
                                  <div>
                                    <span className="font-medium">[{e.doc as string}]</span> — {e.fact as string}
                                    <p className="text-green-600 mt-0.5">{e.impact as string}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    );
                  })()}
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

                {/* AI Chat */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-amber-500" />
                      Ask the AI
                      {chatDocumentCount > 0 && (
                        <Badge variant="outline" className="text-xs ml-auto font-normal">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {chatDocumentCount} doc{chatDocumentCount !== 1 ? 's' : ''} in context
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Ask anything about your case — the AI searches all {documents.filter(d => d.ai_analyzed).length} analyzed documents for answers.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {chatMessages.length === 0 && documents.filter(d => d.ai_analyzed).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Suggested questions:</p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "What are the strongest arguments for our position?",
                            "What contradictions exist between the documents?",
                            "What key admissions did the opposing party make?",
                            "What are our biggest vulnerabilities?",
                          ].map((q) => (
                            <button
                              key={q}
                              onClick={() => { setChatInput(q); }}
                              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-left"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.length > 0 && (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {chatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted rounded-lg px-4 py-2.5">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask about case strategy, legal issues, document analysis..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                        disabled={chatLoading}
                      />
                      <Button
                        size="icon"
                        onClick={sendChatMessage}
                        disabled={chatLoading || !chatInput.trim()}
                      >
                        {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
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
      
      {id && <ProcessingStatusBar caseId={id} />}
    </Layout>
  );
}
