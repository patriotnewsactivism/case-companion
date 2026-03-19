import React, { useEffect } from 'react';
import { useCaseStore } from '@/store/useCaseStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';

interface DiscoveryTimelineProps {
  caseId: string;
}

export const DiscoveryTimeline: React.FC<DiscoveryTimelineProps> = ({ caseId }) => {
  const { events, isLoading, error, fetchEvents } = useCaseStore();

  useEffect(() => {
    if (caseId) {
      fetchEvents(caseId);
    }
  }, [caseId, fetchEvents]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500 bg-red-50 text-red-900 rounded-md">
        <h4 className="font-bold">Error Loading Timeline</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 text-center text-muted-foreground">
          No factual events have been extracted for this case yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px] w-full pr-4">
      <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8">
        {events.map((event) => (
          <div key={event.id} className="relative">
            <div className="absolute -left-[35px] top-1 h-4 w-4 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold">
                    {event.event_title}
                  </CardTitle>
                  <Badge variant="outline" className="font-mono bg-slate-50">
                    {format(parseISO(event.event_date), 'MMM dd, yyyy')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed mb-4">
                  {event.description}
                </p>
                {event.extracted_entities && event.extracted_entities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {event.extracted_entities.map((entity, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};