import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, Loader2, ExternalLink, Users } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createVideoRoom, getCases, joinVideoRoom } from "@/lib/api";

interface VideoRoomData {
  roomId?: string;
  roomUrl: string;
  roomName: string;
  token: string;
  expiresAt?: string;
  enableRecording?: boolean;
}

export function VideoConference() {
  const { user } = useAuth();
  const [roomName, setRoomName] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [description, setDescription] = useState("");
  const [currentRoom, setCurrentRoom] = useState<VideoRoomData | null>(null);
  const [joinRoomName, setJoinRoomName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

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
      if (!session) {
        throw new Error("Not authenticated");
      }

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

      toast.success("Video room created. Your secure video conference is ready.");

      window.open(data.roomUrl + `?t=${data.token}`, "_blank");
    },
    onError: (error: Error) => {
      console.error("Error creating video room:", error);
      toast.error(error.message);
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async () => {
      if (!joinRoomName.trim()) {
        throw new Error("Please provide the room name");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      return joinVideoRoom(joinRoomName, user?.email || "Participant");
    },
    onSuccess: (data) => {
      setJoinDialogOpen(false);

      toast.success("Joining video room...");

      window.open(data.roomUrl + `?t=${data.token}`, "_blank");
    },
    onError: (error: Error) => {
      console.error("Error joining video room:", error);
      toast.error(error.message);
    },
  });

  const isCreating = createRoomMutation.isPending;
  const isJoining = joinRoomMutation.isPending;

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            Secure Video Conferencing
          </CardTitle>
          <CardDescription>
            Create or join encrypted video meetings for case collaboration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Create Room Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2">
                  <Video className="h-4 w-4" />
                  Create Video Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Video Conference</DialogTitle>
                  <DialogDescription>
                    Set up a secure video room for your case collaboration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="room-name">Room Name</Label>
                    <Input
                      id="room-name"
                      placeholder="Team Meeting - Discovery Review"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="case-select">Associated Case</Label>
                    <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                      <SelectTrigger id="case-select">
                        <SelectValue placeholder="Select a case" />
                      </SelectTrigger>
                      <SelectContent>
                        {cases.map((caseItem) => (
                          <SelectItem key={caseItem.id} value={caseItem.id}>
                            {caseItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="Brief description of meeting purpose"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
                    <p>• Room expires in 4 hours</p>
                    <p>• Maximum 10 participants</p>
                    <p>• Cloud recording enabled</p>
                    <p>• End-to-end encryption</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => createRoomMutation.mutate()} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Room"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Join Room Dialog */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Users className="h-4 w-4" />
                  Join Existing Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join Video Conference</DialogTitle>
                  <DialogDescription>
                    Enter the room name to join an existing video conference
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-room-name">Room Name</Label>
                    <Input
                      id="join-room-name"
                      placeholder="casebuddy-xxx-yyyy"
                      value={joinRoomName}
                      onChange={(e) => setJoinRoomName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Get the room name from the meeting organizer
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setJoinDialogOpen(false)}
                    disabled={isJoining}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => joinRoomMutation.mutate()} disabled={isJoining}>
                    {isJoining ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join Room"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {currentRoom && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Current Room</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(currentRoom.roomUrl + `?t=${currentRoom.token}`, "_blank")}
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Rejoin
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Room Name: {currentRoom.roomName}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(currentRoom.expiresAt).toLocaleString()}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-accent/10 p-3 text-sm">
            <p className="font-medium mb-2">Video Conferencing Features:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Secure, encrypted video calls</li>
              <li>✓ Screen sharing for document review</li>
              <li>✓ Cloud recording capability</li>
              <li>✓ Built-in chat functionality</li>
              <li>✓ Up to 10 participants per room</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
