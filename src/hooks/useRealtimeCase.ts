import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATUS } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RealtimeUpdate {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

export interface UseRealtimeCaseReturn {
  subscribe: (caseId: string) => void;
  unsubscribe: () => void;
  isConnected: boolean;
  lastUpdate: RealtimeUpdate | null;
  error: Error | null;
}

export function useRealtimeCase(): UseRealtimeCaseReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = useCallback((caseId: string) => {
    if (!user || !caseId) {
      setError(new Error('User must be authenticated and caseId provided'));
      return;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    setError(null);

    const channel = supabase.channel(`case-${caseId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `id=eq.${caseId}`,
        },
        (payload) => {
          setLastUpdate({
            table: 'cases',
            action: payload.eventType as RealtimeUpdate['action'],
            record: payload.new as Record<string, unknown>,
            old_record: payload.old as Record<string, unknown> | undefined,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          setLastUpdate({
            table: 'documents',
            action: payload.eventType as RealtimeUpdate['action'],
            record: payload.new as Record<string, unknown>,
            old_record: payload.old as Record<string, unknown> | undefined,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timeline_events',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          setLastUpdate({
            table: 'timeline_events',
            action: payload.eventType as RealtimeUpdate['action'],
            record: payload.new as Record<string, unknown>,
            old_record: payload.old as Record<string, unknown> | undefined,
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === REALTIME_SUBSCRIBE_STATUS.CHANNEL_ERROR) {
          setError(new Error('Failed to subscribe to realtime channel'));
        }
      });

    channelRef.current = channel;
  }, [user]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      setLastUpdate(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    subscribe,
    unsubscribe,
    isConnected,
    lastUpdate,
    error,
  };
}