import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface ProcessingStatusBarProps {
  caseId: string;
}

export function ProcessingStatusBar({ caseId }: ProcessingStatusBarProps) {
  const [status, setStatus] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    fetchStatus();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('processing-status')
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: 'processing_queue',
            filter: `case_id=eq.${caseId}`,
          },
          () => { fetchStatus(); }
        )
        .subscribe();
    } catch {
      // table may not exist yet — ignore subscription error
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [caseId]);

  async function fetchStatus() {
    try {
      const { data, error } = await (supabase as any)
        .from('processing_queue')
        .select('status')
        .eq('case_id', caseId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      // Silently ignore table-does-not-exist errors
      if (error) {
        setIsVisible(false);
        return;
      }

      if (data && data.length > 0) {
        const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
        (data as any[]).forEach((item: any) => {
          if (item.status === 'pending' || item.status === 'retrying') counts.pending++;
          else if (item.status === 'processing') counts.processing++;
          else if (item.status === 'completed') counts.completed++;
          else if (item.status === 'failed') counts.failed++;
        });
        setStatus(counts);
        setIsVisible(counts.pending > 0 || counts.processing > 0);
      } else {
        setIsVisible(false);
      }
    } catch {
      // Any unexpected error — hide the bar, don't crash
      setIsVisible(false);
    }
  }

  if (!isVisible) return null;

  const total = status.pending + status.processing + status.completed + status.failed;
  const progress = total > 0 ? Math.round((status.completed / total) * 100) : 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-blue-800">Processing Documents</span>
        <div className="flex gap-1">
          {status.pending > 0 && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {status.pending} pending
            </Badge>
          )}
          {status.processing > 0 && (
            <Badge variant="outline" className="text-xs text-blue-600">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {status.processing} processing
            </Badge>
          )}
          {status.completed > 0 && (
            <Badge variant="outline" className="text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {status.completed} done
            </Badge>
          )}
          {status.failed > 0 && (
            <Badge variant="outline" className="text-xs text-red-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              {status.failed} failed
            </Badge>
          )}
        </div>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}
