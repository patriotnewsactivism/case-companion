import { Layout } from "@/components/Layout";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Document = Tables<"documents">;
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

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [docForm, setDocForm] = useState({
    name: "",
    bates_number: "",
    file: null as File | null,
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
        .order("created_at", { ascending: false });
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
    mutationFn: async (input: { name: string; bates_number?: string; file_url?: string; file_type?: string; file_size?: number }) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      setIsUploadOpen(false);
      setDocForm({ name: "", bates_number: "", file: null });
      toast({
        title: "Document uploaded",
        description: "Your document has been added to the case.",
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

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      // First, get the document to find the file_url
      const { data: doc, error: fetchError } = await supabase
        .from("documents")
        .select("file_url")
        .eq("id", docId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage if file exists
      if (doc?.file_url && user) {
        // Extract the file path from the URL
        const urlParts = doc.file_url.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'case-documents');
        if (bucketIndex !== -1) {
          const filePath = urlParts.slice(bucketIndex + 1).join('/');
          const { error: storageError } = await supabase.storage
            .from('case-documents')
            .remove([filePath]);

          if (storageError) {
            console.error("Failed to delete file from storage:", storageError);
          }
        }
      }

      // Delete the document record
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

      // Upload file to Supabase Storage if a file is selected
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

        // Get public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from('case-documents')
          .getPublicUrl(uploadData.path);

        fileUrl = publicUrl;
      }

      await createDocMutation.mutateAsync({
        name: docForm.name,
        bates_number: docForm.bates_number || undefined,
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

    // Open the document in a new tab
    window.open(doc.file_url, '_blank');
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
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Upload discovery documents, pleadings, and evidence
                  </p>
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
                            Add a document to this case for discovery analysis
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="doc_name">Document Name *</Label>
                            <Input
                              id="doc_name"
                              placeholder="Deposition of John Doe"
                              value={docForm.name}
                              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="bates">Bates Number</Label>
                            <Input
                              id="bates"
                              placeholder="DOE-001"
                              value={docForm.bates_number}
                              onChange={(e) => setDocForm({ ...docForm, bates_number: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="file">File</Label>
                            <Input
                              id="file"
                              type="file"
                              onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                            />
                            <p className="text-xs text-muted-foreground">
                              PDF, Word, Text, or Image files up to 20MB
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
                              "Upload"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

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
                        Upload discovery documents to get started
                      </p>
                      <Button onClick={() => setIsUploadOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload First Document
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {documents.map((doc) => (
                      <Card key={doc.id} className="glass-card hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="rounded-lg bg-primary/10 p-3">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{doc.name}</h4>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              {doc.bates_number && (
                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                  {doc.bates_number}
                                </span>
                              )}
                              {doc.file_type && <span>{doc.file_type}</span>}
                              <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                            </div>
                            {doc.ai_analyzed && (
                              <div className="flex items-center gap-2 mt-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span className="text-xs text-green-600">AI Analyzed</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View"
                              onClick={() => handleViewDocument(doc)}
                              disabled={!doc.file_url}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              onClick={() => setDeleteDocId(doc.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
