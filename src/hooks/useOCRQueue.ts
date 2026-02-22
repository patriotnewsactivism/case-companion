import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  document_id: string;
  status: QueueStatus;
  priority: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface UseOCRQueueReturn {
  enqueue: (documentIds: string[], priority?: number) => Promise<void>;
  getStatus: (documentId: string) => QueueStatus | null;
  getQueueStats: () => QueueStats;
  retryFailed: (jobId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  queue: QueueItem[];
  isLoading: boolean;
  error: Error | null;
}

async function fetchQueue(): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('ocr_queue')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as QueueItem[]) || [];
}

export function useOCRQueue(): UseOCRQueueReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['ocr-queue'],
    queryFn: fetchQueue,
    enabled: !!user,
    refetchInterval: 5000,
  });

  const enqueueMutation = useMutation({
    mutationFn: async ({ documentIds, priority = 5 }: { documentIds: string[]; priority?: number }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      const items = documentIds.map((documentId) => ({
        document_id: documentId,
        status: 'pending' as QueueStatus,
        priority,
        user_id: currentUser.id,
      }));

      const { error: insertError } = await supabase
        .from('ocr_queue')
        .insert(items);

      if (insertError) throw insertError;

      const { error: fnError } = await supabase.functions.invoke('ocr-queue-processor', {
        body: { action: 'enqueue', documentIds },
      });

      if (fnError) throw fnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-queue'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error: updateError } = await supabase
        .from('ocr_queue')
        .update({ status: 'pending', error_message: null, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (updateError) throw updateError;

      const { error: fnError } = await supabase.functions.invoke('ocr-queue-processor', {
        body: { action: 'retry', jobId },
      });

      if (fnError) throw fnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-queue'] });
    },
  });

  const clearCompletedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ocr_queue')
        .delete()
        .eq('status', 'completed');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-queue'] });
    },
  });

  const enqueue = useCallback(async (documentIds: string[], priority?: number) => {
    try {
      setError(null);
      await enqueueMutation.mutateAsync({ documentIds, priority });
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to enqueue documents');
      setError(e);
      throw e;
    }
  }, [enqueueMutation]);

  const getStatus = useCallback((documentId: string): QueueStatus | null => {
    const item = queue.find((q) => q.document_id === documentId);
    return item?.status || null;
  }, [queue]);

  const getQueueStats = useCallback((): QueueStats => {
    return queue.reduce(
      (stats, item) => {
        stats[item.status] = (stats[item.status] || 0) + 1;
        return stats;
      },
      { pending: 0, processing: 0, completed: 0, failed: 0 } as QueueStats
    );
  }, [queue]);

  const retryFailed = useCallback(async (jobId: string) => {
    try {
      setError(null);
      await retryMutation.mutateAsync(jobId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to retry job');
      setError(e);
      throw e;
    }
  }, [retryMutation]);

  const clearCompleted = useCallback(async () => {
    try {
      setError(null);
      await clearCompletedMutation.mutateAsync();
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to clear completed jobs');
      setError(e);
      throw e;
    }
  }, [clearCompletedMutation]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    enqueue,
    getStatus,
    getQueueStats,
    retryFailed,
    clearCompleted,
    queue,
    isLoading,
    error,
  };
}