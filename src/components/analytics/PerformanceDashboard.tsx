import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getPerformanceSummary,
  getPhaseStats,
  getFillerWordStats,
  getRecentSessions,
  fillerWordTips,
} from "@/lib/analytics-api";
import { ScoreChart } from "./ScoreChart";
import { PhaseBreakdown } from "./PhaseBreakdown";
import { FillerWordAnalysis } from "./FillerWordAnalysis";
import { StrengthsWeaknesses } from "./StrengthsWeaknesses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  BarChart2,
  Play,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  description?: string;
  loading?: boolean;
}

function StatCard({ title, value, icon, trend, description, loading }: StatCardProps) {
  return (
    <Card className="glass-card overflow-hidden">
      <div className="flex">
        <div className="w-1.5 bg-primary/50" />
        <CardContent className="p-4 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <p className="text-2xl font-serif font-bold mt-1">{value}</p>
          )}
          {(trend !== undefined || description) && !loading && (
            <div className="flex items-center gap-1.5 mt-2 text-sm">
              {trend !== undefined && (
                <>
                  {trend >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className={cn(trend >= 0 ? "text-green-600" : "text-red-600")}>
                    {trend >= 0 ? "+" : ""}
                    {trend.toFixed(1)}%
                  </span>
                </>
              )}
              {description && (
                <span className="text-muted-foreground">{description}</span>
              )}
            </div>
          )}
        </CardContent>
        <div className="flex items-center pr-4 text-muted-foreground">{icon}</div>
      </div>
    </Card>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

const phaseLabels: Record<string, string> = {
  opening: "Opening Statement",
  direct: "Direct Examination",
  cross: "Cross Examination",
  closing: "Closing Argument",
  voir_dire: "Voir Dire",
  jury_selection: "Jury Selection",
  motion_practice: "Motion Practice",
};

export function PerformanceDashboard() {
  const {
    data: summary,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ["performance-summary"],
    queryFn: getPerformanceSummary,
  });

  const { data: phaseStats, isLoading: phaseLoading } = useQuery({
    queryKey: ["phase-stats"],
    queryFn: getPhaseStats,
  });

  const { data: fillerStats, isLoading: fillerLoading } = useQuery({
    queryKey: ["filler-word-stats"],
    queryFn: getFillerWordStats,
  });

  const { data: recentSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["recent-sessions"],
    queryFn: () => getRecentSessions(5),
  });

  const isLoading = summaryLoading || phaseLoading || fillerLoading || sessionsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold text-primary">
            Performance Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your progress and identify areas for improvement
          </p>
        </div>
        <Link to="/trial-prep">
          <Button className="gap-2">
            <Play className="h-4 w-4" />
            Start Practice
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sessions"
          value={summary?.totalSessions ?? 0}
          icon={<BarChart2 className="h-5 w-5" />}
          description="practice sessions"
          loading={isLoading}
        />
        <StatCard
          title="Average Score"
          value={summary?.averageScore?.toFixed(1) ?? "0.0"}
          icon={<Target className="h-5 w-5" />}
          trend={summary?.improvementRate}
          loading={isLoading}
        />
        <StatCard
          title="Total Time"
          value={formatDuration(summary?.totalDurationMinutes ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          description="practice time"
          loading={isLoading}
        />
        <StatCard
          title="Improvement"
          value={`${summary?.improvementRate >= 0 ? "+" : ""}${summary?.improvementRate?.toFixed(1) ?? "0.0"}%`}
          icon={summary?.improvementRate && summary.improvementRate >= 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
          description="vs. previous period"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreChart
          data={summary?.recentTrend ?? []}
          averageScore={summary?.averageScore}
          title="Score Trend (Last 14 Days)"
        />
        <PhaseBreakdown data={phaseStats ?? []} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FillerWordAnalysis data={fillerStats ?? []} tips={fillerWordTips} />
        <StrengthsWeaknesses
          strengths={summary?.strengths ?? []}
          weaknesses={summary?.weaknesses ?? []}
        />
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium">Recent Sessions</CardTitle>
          <Link to="/sessions">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentSessions && recentSessions.length > 0 ? (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/sessions/${session.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Play className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {phaseLabels[session.phase] || session.phase}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(session.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          session.score >= 80
                            ? "bg-green-100 text-green-700"
                            : session.score >= 60
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {session.score.toFixed(1)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.floor(session.duration_seconds / 60)}m
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No sessions yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Complete practice sessions to see your analytics
              </p>
              <Link to="/trial-prep">
                <Button>
                  <Play className="h-4 w-4 mr-2" />
                  Start Practice
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
