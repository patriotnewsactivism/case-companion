import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

type DailyParticipantMap = Record<string, Record<string, unknown>>;
type DailyEventPayload = Record<string, unknown>;
type DailyErrorEvent = DailyEventPayload & { errorMsg?: string };

interface DailyCallFrame {
  join: (options: { url: string; token: string }) => Promise<void>;
  leave: () => Promise<void>;
  destroy: () => Promise<void>;
  setLocalVideo: (enabled: boolean) => void;
  setLocalAudio: (enabled: boolean) => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  participants: () => DailyParticipantMap;
  on: (event: string, callback: (event?: DailyEventPayload) => void) => void;
  off: (event: string, callback: (event?: DailyEventPayload) => void) => void;
}

declare global {
  interface Window {
    DailyIframe?: {
      createFrame: (
        container: HTMLElement,
        options?: Record<string, unknown>
      ) => DailyCallFrame;
    };
  }
}

export function VideoRoom({ caseId, roomName, roomId, onLeave }: VideoRoomProps) {
  const callFrameRef = useRef<DailyCallFrame | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const leavingRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [enableRecording, setEnableRecording] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [joinTime, setJoinTime] = useState<Date | null>(null);

  const updateParticipantCount = useCallback(() => {
    if (!callFrameRef.current) return;
    const participants = callFrameRef.current.participants();
    setParticipantCount(Object.keys(participants).length);
  }, []);

  const notifyLeave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    onLeave?.();
  }, [onLeave]);

  const handleJoinedMeeting = useCallback(() => {
    setIsJoined(true);
    setJoinTime(new Date());
    updateParticipantCount();
    toast.success('Connected to video room');
  }, [updateParticipantCount]);

  const handleLeftMeeting = useCallback(() => {
    setIsJoined(false);
    setJoinTime(null);
    notifyLeave();
  }, [notifyLeave]);

  const handleParticipantUpdate = useCallback(() => {
    updateParticipantCount();
  }, [updateParticipantCount]);

  const handleRecordingStarted = useCallback(() => {
    setIsRecording(true);
    toast.info('Recording started');
  }, []);

  const handleRecordingStopped = useCallback(() => {
    setIsRecording(false);
    toast.info('Recording stopped');
  }, []);

  const handleError = useCallback((errorEvent?: DailyErrorEvent) => {
    const message = errorEvent?.errorMsg ?? 'Unknown error';
    console.error('Daily.co error:', errorEvent);
    toast.error(`Video call error: ${message}`);
  }, []);

  const detachEvents = useCallback(() => {
    const frame = callFrameRef.current;
    if (!frame) return;

    frame.off('joined-meeting', handleJoinedMeeting);
    frame.off('left-meeting', handleLeftMeeting);
    frame.off('participant-joined', handleParticipantUpdate);
    frame.off('participant-left', handleParticipantUpdate);
    frame.off('recording-started', handleRecordingStarted);
    frame.off('recording-stopped', handleRecordingStopped);
    frame.off('error', handleError);
  }, [
    handleJoinedMeeting,
    handleLeftMeeting,
    handleParticipantUpdate,
    handleRecordingStarted,
    handleRecordingStopped,
    handleError,
  ]);

  const destroyFrame = useCallback(async () => {
    const frame = callFrameRef.current;
    if (!frame) return;
    detachEvents();
    callFrameRef.current = null;
    try {
      await frame.destroy();
    } catch (destroyError) {
      console.error('Error destroying Daily frame:', destroyError);
    }
  }, [detachEvents]);

  const initializeRoom = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      setIsLoading(true);
      setError(null);
      leavingRef.current = false;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let token = '';
      let url = '';
      let owner = false;
      let recordingEnabled = true;

      if (roomId) {
        const { data, error: joinError } = await supabase.functions.invoke('join-video-room', {
          body: {
            roomId,
            roomName,
            userName: session.user.email,
          },
        });

        if (joinError) throw joinError;
        if (!data) throw new Error('No data returned from join-video-room');

        token = data.token;
        url = data.roomUrl;
        owner = Boolean(data.isOwner);
        recordingEnabled = Boolean(data.enableRecording);
      } else {
        const { data, error: createError } = await supabase.functions.invoke('create-video-room', {
          body: {
            name: roomName,
            caseId,
            enableRecording: true,
            expiresInMinutes: 240,
          },
        });

        if (createError) throw createError;
        if (!data) throw new Error('No data returned from create-video-room');

        token = data.token;
        url = data.roomUrl;
        owner = true;
        recordingEnabled = Boolean(data.enableRecording);
      }

      const container = containerRef.current;
      if (!container) throw new Error('Video container is not ready');
      if (!window.DailyIframe?.createFrame) throw new Error('Daily.co library not loaded');

      const frame = window.DailyIframe.createFrame(container, {
        showLeaveButton: false,
        iframeStyle: {
          position: 'relative',
          width: '100%',
          height: '100%',
          border: '0',
          background: '#020617',
        },
      });
      callFrameRef.current = frame;

      frame.on('joined-meeting', handleJoinedMeeting);
      frame.on('left-meeting', handleLeftMeeting);
      frame.on('participant-joined', handleParticipantUpdate);
      frame.on('participant-left', handleParticipantUpdate);
      frame.on('recording-started', handleRecordingStarted);
      frame.on('recording-stopped', handleRecordingStopped);
      frame.on('error', handleError);

      await frame.join({ url, token });

      setIsOwner(owner);
      setEnableRecording(recordingEnabled);
      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing room:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize video room');
      setIsLoading(false);
      toast.error('Failed to join video room');
    }
  }, [
    roomId,
    roomName,
    caseId,
    handleJoinedMeeting,
    handleLeftMeeting,
    handleParticipantUpdate,
    handleRecordingStarted,
    handleRecordingStopped,
    handleError,
  ]);

  useEffect(() => {
    const existingScript = document.querySelector(
      'script[data-daily-js="true"]'
    ) as HTMLScriptElement | null;

    const loadScript = existingScript ?? document.createElement('script');
    if (!existingScript) {
      loadScript.src = 'https://unpkg.com/@daily-co/daily-js';
      loadScript.async = true;
      loadScript.dataset.dailyJs = 'true';
      document.body.appendChild(loadScript);
    }

    const onLoad = () => {
      initializeRoom();
    };
    const onError = () => {
      setError('Failed to load video conferencing library');
      setIsLoading(false);
    };

    if (window.DailyIframe?.createFrame) {
      initializeRoom();
    } else {
      loadScript.addEventListener('load', onLoad);
      loadScript.addEventListener('error', onError);
    }

    return () => {
      loadScript.removeEventListener('load', onLoad);
      loadScript.removeEventListener('error', onError);
      destroyFrame().catch((destroyError) =>
        console.error('Failed to cleanup video frame:', destroyError)
      );
    };
  }, [initializeRoom, destroyFrame]);

  useEffect(() => {
    if (!joinTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
      setSessionDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [joinTime]);

  const toggleVideo = () => {
    if (!callFrameRef.current) return;
    const newState = !isVideoEnabled;
    callFrameRef.current.setLocalVideo(newState);
    setIsVideoEnabled(newState);
  };

  const toggleAudio = () => {
    if (!callFrameRef.current) return;
    const newState = !isAudioEnabled;
    callFrameRef.current.setLocalAudio(newState);
    setIsAudioEnabled(newState);
  };

  const toggleScreenShare = async () => {
    if (!callFrameRef.current) return;
    try {
      if (isScreenSharing) {
        callFrameRef.current.stopScreenShare();
      } else {
        await callFrameRef.current.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (err) {
      console.error('Screen share error:', err);
      toast.error('Failed to share screen');
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

    if (!callFrameRef.current) return;
    try {
      if (isRecording) {
        await callFrameRef.current.stopRecording();
      } else {
        await callFrameRef.current.startRecording();
      }
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Failed to control recording');
    }
  };

  const leaveRoom = async () => {
    const frame = callFrameRef.current;
    if (!frame) {
      notifyLeave();
      return;
    }

    try {
      await frame.leave();
    } catch (err) {
      console.error('Error leaving room:', err);
    } finally {
      await destroyFrame();
      notifyLeave();
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            {roomName}
          </CardTitle>
          <CardDescription>
            {isOwner ? 'You are the room owner' : 'You are a participant'}
            {!isJoined && ' (joining...)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video min-h-[360px] bg-navy-dark rounded-lg overflow-hidden">
            <div
              ref={containerRef}
              id="daily-video-container"
              className="h-full w-full"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center space-y-2">
                  <Video className="h-10 w-10 text-accent mx-auto animate-pulse" />
                  <p className="text-sm text-slate-200">Connecting to video room...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <Button
              variant={isAudioEnabled ? 'default' : 'destructive'}
              size="lg"
              onClick={toggleAudio}
              disabled={isLoading}
              className="gap-2"
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              {isAudioEnabled ? 'Mute' : 'Unmute'}
            </Button>

            <Button
              variant={isVideoEnabled ? 'default' : 'destructive'}
              size="lg"
              onClick={toggleVideo}
              disabled={isLoading}
              className="gap-2"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              {isVideoEnabled ? 'Stop Video' : 'Start Video'}
            </Button>

            <Button
              variant={isScreenSharing ? 'default' : 'outline'}
              size="lg"
              onClick={toggleScreenShare}
              disabled={isLoading}
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
                disabled={isLoading}
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
              disabled={isLoading}
              className="gap-2"
            >
              <Phone className="h-5 w-5 rotate-135" />
              Leave
            </Button>
          </div>

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
