import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VideoRoomData {
  id: string;
  case_id: string;
  room_name: string;
  room_url: string;
  daily_room_name: string;
  title: string;
  description?: string;
  enable_recording: boolean;
  recording_url?: string;
  transcription_text?: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export function useVideoRoom() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(async (params: {
    caseId: string;
    name: string;
    description?: string;
    enableRecording?: boolean;
    maxParticipants?: number;
    expiresInMinutes?: number;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('create-video-room', {
        body: params,
      });

      if (functionError) throw functionError;
      if (!data) throw new Error('No data returned from create-video-room');

      toast.success('Video room created successfully');
      return data;
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to create video room';

      // Handle authentication errors specifically
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('invalid jwt')) {
        errorMessage = 'Authentication error. Please log out and log back in to continue.';
        toast.error(errorMessage, { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }

      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const joinRoom = useCallback(async (params: {
    roomId: string;
    userName?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('join-video-room', {
        body: params,
      });

      if (functionError) throw functionError;
      if (!data) throw new Error('No data returned from join-video-room');

      toast.success('Joining video room...');
      return data;
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to join video room';

      // Handle authentication errors specifically
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('invalid jwt')) {
        errorMessage = 'Authentication error. Please log out and log back in to continue.';
        toast.error(errorMessage, { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }

      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRoomsByCaseId = useCallback(async (caseId: string): Promise<VideoRoomData[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('video_rooms')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch video rooms';
      setError(errorMessage);
      toast.error(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getActiveRooms = useCallback(async (caseId: string): Promise<VideoRoomData[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('video_rooms')
        .select('*')
        .eq('case_id', caseId)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch active rooms';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const endRoom = useCallback(async (roomId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from('video_rooms')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (dbError) throw dbError;

      toast.success('Video room ended');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end room';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createRoom,
    joinRoom,
    getRoomsByCaseId,
    getActiveRooms,
    endRoom,
    isLoading,
    error,
  };
}
