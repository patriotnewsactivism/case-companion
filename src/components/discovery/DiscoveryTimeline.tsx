import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, CheckCircle, Calendar } from "lucide-react";
import type { DiscoveryDeadline, DiscoveryType } from "@/lib/discovery-api";
import { DISCOVERY_TYPE_LABELS } from "@/lib/discovery-api";
import { useCaseFactsStore } from "@/store/useCaseFactsStore";
import type { CaseEvent } from "@/store/useCaseFactsStore";

interface DiscoveryTimelineProps {
  deadlines: DiscoveryDeadline[];
  onDeadlineClick: (id: string) => void;
  filterType?: DiscoveryType | 'all';
  onFilterChange?: (type: DiscoveryType | 'all') => void;
  caseId?: string;
}

export function DiscoveryTimeline({ deadlines, onDeadlineClick, filterType = 'all', onFilterChange, caseId }: DiscoveryTimelineProps) {
  const filteredDeadlines = filterType === 'all' 
    ? deadlines 
    : deadlines.filter(d => d.requestType === filterType);
  
  // Get case events from Zustand store
  const caseEvents = useCaseFactsStore(state => caseId ? state.getEvents(caseId) : []);
  
  // Combine and sort all events (deadlines + case events)
  const allEvents = [
    ...filteredDeadlines.map(deadline => ({
      id: deadline.id,
      date: deadline.dueDate,
      title: deadline.requestNumber,
      description: `${DISCOVERY_TYPE_LABELS[deadline.requestType as DiscoveryType] || deadline.requestType} - ${deadline.status}`,
      type: 'deadline',
      source_doc_id: null,
      status: deadline.status,
      daysRemaining: deadline.daysRemaining
    })),
    ...caseEvents.map(event => ({
      id: crypto.randomUUID(),
      date: event.date,
      title: event.event_title,
      description: event.description,
      type: 'case_event',
      source_doc_id: event.source_doc_id,
      status: 'upcoming',
      daysRemaining: Math.ceil((new Date(event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getStatusStyles = (status: DiscoveryDeadline['status']) => {
    switch (status) {
      case 'overdue':
        return {
          dot: 'bg-red-500',
          line: 'bg-red-200',
          badge: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertCircle,
        };
      case 'due_today':
        return {
          dot: 'bg-yellow-500',
          line: 'bg-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
        };
      case 'upcoming':
        return {
          dot: 'bg-green-500',
          line: 'bg-green-200',
          badge: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Case Timeline
          </CardTitle>
          {onFilterChange && (
            <select
              value={filterType}
              onChange={(e) => onFilterChange(e.target.value as DiscoveryType | 'all')}
              className="h-8 px-2 text-sm rounded-md border border-input bg-background"
            >
              <option value="all">All Types</option>
              <option value="interrogatory">Interrogatories</option>
              <option value="request_for_production">RFP</option>
              <option value="request_for_admission">RFA</option>
              <option value="deposition">Depositions</option>
            </select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {allEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming deadlines or case events</p>
          </div>
        ) : (
          <div className="relative">
            {allEvents.map((event, index) => {
              // Determine if this is a deadline or case event
              const isDeadline = event.type === 'deadline';
              const deadline = isDeadline ? filteredDeadlines.find(d => d.id === event.id) : null;
              const styles = isDeadline ? getStatusStyles(deadline!.status) : {
                dot: 'bg-blue-500',
                line: 'bg-blue-200',
                badge: 'bg-blue-100 text-blue-800 border-blue-200',
                icon: Clock
              };
              
              const StatusIcon = styles.icon;
              
              return (
                <div
                  key={event.id}
                  className="relative pl-8 pb-6 last:pb-0 cursor-pointer group"
                  onClick={() => isDeadline ? onDeadlineClick(event.id) : {}}
                >
                  {index < allEvents.length - 1 && (
                    <div className={cn("absolute left-[11px] top-6 w-0.5 h-full", styles.line)} />
                  )}
                  
                  <div className={cn(
                    "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center",
                    styles.dot,
                    "group-hover:scale-110 transition-transform"
                  )}>
                    <StatusIcon className="h-3 w-3 text-white" />
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3 group-hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {isDeadline 
                            ? (DISCOVERY_TYPE_LABELS[deadline!.requestType as DiscoveryType] || deadline!.requestType)
                            : event.source_doc_id ? 'Document Event' : 'Case Event'
                          }
                        </p>
                      </div>
                      <Badge className={cn("text-xs", styles.badge)}>
                        {isDeadline ? (
                          deadline!.status === 'overdue' 
                            ? `${Math.abs(deadline!.daysRemaining)} days overdue`
                            : deadline!.status === 'due_today'
                            ? 'Due today'
                            : `${deadline!.daysRemaining} days`
                        ) : (
                          event.daysRemaining < 0 
                            ? `${Math.abs(event.daysRemaining)} days ago`
                            : event.daysRemaining === 0
                            ? 'Today'
                            : `${event.daysRemaining} days`
                        )}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Date: {formatDate(event.date)}</span>
                      {isDeadline && deadline!.servedDate && (
                        <span>Served: {formatDate(deadline!.servedDate)}</span>
                      )}
                    </div>
                    {event.description && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {event.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
