import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  document_id: string;
  case_id: string;
  user_id: string;
  status: QueueStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  provider: 'ocr_space' | 'gemini' | null;
  retry_after: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  updated_at: string | null;
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

async function fetchQueue(caseId: string): Promise<QueueItem[]> {
  const { data, error } = await (supabase as any)
    .from('ocr_queue')
    .select('*')
    .eq('case_id', caseId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as QueueItem[]) || [];
}

export function useOCRQueue(caseId: string): UseOCRQueueReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['ocr-queue', caseId],
    queryFn: () => fetchQueue(caseId),
    enabled: !!user && !!caseId,
    refetchInterval: 5000,
  });

  const enqueueMutation = useMutation({
    mutationFn: async ({ documentIds, priority = 5 }: { documentIds: string[]; priority?: number }) => {
      const { error: fnError } = await supabase.functions.invoke('ocr-queue-processor', {
        body: { action: 'enqueue', caseId, documentIds, priority },
      });

      if (fnError) throw fnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-queue', caseId] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error: fnError } = await supabase.functions.invoke('ocr-queue-processor', {
        body: { action: 'retry', caseId, jobId },
      });

      if (fnError) throw fnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-queue', caseId] });
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
      queryClient.invalidateQueries({ queryKey: ['ocr-queue', caseId] });
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
