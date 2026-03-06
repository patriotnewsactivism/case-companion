import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, compareAsc, isValid } from 'date-fns';
import { 
  Clock, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Building2, 
  MapPin,
  Calendar as CalendarIcon,
  ChevronRight,
  MessageSquare,
  Gavel,
  Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  importance: 'high' | 'medium' | 'low' | string | null;
  linked_document_id?: string | null;
  entities?: any[] | null;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

const getImportanceStyles = (importance: string | null) => {
  switch (importance?.toLowerCase()) {
    case 'high':
      return 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400';
    case 'medium':
      return 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
    case 'low':
      return 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';
    default:
      return 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400';
  }
};

const getEventIcon = (type: string | null) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('communication') || t.includes('call') || t.includes('email')) return <MessageSquare className="h-4 w-4" />;
  if (t.includes('filing') || t.includes('court') || t.includes('motion')) return <Gavel className="h-4 w-4" />;
  if (t.includes('meeting') || t.includes('conference')) return <Users className="h-4 w-4" />;
  if (t.includes('incident') || t.includes('event')) return <AlertCircle className="h-4 w-4" />;
  if (t.includes('discovery') || t.includes('document')) return <FileText className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
};


export function TimelineView({ events, onEventClick }: TimelineViewProps) {
  const displayedEvents = useMemo(() => {
    const keyEvents = events.filter((event) => {
      const importance = (event.importance || '').toLowerCase().trim();
      const eventType = (event.event_type || '').toLowerCase().trim();
      const title = (event.title || '').toLowerCase().trim();
      const description = (event.description || '').toLowerCase().trim();

      const keyTerms = [
        'hearing',
        'trial',
        'deposition',
        'motion',
        'filing',
        'complaint',
        'order',
        'judgment',
        'incident',
        'accident',
        'deadline',
        'mediation',
        'settlement',
      ];

      const hasKeyTerm = keyTerms.some((term) =>
        eventType.includes(term) || title.includes(term) || description.includes(term)
      );

      if (importance === 'high') return true;
      if (importance === 'medium') return hasKeyTerm;
      return hasKeyTerm && !!event.linked_document_id;
    });

    const deduped = keyEvents.filter((event, index, arr) => {
      const datePart = (event.event_date || '').slice(0, 10);
      const title = (event.title || '').trim().toLowerCase();
      return arr.findIndex((candidate) =>
        (candidate.event_date || '').slice(0, 10) === datePart &&
        (candidate.title || '').trim().toLowerCase() === title
      ) === index;
    });

    return deduped.sort((a, b) => {
      const aDate = parseISO(a.event_date);
      const bDate = parseISO(b.event_date);
      if (!isValid(aDate) && !isValid(bDate)) return 0;
      if (!isValid(aDate)) return 1;
      if (!isValid(bDate)) return -1;
      return compareAsc(aDate, bDate);
    });
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
        <p>No timeline events found for this case.</p>
        <p className="text-sm">Events will appear here once documents are analyzed or manually added.</p>
      </div>
    );
  }

  if (displayedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
        <p>No key events found.</p>
        <p className="text-sm">Only high-signal case milestones are shown here.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
      {displayedEvents.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
        >
          {/* Dot on the line */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-accent text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
            {getEventIcon(event.event_type)}
          </div>

          {/* Content Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEventClick?.(event)}>
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-slate-900">{event.title}</div>
              <time className="font-mono text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded whitespace-nowrap">
                {(() => {
                  const parsedDate = parseISO(event.event_date);
                  return isValid(parsedDate)
                    ? format(parsedDate, 'MMM d, yyyy')
                    : 'Unknown date';
                })()}
              </time>
            </div>
            
            <div className="flex gap-2 mb-2">
              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider py-0", getImportanceStyles(event.importance))}>
                {event.importance || 'medium'}
              </Badge>
              {event.event_type && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider py-0">
                  {event.event_type}
                </Badge>
              )}
            </div>

            <div className="text-sm text-slate-600 mb-3 line-clamp-3">
              {event.description}
            </div>

            {/* Entities & Links */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 mt-auto">
              {event.entities && Array.isArray(event.entities) && event.entities.slice(0, 3).map((entity: any, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                  {typeof entity === 'string' ? (
                    <>
                      <User className="h-3 w-3" />
                      {entity}
                    </>
                  ) : (
                    <>
                      {entity.type === 'person' && <User className="h-3 w-3" />}
                      {entity.type === 'organization' && <Building2 className="h-3 w-3" />}
                      {entity.type === 'location' && <MapPin className="h-3 w-3" />}
                      {entity.name}
                    </>
                  )}
                </div>
              ))}
              {event.entities && Array.isArray(event.entities) && event.entities.length > 3 && (
                <span className="text-[10px] text-slate-400">+{event.entities.length - 3} more</span>
              )}
              
              {event.linked_document_id && (
                <div className="ml-auto flex items-center gap-1 text-[10px] font-medium text-accent">
                  <FileText className="h-3 w-3" />
                  View Source
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
