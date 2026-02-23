import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Clock,
  MessageSquare,
  Trophy,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserAnalytics, TrialSessionAnalytics, getTrialSessions, TrialSimulationSession } from "@/lib/trial-session-api";
import { useAuth } from "@/hooks/useAuth";

interface PerformanceDashboardProps {
  caseId?: string;
  onViewSession?: (sessionId: string) => void;
}

interface PerformanceData {
  totalSessions: number;
  totalQuestions: number;
  avgCredibilityScore: number;
  topStrengths: string[];
  topImprovementAreas: string[];
  recentSessions: TrialSessionAnalytics[];
  sessions: TrialSimulationSession[];
}

const MODE_LABELS: Record<string, string> = {
  'cross-examination': 'Cross Examination',
  'direct-examination': 'Direct Examination',
  'opening-statement': 'Opening Statement',
  'closing-argument': 'Closing Argument',
  'deposition': 'Deposition',
  'motion-hearing': 'Motion Hearing',
  'objections-practice': 'Objections Practice',
  'voir-dire': 'Voir Dire',
  'evidence-foundation': 'Evidence Foundation',
  'deposition-prep': 'Deposition Prep',
};

export function PerformanceDashboard({ caseId, onViewSession }: PerformanceDashboardProps) {
  const { user } = useAuth();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [analytics, sessions] = await Promise.all([
          getUserAnalytics(user.id),
          getTrialSessions(caseId),
        ]);

        setData({
          ...analytics,
          sessions,
        });
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No performance data available</p>
          <p className="text-sm mt-2">Complete some trial simulation sessions to see your analytics</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-blue-600';
    if (score >= 4) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 8) return 'from-green-500 to-green-600';
    if (score >= 6) return 'from-blue-500 to-blue-600';
    if (score >= 4) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{data.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{data.totalQuestions}</p>
                <p className="text-sm text-muted-foreground">Questions Asked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Target className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className={cn("text-3xl font-bold", getScoreColor(data.avgCredibilityScore))}>
                  {data.avgCredibilityScore.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">Avg Credibility</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {data.recentSessions.length > 0
                    ? Math.round(data.recentSessions.reduce((sum, s) => sum + s.total_questions, 0) / data.recentSessions.length)
                    : 0}
                </p>
                <p className="text-sm text-muted-foreground">Avg Qs/Session</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topStrengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">Complete more sessions to identify your strengths</p>
            ) : (
              <ul className="space-y-2">
                {data.topStrengths.map((strength, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topImprovementAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keep practicing to identify improvement areas</p>
            ) : (
              <ul className="space-y-2">
                {data.topImprovementAreas.map((area, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Recent Sessions
          </CardTitle>
          <CardDescription>
            Your last {Math.min(data.sessions.length, 10)} trial simulation sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No sessions yet</p>
              <p className="text-sm mt-1">Start practicing to track your performance</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {data.sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                      "bg-gradient-to-r from-transparent to-transparent"
                    )}
                    onClick={() => onViewSession?.(session.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br",
                        session.performance_metrics?.credibilityScore
                          ? getScoreGradient(session.performance_metrics.credibilityScore)
                          : "from-slate-400 to-slate-500"
                      )}>
                        {session.performance_metrics?.credibilityScore || '-'}
                      </div>
                      <div>
                        <p className="font-medium">{MODE_LABELS[session.mode] || session.mode}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.transcript.length} messages • {new Date(session.started_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {session.performance_metrics && (
                        <div className="hidden sm:flex gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-medium">{session.performance_metrics.totalQuestions}</p>
                            <p className="text-xs text-muted-foreground">Questions</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-green-600">{session.performance_metrics.successfulObjections}</p>
                            <p className="text-xs text-muted-foreground">Objections</p>
                          </div>
                        </div>
                      )}
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {session.scenario || session.mode}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {data.recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              Personalized Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.topImprovementAreas.includes('Improve objection timing and recognition') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="font-medium text-sm text-amber-800">Practice Objections</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Try the Objections Practice mode to sharpen your timing and recognition skills
                  </p>
                </div>
              )}
              {data.topImprovementAreas.includes('Balance leading and open-ended questions') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-sm text-blue-800">Question Variety</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Practice Direct Examination to improve your open-ended questioning technique
                  </p>
                </div>
              )}
              {data.avgCredibilityScore < 6 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="font-medium text-sm text-purple-800">Build Witness Rapport</p>
                  <p className="text-xs text-purple-600 mt-1">
                    Focus on building trust with witnesses before challenging their testimony
                  </p>
                </div>
              )}
              {data.totalSessions < 5 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-sm text-green-800">Keep Practicing</p>
                  <p className="text-xs text-green-600 mt-1">
                    Complete at least 5 sessions to unlock detailed performance insights
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
