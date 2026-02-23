import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  User,
  Scale,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialSimulationSession, TranscriptMessage } from "@/lib/trial-session-api";

interface SessionReviewProps {
  session: TrialSimulationSession;
  onClose?: () => void;
}

type MessageFilter = 'all' | 'user' | 'assistant' | 'system';

export function SessionReview({ session, onClose }: SessionReviewProps) {
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [highlightedTypes, setHighlightedTypes] = useState<Set<string>>(new Set(['objection', 'coaching']));

  const filteredMessages = useMemo(() => {
    if (filter === 'all') return session.transcript;
    return session.transcript.filter(msg => msg.role === filter);
  }, [session.transcript, filter]);

  const sessionDuration = useMemo(() => {
    if (!session.ended_at) return 'In progress';
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    const minutes = Math.floor((end - start) / 60000);
    const seconds = Math.floor(((end - start) % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }, [session.started_at, session.ended_at]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getMessageHighlight = (message: TranscriptMessage): string | null => {
    const content = message.content.toLowerCase();
    if (content.includes('objection')) return 'objection';
    if (content.includes('sustained') || content.includes('overruled')) return 'ruling';
    return null;
  };

  const exportTranscript = () => {
    const lines = session.transcript.map(msg => {
      const role = msg.role === 'user' ? 'ATTORNEY' : msg.role === 'system' ? 'COURT' : (msg.aiRole || 'AI').toUpperCase();
      return `[${formatTimestamp(msg.timestamp)}] ${role}: ${msg.content}`;
    });

    const header = `Trial Simulation Transcript
Case: ${session.case_id || 'N/A'}
Mode: ${session.mode}
Started: ${new Date(session.started_at).toLocaleString()}
Ended: ${session.ended_at ? new Date(session.ended_at).toLocaleString() : 'N/A'}
Duration: ${sessionDuration}
---
`;
    const blob = new Blob([header + lines.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-session-${session.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <CardHeader className="py-4 px-6 border-b space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Session Review</CardTitle>
            <CardDescription>
              {session.mode} • {session.transcript.length} messages • {sessionDuration}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportTranscript}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={filter} onValueChange={(v) => setFilter(v as MessageFilter)}>
            <SelectTrigger className="w-36">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="user">Attorney</SelectItem>
              <SelectItem value="assistant">AI/Witness</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Button
              size="sm"
              variant={highlightedTypes.has('objection') ? 'default' : 'ghost'}
              onClick={() => {
                setHighlightedTypes(prev => {
                  const next = new Set(prev);
                  if (next.has('objection')) next.delete('objection');
                  else next.add('objection');
                  return next;
                });
              }}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Objections
            </Button>
            <Button
              size="sm"
              variant={highlightedTypes.has('coaching') ? 'default' : 'ghost'}
              onClick={() => {
                setHighlightedTypes(prev => {
                  const next = new Set(prev);
                  if (next.has('coaching')) next.delete('coaching');
                  else next.add('coaching');
                  return next;
                });
              }}
            >
              <Lightbulb className="h-3 w-3 mr-1" />
              Coaching
            </Button>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages match the current filter</p>
            </div>
          ) : (
            filteredMessages.map((message, index) => {
              const highlight = getMessageHighlight(message);
              const isHighlighted = highlight && highlightedTypes.has(highlight);

              return (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-lg border p-3 transition-all",
                    message.role === 'user' && "bg-accent/5 border-accent/20",
                    message.role === 'assistant' && "bg-slate-50 border-slate-200",
                    message.role === 'system' && "bg-muted border-muted-foreground/20",
                    isHighlighted && "ring-2 ring-amber-400/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      message.role === 'user' ? "bg-accent/20 text-accent" : "bg-slate-200 text-slate-600"
                    )}>
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : message.role === 'system' ? (
                        <Scale className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-sm font-medium",
                          message.role === 'user' ? "text-accent" : "text-slate-600"
                        )}>
                          {message.role === 'user' ? 'Attorney' : message.role === 'system' ? 'Court' : (message.aiRole || 'AI')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp)}
                        </span>
                        {highlight && (
                          <Badge variant="outline" className="text-xs">
                            {highlight === 'objection' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {highlight}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {session.ai_coaching && session.ai_coaching.length > 0 && (
        <div className="border-t p-4 bg-blue-50/50">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-700 mb-1">Coaching Summary</p>
              <ul className="text-xs text-blue-600 space-y-1">
                {session.ai_coaching.slice(0, 3).map((tip, i) => (
                  <li key={i}>• {tip.substring(0, 150)}{tip.length > 150 ? '...' : ''}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {session.performance_metrics && (
        <div className="border-t p-4 bg-muted/30">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{session.performance_metrics.totalQuestions}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{session.performance_metrics.successfulObjections}</p>
              <p className="text-xs text-muted-foreground">Objections Won</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{session.performance_metrics.leadingQuestionsUsed}</p>
              <p className="text-xs text-muted-foreground">Leading Qs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{session.performance_metrics.credibilityScore || '-'}</p>
              <p className="text-xs text-muted-foreground">Credibility</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
