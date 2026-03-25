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
    // Initial fetch
    fetchStatus();

    // Subscribe to changes
    const channel = supabase
      .channel('processing-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_queue',
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId]);

  async function fetchStatus() {
    const { data } = await (supabase as any)
      .from('processing_queue')
      .select('status')
      .eq('case_id', caseId);

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
  }

  if (!isVisible && status.failed === 0) return null;

  const total = status.pending + status.processing + status.completed + status.failed;
  const progress = total > 0 ? ((status.completed + status.failed) / total) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          {status.processing > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          Processing Documents
        </h4>
        <Badge variant="outline" className="text-xs">
          {Math.round(progress)}%
        </Badge>
      </div>
      
      <Progress value={progress} className="h-2 mb-3" />
      
      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
        <div className="flex flex-col items-center">
          <span className="font-bold text-foreground">{status.processing}</span>
          <span>Active</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-bold text-foreground">{status.pending}</span>
          <span>Queue</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-bold text-green-600">{status.completed}</span>
          <span>Done</span>
        </div>
        {status.failed > 0 && (
          <div className="flex flex-col items-center">
            <span className="font-bold text-destructive">{status.failed}</span>
            <span>Failed</span>
          </div>
        )}
      </div>
    </div>
  );
}
