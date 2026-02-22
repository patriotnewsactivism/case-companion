import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PresentUser {
  id: string;
  name: string;
  avatarUrl: string;
  currentSection: string;
  lastActive: Date;
}

interface PresenceState {
  user_id: string;
  user_name: string;
  avatar_url: string;
  current_section: string;
  last_active: string;
}

export interface UsePresenceReturn {
  joinCase: (caseId: string, section: string) => void;
  leaveCase: () => void;
  updateCursor: (x: number, y: number) => void;
  updateSection: (section: string) => void;
  presentUsers: PresentUser[];
}

export function usePresence(): UsePresenceReturn {
  const { user } = useAuth();
  const [presentUsers, setPresentUsers] = useState<PresentUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentCaseIdRef = useRef<string | null>(null);
  const cursorRef = useRef({ x: 0, y: 0 });

  const mapPresenceStateToPresentUsers = (state: Record<string, PresenceState[]>): PresentUser[] => {
    const users: PresentUser[] = [];
    for (const [userId, states] of Object.entries(state)) {
      if (states.length > 0) {
        const s = states[0];
        users.push({
          id: userId,
          name: s.user_name,
          avatarUrl: s.avatar_url,
          currentSection: s.current_section,
          lastActive: new Date(s.last_active),
        });
      }
    }
    return users;
  };

  const joinCase = useCallback((caseId: string, section: string) => {
    if (!user || !caseId) return;

    if (channelRef.current) {
      channelRef.current.untrack();
      channelRef.current.unsubscribe();
    }

    currentCaseIdRef.current = caseId;

    const channel = supabase.channel(`presence:case:${caseId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        setPresentUsers(mapPresenceStateToPresentUsers(state as Record<string, PresenceState[]>));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const newUsers = newPresences.map((p: PresenceState) => ({
          id: p.user_id,
          name: p.user_name,
          avatarUrl: p.avatar_url,
          currentSection: p.current_section,
          lastActive: new Date(p.last_active),
        }));
        setPresentUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u.id));
          const filtered = newUsers.filter((u) => !existingIds.has(u.id));
          return [...prev, ...filtered];
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftIds = new Set(leftPresences.map((p: PresenceState) => p.user_id));
        setPresentUsers((prev) => prev.filter((u) => !leftIds.has(u.id)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            user_name: user.user_metadata?.full_name || user.email || 'Unknown',
            avatar_url: user.user_metadata?.avatar_url || '',
            current_section: section,
            last_active: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;
  }, [user]);

  const leaveCase = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.untrack();
      channelRef.current.unsubscribe();
      channelRef.current = null;
      currentCaseIdRef.current = null;
      setPresentUsers([]);
    }
  }, []);

  const updateCursor = useCallback((x: number, y: number) => {
    cursorRef.current = { x, y };
    if (channelRef.current && user) {
      channelRef.current.track({
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email || 'Unknown',
        avatar_url: user.user_metadata?.avatar_url || '',
        current_section: currentCaseIdRef.current || '',
        last_active: new Date().toISOString(),
        cursor_x: x,
        cursor_y: y,
      });
    }
  }, [user]);

  const updateSection = useCallback((section: string) => {
    if (channelRef.current && user) {
      channelRef.current.track({
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email || 'Unknown',
        avatar_url: user.user_metadata?.avatar_url || '',
        current_section: section,
        last_active: new Date().toISOString(),
      });
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    joinCase,
    leaveCase,
    updateCursor,
    updateSection,
    presentUsers,
  };
}