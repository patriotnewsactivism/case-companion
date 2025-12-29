import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
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
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">Calendar</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Track deadlines, hearings, and important dates
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar */}
            <motion.div variants={item} className="lg:col-span-2">
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-serif">
                      {format(currentDate, "MMMM yyyy")}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentDate(new Date())}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-2">
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                          <div key={`empty-${i}`} className="aspect-square" />
                        ))}

                        {/* Days in month */}
                        {daysInMonth.map((date) => {
                          const hasEvents = hasDeadline(date);
                          const dateDeadlines = getDeadlinesForDate(date);

                          return (
                            <div
                              key={date.toString()}
                              className={cn(
                                "aspect-square rounded-lg border border-border/50 p-2 transition-colors cursor-pointer hover:bg-muted/50",
                                isToday(date) && "border-primary border-2",
                                hasEvents && "bg-accent/10"
                              )}
                            >
                              <div className="flex flex-col h-full">
                                <span
                                  className={cn(
                                    "text-sm font-medium",
                                    isToday(date) && "text-primary font-bold"
                                  )}
                                >
                                  {format(date, "d")}
                                </span>
                                {hasEvents && (
                                  <div className="mt-auto space-y-1">
                                    {dateDeadlines.slice(0, 2).map((deadline, idx) => (
                                      <div
                                        key={idx}
                                        className="text-[10px] bg-accent/20 rounded px-1 py-0.5 truncate"
                                        title={deadline.caseName}
                                      >
                                        {deadline.caseName}
                                      </div>
                                    ))}
                                    {dateDeadlines.length > 2 && (
                                      <div className="text-[10px] text-muted-foreground">
                                        +{dateDeadlines.length - 2} more
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming Events Sidebar */}
            <motion.div variants={item} className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertCircle className="h-4 w-4 text-accent" />
                    Upcoming Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deadlines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                  ) : (
                    deadlines
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .slice(0, 10)
                      .map((deadline, index) => (
                        <div key={index} className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{deadline.caseName}</span>
                          </div>
                          <p className="text-xs text-accent ml-5">
                            {format(deadline.date, "MMM d, yyyy")}
                          </p>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarIcon className="h-4 w-4 text-accent" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">This Month</span>
                    <span className="text-sm font-medium">
                      {deadlines.filter((d) => isSameMonth(d.date, currentDate)).length} events
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Cases</span>
                    <span className="text-sm font-medium">{cases.length} cases</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <span className="text-sm font-medium">
                      {cases.filter((c) => c.status === "active").length} cases
                    </span>
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
