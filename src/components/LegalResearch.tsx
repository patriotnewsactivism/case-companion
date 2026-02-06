import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Plus, Loader2, Tag, Link2, Scale, Trash2, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { getResearchNotes, createResearchNote, deleteResearchNote, updateResearchNote, type ResearchNote, type CreateResearchNoteInput } from "@/lib/premium-api";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface LegalResearchProps {
  caseId?: string;
}

export function LegalResearch({ caseId }: LegalResearchProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [formData, setFormData] = useState<CreateResearchNoteInput>({
    title: "",
    content: "",
    case_id: caseId,
    research_topic: "",
    jurisdiction: "",
    tags: [],
  });

  const [tagInput, setTagInput] = useState("");

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
    enabled: !caseId,
  });

  const { data: researchNotes = [], isLoading } = useQuery({
    queryKey: ["research-notes", caseId],
    queryFn: () => getResearchNotes(caseId),
  });

  const createMutation = useMutation({
    mutationFn: createResearchNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Research Note Saved", description: "Your research has been documented." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResearchNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes"] });
      toast({ title: "Note Deleted", description: "Research note has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const note = researchNotes.find(n => n.id === noteId);
      if (!note) throw new Error("Note not found");
      
      // Call AI to analyze the research
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: "system",
              content: "You are a legal research assistant. Analyze the following legal research and provide: 1) A concise summary (2-3 sentences), 2) Key findings as bullet points. Return JSON with 'summary' and 'key_findings' array."
            },
            {
              role: "user",
              content: `Research Topic: ${note.research_topic || 'General'}\nJurisdiction: ${note.jurisdiction || 'Not specified'}\n\nContent:\n${note.content}`
            }
          ]
        }
      });
      
      if (error) throw error;
      
      // Parse AI response
      let parsed;
      try {
        const content = data?.choices?.[0]?.message?.content || data;
        parsed = typeof content === 'string' ? JSON.parse(content) : content;
      } catch {
        parsed = { summary: "Analysis completed.", key_findings: [] };
      }
      
      // Update the note with AI analysis
      return updateResearchNote(noteId, {
        ai_summary: parsed.summary,
        key_findings: parsed.key_findings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes"] });
      toast({ title: "Analysis Complete", description: "AI has analyzed your research." });
    },
    onError: (error: Error) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      case_id: caseId,
      research_topic: "",
      jurisdiction: "",
      tags: [],
    });
    setTagInput("");
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tag) || [] });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            Legal Research
          </CardTitle>
          <CardDescription>Document and analyze your legal research</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Research
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Research Note</DialogTitle>
              <DialogDescription>Document your legal research findings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Summary Judgment Standards in Negligence Cases"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Research Topic</Label>
                  <Input
                    placeholder="e.g., Duty of Care"
                    value={formData.research_topic || ""}
                    onChange={(e) => setFormData({ ...formData, research_topic: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jurisdiction</Label>
                  <Input
                    placeholder="e.g., California, Federal"
                    value={formData.jurisdiction || ""}
                    onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                  />
                </div>
              </div>

              {!caseId && (
                <div className="space-y-2">
                  <Label>Associated Case (Optional)</Label>
                  <Select 
                    value={formData.case_id || ""} 
                    onValueChange={(v) => setFormData({ ...formData, case_id: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a case (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No case</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Research Content *</Label>
                <Textarea
                  placeholder="Enter your research notes, case law analysis, statutory interpretation..."
                  className="min-h-[200px]"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Case Citations</Label>
                <Input
                  placeholder="e.g., Smith v. Jones, 123 F.3d 456 (9th Cir. 2020)"
                  value={(formData.case_citations || []).join(", ")}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    case_citations: e.target.value ? e.target.value.split(",").map(s => s.trim()) : [] 
                  })}
                />
                <p className="text-xs text-muted-foreground">Separate multiple citations with commas</p>
              </div>

              <div className="space-y-2">
                <Label>Statute References</Label>
                <Input
                  placeholder="e.g., 42 U.S.C. § 1983"
                  value={(formData.statute_references || []).join(", ")}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    statute_references: e.target.value ? e.target.value.split(",").map(s => s.trim()) : [] 
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Source URLs</Label>
                <Input
                  placeholder="https://..."
                  value={(formData.source_urls || []).join(", ")}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    source_urls: e.target.value ? e.target.value.split(",").map(s => s.trim()) : [] 
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>Add</Button>
                </div>
                {formData.tags && formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Research
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : researchNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No research notes yet</p>
            <p className="text-sm">Document your legal research and analysis</p>
          </div>
        ) : (
          <div className="space-y-4">
            {researchNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{note.title}</h4>
                      {note.jurisdiction && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          {note.jurisdiction}
                        </Badge>
                      )}
                    </div>
                    {note.research_topic && (
                      <p className="text-sm text-muted-foreground">Topic: {note.research_topic}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                    
                    {note.ai_summary && (
                      <div className="mt-2 p-3 bg-accent/10 rounded-lg">
                        <p className="text-xs font-medium flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3" /> AI Summary
                        </p>
                        <p className="text-sm">{note.ai_summary}</p>
                        {note.key_findings && note.key_findings.length > 0 && (
                          <ul className="mt-2 text-sm text-muted-foreground list-disc pl-4">
                            {note.key_findings.map((finding, i) => (
                              <li key={i}>{finding}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {note.case_citations && note.case_citations.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.case_citations.map((cite, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{cite}</Badge>
                        ))}
                      </div>
                    )}

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
                            <Tag className="h-2 w-2" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(note.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {!note.ai_summary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => analyzeMutation.mutate(note.id)}
                        disabled={analyzeMutation.isPending}
                        className="gap-1"
                      >
                        {analyzeMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Analyze
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(note.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
