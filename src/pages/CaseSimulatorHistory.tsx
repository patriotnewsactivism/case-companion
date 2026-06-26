import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, Clock, Play, History, AlertTriangle } from "lucide-react";

interface TrialSessionRow {
  id: string;
  case_id: string;
  user_id: string;
  mode: string;
  scenario: string | null;
  started_at: string | null;
  ended_at: string | null;
  performance_metrics: Record<string, unknown> | null;
}

export default function CaseSimulatorHistory() {
  const { id } = useParams<{ id: string }>();

  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["trial_simulation_sessions", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("trial_simulation_sessions")
        .select("id, case_id, user_id, mode, scenario, started_at, ended_at, performance_metrics")
        .eq("case_id", id!)
        .order("started_at", { ascending: false });

      if (queryError) throw queryError;
      return (data ?? []) as TrialSessionRow[];
    },
    enabled: !!id,
  });

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return "Not started";
    if (!end) return "In progress";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return "Under 1 min";
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return "Under 1 min";
    return `${minutes} min`;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/cases/${id}/simulator`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Simulator History</p>
            <h1 className="text-xl font-bold">Past Sessions</h1>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {error && !isLoading && (
          <Card className="border-destructive/40">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm">Could not load simulator history</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {!isLoading && sessions.length === 0 && !error && (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <History className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="font-medium">No simulator sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Run your first simulation to start building a history.
              </p>
              <div className="pt-2">
                <Button asChild>
                  <Link to={`/cases/${id}/simulator`}>
                    <Play className="h-4 w-4 mr-1" />
                    Launch Simulator
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {sessions.map((session) => (
          <Card key={session.id} className="border-border">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {session.scenario || "Custom Scenario"}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {session.started_at
                    ? `Started ${formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}`
                    : "Not started"}
                  {session.started_at && (
                    <span className="text-border">•</span>
                  )}
                  {session.started_at && (
                    <span>
                      {format(new Date(session.started_at), "MMM d, yyyy h:mm a")}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                {session.mode.replace(/-/g, " ")}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Duration: {formatDuration(session.started_at, session.ended_at)}</span>
              <span className="text-border">•</span>
              <span>
                Status: {session.ended_at ? "Completed" : "In progress"}
              </span>
              {session.performance_metrics && (
                <>
                  <span className="text-border">•</span>
                  <span>
                    Scores recorded
                  </span>
                </>
              )}
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link to={`/cases/${id}/simulator`}>
                  <Play className="h-4 w-4 mr-1" />
                  Resume Practice
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
