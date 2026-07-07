import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases, getAllTimelineEvents, getDocumentStats } from "@/lib/api";
import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Gavel,
  FileText,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const { data: timelineEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["timeline-events"],
    queryFn: getAllTimelineEvents,
  });

  const { data: documentStats, isLoading: statsLoading } = useQuery({
    queryKey: ["document-stats"],
    queryFn: getDocumentStats,
  });

  const isLoading = casesLoading || eventsLoading || statsLoading;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Combine timeline events and case deadlines
  const allEvents = [
    // Timeline events from documents
    ...timelineEvents.map((event) => ({
      date: new Date(event.event_date),
      title: event.title,
      description: event.description || '',
      type: event.event_type || 'event',
      importance: event.importance,
      caseId: event.case_id,
      isTimelineEvent: true,
    })),
    // Case deadlines
    ...cases
      .filter((c) => c.next_deadline)
      .map((c) => ({
        date: new Date(c.next_deadline!),
        title: `${c.name} Deadline`,
        description: c.notes || '',
        type: 'deadline',
        importance: 'high',
        caseId: c.id,
        isTimelineEvent: false,
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const hasEvent = (date: Date) => {
    return allEvents.some((event) => isSameDay(event.date, date));
  };

  const getEventsForDate = (date: Date) => {
    return allEvents.filter((event) => isSameDay(event.date, date));
  };

  const getEventImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const activeCases = cases.filter((c) => c.status === "active").length;
  const casesWithDeadlines = cases.filter((c) => c.next_deadline).length;
  const upcomingEvents = allEvents.filter((event) => event.date >= new Date()).length;
  const totalDocuments = documentStats?.total || 0;
  const analyzedDocuments = documentStats?.analyzed || 0;

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-8"
        >
          {/* Header */}
          <motion.div variants={item}>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold">Calendar</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track deadlines and important dates for your cases
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar */}
            <motion.div variants={item} className="lg:col-span-2">
              <Card className="glass-card">
                <CardContent className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Calendar Header */}
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">
                          {format(currentDate, "MMMM yyyy")}
                        </h2>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={goToPreviousMonth}
                            className="h-8 w-8"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToToday}
                            className="h-8"
                          >
                            Today
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={goToNextMonth}
                            className="h-8 w-8"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                          <div key={`empty-${i}`} className="aspect-square p-2" />
                        ))}

                        {/* Days in month */}
                        {daysInMonth.map((date) => {
                          const dayEvents = getEventsForDate(date);
                          const hasEvents = dayEvents.length > 0;

                          return (
                            <div
                              key={date.toString()}
                              className={cn(
                                "aspect-square rounded-lg p-2 transition-colors cursor-pointer hover:bg-muted/50",
                                "flex flex-col items-center justify-start",
                                isToday(date) && "bg-primary text-primary-foreground font-bold",
                                hasEvents && !isToday(date) && "bg-accent/10"
                              )}
                              title={dayEvents.map(e => e.title).join(', ')}
                            >
                              <span className="text-sm">
                                {format(date, "d")}
                              </span>
                              {hasEvents && (
                                <div className="mt-1 flex gap-0.5 flex-wrap justify-center">
                                  {dayEvents.slice(0, 3).map((event, idx) => (
                                    <div
                                      key={idx}
                                      className={cn(
                                        "h-1 w-1 rounded-full",
                                        getEventImportanceColor(event.importance)
                                      )}
                                    />
                                  ))}
                                  {dayEvents.length > 3 && (
                                    <span className="text-[8px] ml-0.5">+{dayEvents.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={item} className="space-y-6">
              {/* Upcoming Events */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Upcoming Events
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Next 7 events and deadlines
                  </p>
                </CardHeader>
                <CardContent>
                  {allEvents.filter(e => e.date >= new Date()).length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No upcoming events</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allEvents
                        .filter(event => event.date >= new Date())
                        .slice(0, 7)
                        .map((event, index) => (
                          <div key={index} className="space-y-1 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                            <div className="flex items-start gap-2">
                              <div className={cn("h-2 w-2 rounded-full mt-1.5", getEventImportanceColor(event.importance))} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{event.title}</p>
                                {event.description && (
                                  <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-accent">
                                    {format(event.date, "MMM d, yyyy")}
                                  </p>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground capitalize">{event.type}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gavel className="h-5 w-5 text-accent" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Cases</span>
                    <span className="text-sm font-bold">{activeCases}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Upcoming Events</span>
                    <span className="text-sm font-bold">{upcomingEvents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Documents</span>
                    <span className="text-sm font-bold">{totalDocuments}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Analyzed</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{analyzedDocuments}</span>
                      <FileText className="h-3.5 w-3.5 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
