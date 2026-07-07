import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSessions, deleteSession, TrialSession } from "@/lib/session-api";
import { getCases, Case } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  History,
  Play,
  Trash2,
  Clock,
  BarChart2,
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionPlayer } from "./SessionPlayer";

interface SessionHistoryProps {
  onSelectSession?: (session: TrialSession) => void;
}

type SortOption = "date-desc" | "date-asc" | "score-desc" | "score-asc";

export function SessionHistory({ onSelectSession }: SessionHistoryProps) {
  const [selectedCase, setSelectedCase] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [playingSession, setPlayingSession] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions", selectedCase],
    queryFn: () => getSessions(selectedCase === "all" ? undefined : selectedCase),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setDeleteId(null);
      toast.success("Session deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sortedSessions = [...sessions].sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "date-asc":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "score-desc":
        return (b.score || 0) - (a.score || 0);
      case "score-asc":
        return (a.score || 0) - (b.score || 0);
      default:
        return 0;
    }
  });

  const getCaseName = (caseId: string) => {
    const caseItem = cases.find((c) => c.id === caseId);
    return caseItem?.name || "Unknown Case";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700";
    if (score >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      "cross-examination": "Cross-Examination",
      "direct-examination": "Direct Examination",
      "opening-statement": "Opening Statement",
      "closing-argument": "Closing Argument",
      "deposition": "Deposition",
      "motion-hearing": "Motion Hearing",
      "objections-practice": "Objections Practice",
      "voir-dire": "Voir Dire",
      "evidence-foundation": "Evidence Foundation",
    };
    return labels[phase] || phase;
  };

  const isLoading = casesLoading || sessionsLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Session History</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedCase} onValueChange={setSelectedCase}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by case" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cases</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="score-desc">Highest Score</SelectItem>
              <SelectItem value="score-asc">Lowest Score</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedSessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">No sessions recorded yet</p>
            <p className="text-muted-foreground text-xs mt-1">
              Start a trial prep session to see your history here
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {sortedSessions.map((session) => (
              <Card
                key={session.id}
                className={cn(
                  "transition-all cursor-pointer hover:shadow-md",
                  expandedSession === session.id && "ring-2 ring-primary"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {getCaseName(session.case_id)}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {getPhaseLabel(session.phase)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {session.mode}
                        </Badge>
                        <Badge className={cn("text-xs", getScoreColor(session.score || 0))}>
                          Score: {session.score || 0}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.duration_seconds)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedSession(
                            expandedSession === session.id ? null : session.id
                          );
                        }}
                      >
                        {expandedSession === session.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(session.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                    <div className="flex items-center gap-2">
                      {session.audio_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingSession(
                              playingSession === session.id ? null : session.id
                            );
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {playingSession === session.id ? "Hide Player" : "Play"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(session.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {expandedSession === session.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Rhetorical</p>
                            <p className="text-sm font-medium">
                              {session.metrics?.rhetoricalScore || 0}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Words</p>
                            <p className="text-sm font-medium">
                              {session.metrics?.wordCount || 0}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">WPM</p>
                          <p className="text-sm font-medium">
                            {session.metrics?.wordsPerMinute || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Objections</p>
                          <p className="text-sm font-medium">
                            {session.metrics?.objectionsReceived || 0}
                          </p>
                        </div>
                      </div>

                      {session.feedback && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs font-medium mb-1">AI Feedback</p>
                          <p className="text-sm text-muted-foreground">{session.feedback}</p>
                        </div>
                      )}

                      {session.transcript && session.transcript.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-medium mb-2">Transcript Preview</p>
                          <ScrollArea className="h-32 w-full rounded border bg-muted/30 p-2">
                            {session.transcript.slice(0, 10).map((entry, idx) => (
                              <div key={idx} className="mb-2 text-xs">
                                <span className="font-medium capitalize">{entry.role}:</span>{" "}
                                <span className="text-muted-foreground">
                                  {entry.content.substring(0, 100)}
                                  {entry.content.length > 100 ? "..." : ""}
                                </span>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  )}

                  {playingSession === session.id && session.audio_url && (
                    <div className="mt-4 pt-4 border-t">
                      <SessionPlayer
                        audioUrl={session.audio_url}
                        transcript={session.transcript}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This will permanently remove the
              recording and transcript. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
