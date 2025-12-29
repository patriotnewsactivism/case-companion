import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Gavel,
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
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get deadlines from cases
  const deadlines = cases
    .filter((c) => c.next_deadline)
    .map((c) => ({
      date: new Date(c.next_deadline!),
      caseName: c.name,
      caseId: c.id,
    }));

  const hasDeadline = (date: Date) => {
    return deadlines.some((d) => isSameDay(d.date, date));
  };

  const getDeadlinesForDate = (date: Date) => {
    return deadlines.filter((d) => isSameDay(d.date, date));
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
  const totalDocuments = 0; // Would come from documents query

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
                          const hasEvents = hasDeadline(date);
                          const dateDeadlines = getDeadlinesForDate(date);

                          return (
                            <div
                              key={date.toString()}
                              className={cn(
                                "aspect-square rounded-lg p-2 transition-colors cursor-pointer hover:bg-muted/50 text-center",
                                isToday(date) && "bg-primary text-primary-foreground font-bold",
                                hasEvents && !isToday(date) && "bg-accent/10"
                              )}
                            >
                              <span className="text-sm">
                                {format(date, "d")}
                              </span>
                              {hasEvents && (
                                <div className="mt-1 flex justify-center">
                                  <div className="h-1 w-1 rounded-full bg-amber-500" />
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
              {/* Upcoming Deadlines */}
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Upcoming Deadlines
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Next 5 deadlines across all cases
                  </p>
                </CardHeader>
                <CardContent>
                  {deadlines.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deadlines
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .slice(0, 5)
                        .map((deadline, index) => (
                          <div key={index} className="space-y-1 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                            <p className="text-sm font-medium truncate">{deadline.caseName}</p>
                            <p className="text-xs text-accent">
                              {format(deadline.date, "MMM d, yyyy")}
                            </p>
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
                    <span className="text-sm text-muted-foreground">Cases with Deadlines</span>
                    <span className="text-sm font-bold">{casesWithDeadlines}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Documents</span>
                    <span className="text-sm font-bold">{totalDocuments}</span>
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
