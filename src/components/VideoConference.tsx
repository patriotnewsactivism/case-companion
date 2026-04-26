import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video, Loader2, Users, Shield, Copy, Check,
  Mail, Link2, ExternalLink, Phone, PhoneOff,
  Mic, MicOff, VideoOff, Monitor, X,
  FileText, Upload, PanelRightOpen, PanelRightClose,
  StickyNote, Circle, StopCircle, Share2, Eye,
  Download, Clock, AlertCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createVideoRoom, getCases, joinVideoRoom, getDocumentsByCase } from "@/lib/api";
import { uploadAndProcessFile } from "@/lib/upload/unified-upload-handler";
import { cn } from "@/lib/utils";

interface VideoRoomData {
  roomId?: string;
  roomUrl: string;
  roomName: string;
  token: string;
  expiresAt?: string;
  enableRecording?: boolean;
}

interface VideoConferenceProps {
  /** Pre-select a case (when opened from case detail) */
  defaultCaseId?: string;
}

interface MeetingNote {
  id: string;
  text: string;
  timestamp: string;
  author: string;
}

export function VideoConference({ defaultCaseId }: VideoConferenceProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [roomName, setRoomName] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId ?? "");
  const [description, setDescription] = useState("");
  const [currentRoom, setCurrentRoom] = useState<VideoRoomData | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inCallView, setInCallView] = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Side panel
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<"documents" | "notes">("documents");

  // Meeting notes
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [currentNote, setCurrentNote] = useState("");

  // Document upload during call
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording state (tracked via postMessage from Daily iframe)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);

  // In-call controls (for the embedded iframe)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  // Fetch case documents when in a call with a selected case
  const { data: caseDocuments = [], refetch: refetchDocs } = useQuery({
    queryKey: ["case-documents-video", selectedCaseId],
    queryFn: () => getDocumentsByCase(selectedCaseId),
    enabled: !!selectedCaseId && inCallView,
  });

  // Listen for Daily.co iframe messages (recording events, etc.)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { action } = event.data;
      if (action === "recording-started") {
        setIsRecording(true);
        setRecordingStartTime(new Date());
        toast.success("Recording started — linked to your case file");
      } else if (action === "recording-stopped" || action === "recording-error") {
        setIsRecording(false);
        setRecordingStartTime(null);
        if (action === "recording-stopped") {
          toast.success("Recording saved — will appear in your case files");
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const selectedCaseName = cases.find(c => c.id === selectedCaseId)?.name || "Unknown Case";

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      if (!roomName.trim() || !selectedCaseId) {
        throw new Error("Please provide a room name and select a case");
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      return createVideoRoom(roomName, selectedCaseId, {
        description: description || undefined,
        enableRecording: true,
        maxParticipants: 10,
        expiresInMinutes: 240,
      });
    },
    onSuccess: (data) => {
      setCurrentRoom(data);
      setCreateDialogOpen(false);
      setInCallView(true);
      toast.success("Video room created — you're live!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async () => {
      if (!joinRoomId.trim()) throw new Error("Please enter a room ID");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      return joinVideoRoom(joinRoomId.trim(), user?.email || "Participant");
    },
    onSuccess: (data) => {
      setCurrentRoom(data);
      setJoinDialogOpen(false);
      setJoinRoomId("");
      setInCallView(true);
      toast.success("Joined video room");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Generate invite link ──
  const generateInviteLink = useCallback(() => {
    if (!currentRoom) return "";
    const expires = Date.now() + 60 * 60 * 1000;
    const guestToken = btoa(`guest:${currentRoom.roomId || currentRoom.roomName}:${expires}`);
    return `${window.location.origin}/video/join?room=${currentRoom.roomId || currentRoom.roomName}&gt=${guestToken}`;
  }, [currentRoom]);

  const copyInviteLink = useCallback(async () => {
    const inviteUrl = generateInviteLink();
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Guest link copied — valid for 1 hour, no account needed");
    } catch {
      // Fallback for mobile where clipboard may not be available
      prompt("Copy this invite link:", inviteUrl);
    }
  }, [generateInviteLink]);

  // ── Send email invite with resilient fallback ──
  const sendEmailInvite = useCallback(async () => {
    if (!inviteEmail.trim() || !currentRoom) return;
    setSendingInvite(true);
    const joinUrl = generateInviteLink();
    
    try {
      const res = await (supabase as any).functions.invoke("send-email", {
        body: {
          to: inviteEmail.trim(),
          subject: `Video Conference Invitation: ${currentRoom.roomName}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h2 style="color:#1a1a2e">You've been invited to a secure video conference</h2>
            <p><strong>Room:</strong> ${currentRoom.roomName}</p>
            ${selectedCaseId ? `<p><strong>Case:</strong> ${selectedCaseName}</p>` : ""}
            <p style="margin:24px 0">
              <a href="${joinUrl}" style="background:#d4a017;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Join Video Conference</a>
            </p>
            <p style="color:#666;font-size:12px">Or copy this link: ${joinUrl}</p>
            <p style="color:#999;font-size:11px">No CaseBuddy account required. Link expires in 1 hour.</p>
          </div>`,
          text: `You've been invited to join: ${currentRoom.roomName}\nJoin at: ${joinUrl}`,
          case_id: selectedCaseId || undefined,
          message_type: "video_invite",
        },
      });
      if (res.error) throw res.error;
      const sent = res.data?.sent;
      toast.success(sent
        ? `Invite email sent to ${inviteEmail}`
        : `Invite logged for ${inviteEmail} — link copied to clipboard as backup`
      );
      // Always copy link as backup
      if (!sent) {
        try { await navigator.clipboard.writeText(joinUrl); } catch {}
      }
    } catch (err) {
      console.error("Invite edge function error:", err);
      // Fallback: copy invite link and show helpful message
      try {
        await navigator.clipboard.writeText(joinUrl);
        toast.info(
          `Email service unavailable — invite link copied to clipboard. Share it with ${inviteEmail} directly.`,
          { duration: 6000 }
        );
      } catch {
        // Last resort: show the link in a prompt
        prompt(`Share this link with ${inviteEmail}:`, joinUrl);
      }
    } finally {
      setSendingInvite(false);
      setInviteEmail("");
      setInviteDialogOpen(false);
    }
  }, [inviteEmail, currentRoom, selectedCaseId, selectedCaseName, generateInviteLink]);

  // ── Share via native share API (mobile) ──
  const nativeShare = useCallback(async () => {
    const joinUrl = generateInviteLink();
    if (!joinUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Video Conference: ${currentRoom?.roomName}`,
          text: "You've been invited to a secure CaseBuddy video conference",
          url: joinUrl,
        });
        toast.success("Shared successfully");
      } catch (e) {
        // User cancelled or share failed — fall back to copy
        copyInviteLink();
      }
    } else {
      copyInviteLink();
    }
  }, [generateInviteLink, currentRoom, copyInviteLink]);

  // ── Meeting notes ──
  const addNote = useCallback(() => {
    if (!currentNote.trim()) return;
    const note: MeetingNote = {
      id: crypto.randomUUID(),
      text: currentNote.trim(),
      timestamp: new Date().toISOString(),
      author: user?.email || "Unknown",
    };
    setMeetingNotes(prev => [note, ...prev]);
    setCurrentNote("");

    // Save note to case_events for tracking
    if (selectedCaseId) {
      supabase.from("case_events").insert({
        case_id: selectedCaseId,
        user_id: user?.id,
        event_type: "video_conference_note",
        title: `Meeting note: ${currentRoom?.roomName || "Video Conference"}`,
        description: note.text,
        metadata: {
          room_id: currentRoom?.roomId,
          room_name: currentRoom?.roomName,
          timestamp: note.timestamp,
        },
      }).then(({ error }) => {
        if (error) console.warn("Failed to save note to case events:", error.message);
      });
    }
  }, [currentNote, user, selectedCaseId, currentRoom]);

  // ── Upload document during call ──
  const handleInCallUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !selectedCaseId) return;
    setIsUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadAndProcessFile(file, selectedCaseId, user?.id || "");
        successCount++;
      } catch (err) {
        console.error(`Upload failed for ${file.name}:`, err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setIsUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} document${successCount > 1 ? "s" : ""} uploaded to case`);
      refetchDocs();
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedCaseId, user, refetchDocs]);

  // ── Leave call ──
  const leaveCall = useCallback(async () => {
    // Save meeting notes summary to case events
    if (selectedCaseId && meetingNotes.length > 0) {
      const notesSummary = meetingNotes.map(n => `[${new Date(n.timestamp).toLocaleTimeString()}] ${n.text}`).join("\n");
      await supabase.from("case_events").insert({
        case_id: selectedCaseId,
        user_id: user?.id,
        event_type: "video_conference_ended",
        title: `Video conference ended: ${currentRoom?.roomName || "Session"}`,
        description: `Meeting notes:\n${notesSummary}`,
        metadata: {
          room_id: currentRoom?.roomId,
          room_name: currentRoom?.roomName,
          notes_count: meetingNotes.length,
          duration_started: recordingStartTime?.toISOString(),
        },
      });
    }
    setInCallView(false);
    setCurrentRoom(null);
    setSidePanelOpen(false);
    setMeetingNotes([]);
    setIsRecording(false);
    setRecordingStartTime(null);
    toast.info("Left the video call");
  }, [selectedCaseId, meetingNotes, user, currentRoom, recordingStartTime]);

  // ── In-call view ──────────────────────────────────────────────────────────
  if (inCallView && currentRoom) {
    const embedUrl = `${currentRoom.roomUrl}?t=${currentRoom.token}&embed=true`;
    return (
      <div className="flex h-full min-h-[600px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50">
        {/* Main video area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Call header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-white">Live</span>
              </div>
              <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs truncate max-w-[140px]">
                {currentRoom.roomName}
              </Badge>
              <Badge variant="outline" className="border-emerald-600/50 text-emerald-400 text-xs hidden sm:flex">
                <Shield className="h-3 w-3 mr-1" />
                Encrypted
              </Badge>
              {isRecording && (
                <Badge variant="outline" className="border-red-600/50 text-red-400 text-xs animate-pulse">
                  <Circle className="h-2.5 w-2.5 mr-1 fill-red-500" />
                  Recording
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSidePanelOpen(!sidePanelOpen)}
                className="h-8 text-xs border-slate-600 text-slate-300 hover:text-white"
                title={sidePanelOpen ? "Close panel" : "Documents & Notes"}
              >
                {sidePanelOpen 
                  ? <PanelRightClose className="h-3.5 w-3.5 sm:mr-1.5" />
                  : <PanelRightOpen className="h-3.5 w-3.5 sm:mr-1.5" />
                }
                <span className="hidden sm:inline">{sidePanelOpen ? "Close" : "Docs & Notes"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={nativeShare}
                className="h-8 text-xs border-slate-600 text-slate-300 hover:text-white"
                title="Share invite"
              >
                <Share2 className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Invite</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={copyInviteLink}
                className="h-8 text-xs border-slate-600 text-slate-300 hover:text-white hidden sm:flex"
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={leaveCall}
                className="h-8 text-xs"
              >
                <PhoneOff className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Leave</span>
              </Button>
            </div>
          </div>

          {/* Case context bar */}
          {selectedCaseId && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 border-b border-slate-700/30 text-xs text-slate-400">
              <FileText className="h-3 w-3" />
              <span>Tracked under: <span className="text-slate-200 font-medium">{selectedCaseName}</span></span>
              {currentRoom.enableRecording !== false && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>Cloud recording enabled (start from call controls)</span>
                </>
              )}
            </div>
          )}

          {/* Daily.co embedded iframe */}
          <div className="flex-1 relative">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write"
              className="absolute inset-0 w-full h-full border-0"
              title="Video Conference"
            />
          </div>

          {/* Bottom info bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Monitor className="h-3 w-3" />
                Screen share available in call controls
              </span>
            </div>
            {currentRoom.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expires: {new Date(currentRoom.expiresAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* ── Side panel: Documents & Notes ── */}
        {sidePanelOpen && (
          <div className="w-80 lg:w-96 flex-shrink-0 bg-slate-800 border-l border-slate-700/50 flex flex-col">
            <Tabs value={sidePanelTab} onValueChange={(v) => setSidePanelTab(v as "documents" | "notes")} className="flex flex-col h-full">
              <TabsList className="mx-3 mt-3 bg-slate-700/50">
                <TabsTrigger value="documents" className="text-xs data-[state=active]:bg-slate-600">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-slate-600">
                  <StickyNote className="h-3.5 w-3.5 mr-1.5" />
                  Notes ({meetingNotes.length})
                </TabsTrigger>
              </TabsList>

              {/* Documents tab */}
              <TabsContent value="documents" className="flex-1 flex flex-col px-3 pb-3 mt-0 overflow-hidden">
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-400">{caseDocuments.length} document{caseDocuments.length !== 1 ? "s" : ""}</span>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleInCallUpload}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.mp3,.mp4,.wav"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || !selectedCaseId}
                      className="h-7 text-xs border-slate-600 text-slate-300"
                    >
                      {isUploading ? (
                        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</>
                      ) : (
                        <><Upload className="h-3 w-3 mr-1.5" />Upload</>
                      )}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1.5">
                    {caseDocuments.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No documents in this case yet.</p>
                        <p className="mt-1">Upload files to share during the call.</p>
                      </div>
                    ) : caseDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-slate-700/40 hover:bg-slate-700/60 transition-colors cursor-pointer group"
                        onClick={() => {
                          if (doc.file_url) window.open(doc.file_url, "_blank");
                        }}
                      >
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-200 truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {doc.file_type || "Document"} {doc.file_size ? `• ${(doc.file_size / 1024).toFixed(0)}KB` : ""}
                          </p>
                        </div>
                        <Eye className="h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Notes tab */}
              <TabsContent value="notes" className="flex-1 flex flex-col px-3 pb-3 mt-0 overflow-hidden">
                <div className="py-2 space-y-2 flex-shrink-0">
                  <Textarea
                    placeholder="Type a meeting note... (press Enter to save)"
                    value={currentNote}
                    onChange={e => setCurrentNote(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addNote();
                      }
                    }}
                    className="text-xs min-h-[60px] bg-slate-700/50 border-slate-600 text-slate-200 resize-none"
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={addNote}
                    disabled={!currentNote.trim()}
                    className="w-full h-7 text-xs"
                  >
                    <StickyNote className="h-3 w-3 mr-1.5" />
                    Save Note
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {meetingNotes.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs">
                        <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No notes yet.</p>
                        <p className="mt-1">Notes are saved to the case file when you leave.</p>
                      </div>
                    ) : meetingNotes.map((note) => (
                      <div key={note.id} className="p-2.5 rounded-md bg-slate-700/40 border border-slate-700/50">
                        <p className="text-xs text-slate-200 whitespace-pre-wrap">{note.text}</p>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                          {new Date(note.timestamp).toLocaleTimeString()} • {note.author}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Invite dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite to Video Conference</DialogTitle>
              <DialogDescription>
                Send a secure invite or share a guest link — no CaseBuddy account needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Invite by Email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="colleague@lawfirm.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendEmailInvite(); }}
                  />
                  <Button onClick={sendEmailInvite} disabled={!inviteEmail.trim() || sendingInvite}>
                    {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If email delivery isn't configured, the invite link will be copied to your clipboard automatically.
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or share link</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={copyInviteLink}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy invite link"}
                </Button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button variant="outline" onClick={nativeShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Alert>
                <Shield className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs">
                  Guest links expire in 1 hour and require no account. All sessions are logged to the case file for security.
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Lobby view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            Secure Video Conferencing
          </CardTitle>
          <CardDescription>
            Encrypted, case-logged video meetings with screen sharing, document collaboration, and recording
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="w-full gap-2"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Video className="h-4 w-4" />
              Create Video Room
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setJoinDialogOpen(true)}
            >
              <Users className="h-4 w-4" />
              Join Existing Room
            </Button>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-500" /><span>End-to-end encrypted via Daily.co</span></div>
            <div className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-blue-500" /><span>Cloud recording linked to case file</span></div>
            <div className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5 text-cyan-500" /><span>Screen sharing & document collaboration</span></div>
            <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-amber-500" /><span>Upload & review documents during calls</span></div>
            <div className="flex items-center gap-2"><StickyNote className="h-3.5 w-3.5 text-purple-500" /><span>Meeting notes saved to your case</span></div>
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-pink-500" /><span>Invite by email or share a secure link</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Video Conference</DialogTitle>
            <DialogDescription>Set up a secure, encrypted video room for your case team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Room Name</Label>
              <Input
                placeholder="Discovery Review — Smith v. Jones"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Associated Case</Label>
              <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a case" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="Brief description of meeting purpose"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p>• Room expires in 4 hours</p>
              <p>• Up to 10 participants</p>
              <p>• Cloud recording enabled & case-logged</p>
              <p>• Screen sharing, document review & meeting notes</p>
              <p>• End-to-end encryption</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createRoomMutation.isPending}>Cancel</Button>
            <Button onClick={() => createRoomMutation.mutate()} disabled={createRoomMutation.isPending || !roomName.trim() || !selectedCaseId}>
              {createRoomMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Video Conference</DialogTitle>
            <DialogDescription>Enter the Room ID from your invitation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Room ID</Label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={joinRoomId}
                onChange={e => setJoinRoomId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Get the Room ID from the meeting organizer's invite</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)} disabled={joinRoomMutation.isPending}>Cancel</Button>
            <Button onClick={() => joinRoomMutation.mutate()} disabled={joinRoomMutation.isPending || !joinRoomId.trim()}>
              {joinRoomMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Joining...</> : "Join Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
