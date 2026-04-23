import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createVideoRoom, getCases, joinVideoRoom } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VideoRoomData {
  roomId?: string;
  roomUrl: string;
  roomName: string;
  token: string;
  expiresAt?: string;
}

interface VideoConferenceProps {
  /** Pre-select a case (when opened from case detail) */
  defaultCaseId?: string;
}

export function VideoConference({ defaultCaseId }: VideoConferenceProps) {
  const { user } = useAuth();
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

  // In-call controls (for the embedded iframe)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

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

  const copyInviteLink = useCallback(async () => {
    if (!currentRoom) return;
    // Guest token valid for 1 hour — no CaseBuddy account required to join
    const expires = Date.now() + 60 * 60 * 1000;
    const guestToken = btoa(`guest:${currentRoom.roomId || currentRoom.roomName}:${expires}`);
    const inviteUrl = `${window.location.origin}/video/join?room=${currentRoom.roomId || currentRoom.roomName}&gt=${guestToken}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Guest link copied — valid for 1 hour, no account needed");
  }, [currentRoom]);

  const sendEmailInvite = useCallback(async () => {
    if (!inviteEmail.trim() || !currentRoom) return;
    const expires = Date.now() + 60 * 60 * 1000;
    const guestToken = btoa(`guest:${currentRoom.roomId || currentRoom.roomName}:${expires}`);
    const joinUrl = `${window.location.origin}/video/join?room=${currentRoom.roomId || currentRoom.roomName}&gt=${guestToken}`;
    try {
      const res = await (supabase as any).functions.invoke("send-email", {
        body: {
          to: inviteEmail.trim(),
          subject: `Video Conference Invitation: ${currentRoom.roomName}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h2 style="color:#1a1a2e">You've been invited to a secure video conference</h2>
            <p><strong>Room:</strong> ${currentRoom.roomName}</p>
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
        : `Invite logged for ${inviteEmail} — set RESEND_API_KEY to enable actual emails`
      );
    } catch (err) {
      console.error("Invite error:", err);
      toast.error("Failed to send invite");
    }
    setInviteEmail("");
    setInviteDialogOpen(false);
  }, [inviteEmail, currentRoom, selectedCaseId]);

  const leaveCall = useCallback(() => {
    setInCallView(false);
    setCurrentRoom(null);
    toast.info("Left the video call");
  }, []);

  // ── In-call view ──────────────────────────────────────────────────────────
  if (inCallView && currentRoom) {
    const embedUrl = `${currentRoom.roomUrl}?t=${currentRoom.token}&embed=true`;
    return (
      <div className="flex flex-col h-full min-h-[600px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50">
        {/* Call header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-white">Live</span>
            </div>
            <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
              {currentRoom.roomName}
            </Badge>
            <Badge variant="outline" className="border-emerald-600/50 text-emerald-400 text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Encrypted
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInviteDialogOpen(true)}
              className="h-8 text-xs border-slate-600 text-slate-300 hover:text-white"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Invite
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={copyInviteLink}
              className="h-8 text-xs border-slate-600 text-slate-300 hover:text-white"
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
              <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
              Leave
            </Button>
          </div>
        </div>

        {/* Daily.co embedded iframe */}
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            className="absolute inset-0 w-full h-full border-0"
            title="Video Conference"
          />
        </div>

        {/* Invite dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite to Video Conference</DialogTitle>
              <DialogDescription>
                Send a secure invite to another CaseBuddy user or generate a guest link.
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
                  <Button onClick={sendEmailInvite} disabled={!inviteEmail.trim()}>
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or share link</span>
                </div>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={copyInviteLink}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied to clipboard!" : "Copy invite link"}
              </Button>
              <Alert>
                <Shield className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs">
                  Guest links require no CaseBuddy account but are rate-limited. For maximum security and case logging, invite registered users by email.
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
            Encrypted, case-logged video meetings — auto-linked to your case file
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
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-purple-500" /><span>Invite by email or share a secure link</span></div>
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
