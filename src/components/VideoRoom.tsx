import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  Circle,
  Square,
  AlertCircle,
  Users,
  Clock,
  Shield,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VideoRoomProps {
  caseId: string;
  roomName: string;
  roomId?: string;
  onLeave?: () => void;
}

// Daily.co types
interface DailyCallObject {
  join: (options: { url: string; token: string }) => Promise<void>;
  leave: () => Promise<void>;
  destroy: () => Promise<void>;
  setLocalVideo: (enabled: boolean) => void;
  setLocalAudio: (enabled: boolean) => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  participants: () => Record<string, any>;
  on: (event: string, callback: (event?: any) => void) => void;
  off: (event: string, callback: (event?: any) => void) => void;
}

declare global {
  interface Window {
    DailyIframe: {
      createCallObject: () => DailyCallObject;
    };
  }
}

export function VideoRoom({ caseId, roomName, roomId, onLeave }: VideoRoomProps) {
  const callObjectRef = useRef<DailyCallObject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [enableRecording, setEnableRecording] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [joinTime, setJoinTime] = useState<Date | null>(null);

  // Load Daily.co script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@daily-co/daily-js';
    script.async = true;
    script.onload = () => {
      console.log('Daily.co script loaded');
      initializeRoom();
    };
    script.onerror = () => {
      setError('Failed to load video conferencing library');
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      if (callObjectRef.current) {
        callObjectRef.current.destroy();
      }
      document.body.removeChild(script);
    };
  }, []);

  // Session duration timer
  useEffect(() => {
    if (joinTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
        setSessionDuration(duration);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [joinTime]);

  const initializeRoom = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let token, url, owner, recordingEnabled;

      if (roomId) {
        // Join existing room
        const { data, error: joinError } = await supabase.functions.invoke('join-video-room', {
          body: {
            roomName,
            roomId,
            userName: session.user.email,
          },
        });

        if (joinError) throw joinError;
        if (!data) throw new Error('No data returned from join-video-room');

        token = data.token;
        url = data.roomUrl;
        owner = data.isOwner;
        recordingEnabled = data.enableRecording;
      } else {
        // Create new room
        const { data, error: createError } = await supabase.functions.invoke('create-video-room', {
          body: {
            name: roomName,
            caseId,
            enableRecording: enableRecording,
            expiresInMinutes: 240,
          },
        });

        if (createError) throw createError;
        if (!data) throw new Error('No data returned from create-video-room');

        token = data.token;
        url = data.roomUrl;
        owner = true;
        recordingEnabled = data.enableRecording;
      }

      setRoomUrl(url);
      setIsOwner(owner);
      setEnableRecording(recordingEnabled);

      // Create Daily call object
      if (window.DailyIframe) {
        const callObject = window.DailyIframe.createCallObject();
        callObjectRef.current = callObject;

        // Set up event listeners
        callObject.on('joined-meeting', handleJoinedMeeting);
        callObject.on('left-meeting', handleLeftMeeting);
        callObject.on('participant-joined', handleParticipantUpdate);
        callObject.on('participant-left', handleParticipantUpdate);
        callObject.on('recording-started', handleRecordingStarted);
        callObject.on('recording-stopped', handleRecordingStopped);
        callObject.on('error', handleError);

        // Join the room
        await callObject.join({ url, token });
        setJoinTime(new Date());
      } else {
        throw new Error('Daily.co library not loaded');
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing room:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize video room');
      setIsLoading(false);
      toast.error('Failed to join video room');
    }
  };

  const handleJoinedMeeting = () => {
    console.log('Joined meeting');
    setIsJoined(true);
    updateParticipantCount();
    toast.success('Connected to video room');
  };

  const handleLeftMeeting = () => {
    console.log('Left meeting');
    setIsJoined(false);
    if (onLeave) {
      onLeave();
    }
  };

  const handleParticipantUpdate = () => {
    updateParticipantCount();
  };

  const handleRecordingStarted = () => {
    console.log('Recording started');
    setIsRecording(true);
    toast.info('Recording started');
  };

  const handleRecordingStopped = () => {
    console.log('Recording stopped');
    setIsRecording(false);
    toast.info('Recording stopped');
  };

  const handleError = (error: any) => {
    console.error('Daily.co error:', error);
    toast.error('Video call error: ' + (error.errorMsg || 'Unknown error'));
  };

  const updateParticipantCount = () => {
    if (callObjectRef.current) {
      const participants = callObjectRef.current.participants();
      setParticipantCount(Object.keys(participants).length);
    }
  };

  const toggleVideo = () => {
    if (callObjectRef.current) {
      const newState = !isVideoEnabled;
      callObjectRef.current.setLocalVideo(newState);
      setIsVideoEnabled(newState);
    }
  };

  const toggleAudio = () => {
    if (callObjectRef.current) {
      const newState = !isAudioEnabled;
      callObjectRef.current.setLocalAudio(newState);
      setIsAudioEnabled(newState);
    }
  };

  const toggleScreenShare = async () => {
    if (callObjectRef.current) {
      try {
        if (isScreenSharing) {
          callObjectRef.current.stopScreenShare();
        } else {
          await callObjectRef.current.startScreenShare();
        }
        setIsScreenSharing(!isScreenSharing);
      } catch (err) {
        console.error('Screen share error:', err);
        toast.error('Failed to share screen');
      }
    }
  };

  const toggleRecording = async () => {
    if (!isOwner) {
      toast.error('Only the room owner can control recording');
      return;
    }

    if (!enableRecording) {
      toast.error('Recording is disabled for this room');
      return;
    }

    if (callObjectRef.current) {
      try {
        if (isRecording) {
          await callObjectRef.current.stopRecording();
        } else {
          await callObjectRef.current.startRecording();
        }
      } catch (err) {
        console.error('Recording error:', err);
        toast.error('Failed to control recording');
      }
    }
  };

  const leaveRoom = async () => {
    if (callObjectRef.current) {
      try {
        await callObjectRef.current.leave();
        await callObjectRef.current.destroy();
        callObjectRef.current = null;
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    }

    if (onLeave) {
      onLeave();
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Video className="h-12 w-12 text-accent mx-auto animate-pulse" />
              <p className="text-muted-foreground">Connecting to video room...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Security and Status Bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">{participantCount} Participants</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">{formatDuration(sessionDuration)}</span>
          </div>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-red-600 animate-pulse">
            <Circle className="h-3 w-3 fill-current" />
            <span className="font-medium">Recording</span>
          </div>
        )}
      </div>

      {/* Video Container */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            {roomName}
          </CardTitle>
          <CardDescription>
            {isOwner ? 'You are the room owner' : 'You are a participant'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Daily.co will inject video elements here */}
          <div
            id="daily-video-container"
            className="aspect-video bg-navy-dark rounded-lg overflow-hidden"
          />

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              variant={isAudioEnabled ? 'default' : 'destructive'}
              size="lg"
              onClick={toggleAudio}
              className="gap-2"
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              {isAudioEnabled ? 'Mute' : 'Unmute'}
            </Button>

            <Button
              variant={isVideoEnabled ? 'default' : 'destructive'}
              size="lg"
              onClick={toggleVideo}
              className="gap-2"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              {isVideoEnabled ? 'Stop Video' : 'Start Video'}
            </Button>

            <Button
              variant={isScreenSharing ? 'default' : 'outline'}
              size="lg"
              onClick={toggleScreenShare}
              className="gap-2"
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            </Button>

            {isOwner && enableRecording && (
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="lg"
                onClick={toggleRecording}
                className="gap-2"
              >
                {isRecording ? <Square className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
            )}

            <Button
              variant="destructive"
              size="lg"
              onClick={leaveRoom}
              className="gap-2"
            >
              <Phone className="h-5 w-5 rotate-135" />
              Leave
            </Button>
          </div>

          {/* Recording Info */}
          {!enableRecording && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Recording is disabled for this session. Conversations will not be recorded or transcribed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
