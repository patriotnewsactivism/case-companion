import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FolderOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface ImportJob {
  id: string;
  source_folder_name: string;
  source_folder_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_files: number;
  processed_files: number;
  successful_files: number;
  failed_files: number;
  error_message: string | null;
  failed_file_details: Array<{ filename: string; error: string }> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ImportJobsViewerProps {
  caseId: string;
}

export function ImportJobsViewer({ caseId }: ImportJobsViewerProps) {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const { data: importJobs, refetch, isLoading } = useQuery({
    queryKey: ['import-jobs', caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ImportJob[];
    },
    refetchInterval: (query) => {
      // Auto-refresh every 3 seconds if there are active jobs
      const hasActiveJobs = query.state.data?.some(
        (job) => job.status === 'pending' || job.status === 'processing'
      );
      return hasActiveJobs ? 3000 : false;
    },
  });

  const toggleJob = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-orange-100 text-orange-700';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Jobs</CardTitle>
          <CardDescription>Loading import jobs...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!importJobs || importJobs.length === 0) {
    return null; // Don't show anything if there are no import jobs
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Import Jobs</CardTitle>
            <CardDescription>Google Drive folder import progress</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {importJobs.map((job) => {
            const progress = job.total_files > 0
              ? (job.processed_files / job.total_files) * 100
              : 0;
            const isExpanded = expandedJobs.has(job.id);

            return (
              <Collapsible key={job.id} open={isExpanded} onOpenChange={() => toggleJob(job.id)}>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{job.source_folder_name}</span>
                        <Badge className={getStatusColor(job.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(job.status)}
                            {job.status}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{job.source_folder_path}</p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  {job.status === 'processing' && job.total_files > 0 && (
                    <div className="space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {job.processed_files} / {job.total_files} files processed
                        {job.successful_files > 0 && ` (${job.successful_files} successful)`}
                        {job.failed_files > 0 && ` (${job.failed_files} failed)`}
                      </p>
                    </div>
                  )}

                  {job.status === 'completed' && (
                    <div className="text-sm">
                      <p className="text-green-600 font-medium">
                        ✓ Completed: {job.successful_files} files imported successfully
                      </p>
                      {job.failed_files > 0 && (
                        <p className="text-orange-600">
                          ⚠ {job.failed_files} files failed
                        </p>
                      )}
                    </div>
                  )}

                  {job.status === 'failed' && job.error_message && (
                    <div className="text-sm text-red-600">
                      <p className="font-medium">Error: {job.error_message}</p>
                    </div>
                  )}

                  <CollapsibleContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Created:</span>{' '}
                        {format(new Date(job.created_at), 'MMM d, h:mm a')}
                      </div>
                      {job.started_at && (
                        <div>
                          <span className="text-muted-foreground">Started:</span>{' '}
                          {format(new Date(job.started_at), 'MMM d, h:mm a')}
                        </div>
                      )}
                      {job.completed_at && (
                        <div>
                          <span className="text-muted-foreground">Completed:</span>{' '}
                          {format(new Date(job.completed_at), 'MMM d, h:mm a')}
                        </div>
                      )}
                    </div>

                    {job.failed_file_details && job.failed_file_details.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-2">Failed Files:</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {job.failed_file_details.map((fail, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-red-50 p-2 rounded border border-red-200"
                            >
                              <p className="font-medium">{fail.filename}</p>
                              <p className="text-red-600">{fail.error}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
