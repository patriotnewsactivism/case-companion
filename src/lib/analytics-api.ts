import { supabase } from "@/integrations/supabase/client";
import type { TrialSession } from "@/lib/session-api";

export interface PerformanceSummary {
  totalSessions: number;
  totalDurationMinutes: number;
  averageScore: number;
  improvementRate: number;
  strengths: string[];
  weaknesses: string[];
  topFillerWords: { word: string; count: number }[];
  recentTrend: { date: string; score: number }[];
}

export interface PhaseStats {
  phase: string;
  sessionCount: number;
  avgScore: number;
  avgDuration: number;
  improvement: number;
}

export interface WeeklyStats {
  week: string;
  sessions: number;
  avgScore: number;
  totalDuration: number;
}

export interface FillerWordStats {
  word: string;
  count: number;
  percentage: number;
  trend: "up" | "down" | "stable";
  previousCount: number;
}

export async function getPerformanceSummary(): Promise<PerformanceSummary> {
  const { data, error } = await supabase
    .from("trial_sessions")
    .select("score, duration_seconds, metrics, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const sessions = data || [];
  const totalSessions = sessions.length;
  const totalDurationMinutes = sessions.reduce(
    (sum, s) => sum + (s.duration_seconds || 0),
    0
  ) / 60;
  const averageScore =
    totalSessions > 0
      ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / totalSessions
      : 0;

  const recentSessions = sessions.slice(0, Math.min(5, sessions.length));
  const olderSessions = sessions.slice(5, Math.min(10, sessions.length));

  let improvementRate = 0;
  if (recentSessions.length > 0 && olderSessions.length > 0) {
    const recentAvg =
      recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
      recentSessions.length;
    const olderAvg =
      olderSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
      olderSessions.length;
    improvementRate = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  }

  const fillerWordMap = new Map<string, number>();
  sessions.forEach((s) => {
    const metrics = s.metrics as { fillerWords?: { word: string; count: number }[] } | null;
    if (metrics?.fillerWords) {
      metrics.fillerWords.forEach((fw) => {
        fillerWordMap.set(fw.word, (fillerWordMap.get(fw.word) || 0) + fw.count);
      });
    }
  });

  const topFillerWords = Array.from(fillerWordMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentTrend = sessions
    .slice(0, 14)
    .reverse()
    .map((s) => ({
      date: new Date(s.created_at).toISOString().split("T")[0],
      score: s.score || 0,
    }));

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (averageScore >= 80) {
    strengths.push("Strong overall performance");
  } else if (averageScore < 60) {
    weaknesses.push("Overall performance needs improvement");
  }

  if (topFillerWords.length === 0 || topFillerWords[0].count < 5) {
    strengths.push("Minimal filler word usage");
  } else if (topFillerWords[0].count > 20) {
    weaknesses.push("High filler word usage detected");
  }

  if (improvementRate > 10) {
    strengths.push("Consistent improvement trend");
  } else if (improvementRate < -10) {
    weaknesses.push("Performance declining recently");
  }

  if (totalSessions >= 10) {
    strengths.push("Regular practice sessions");
  } else if (totalSessions < 3) {
    weaknesses.push("Need more practice sessions");
  }

  return {
    totalSessions,
    totalDurationMinutes: Math.round(totalDurationMinutes),
    averageScore: Math.round(averageScore * 10) / 10,
    improvementRate: Math.round(improvementRate * 10) / 10,
    strengths,
    weaknesses,
    topFillerWords,
    recentTrend,
  };
}

export async function getPhaseStats(): Promise<PhaseStats[]> {
  const { data, error } = await supabase
    .from("trial_sessions")
    .select("phase, score, duration_seconds, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const sessions = data || [];
  const phaseMap = new Map<
    string,
    { scores: number[]; durations: number[]; recentScores: number[]; olderScores: number[] }
  >();

  const midpoint = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  sessions.forEach((s) => {
    const phase = s.phase || "Unknown";
    if (!phaseMap.has(phase)) {
      phaseMap.set(phase, {
        scores: [],
        durations: [],
        recentScores: [],
        olderScores: [],
      });
    }
    const phaseData = phaseMap.get(phase)!;
    phaseData.scores.push(s.score || 0);
    phaseData.durations.push(s.duration_seconds || 0);

    const sessionDate = new Date(s.created_at);
    if (sessionDate >= midpoint) {
      phaseData.recentScores.push(s.score || 0);
    } else {
      phaseData.olderScores.push(s.score || 0);
    }
  });

  const result: PhaseStats[] = [];

  phaseMap.forEach((data, phase) => {
    const avgScore =
      data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0;

    const avgDuration =
      data.durations.length > 0
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        : 0;

    let improvement = 0;
    if (data.recentScores.length > 0 && data.olderScores.length > 0) {
      const recentAvg = data.recentScores.reduce((a, b) => a + b, 0) / data.recentScores.length;
      const olderAvg = data.olderScores.reduce((a, b) => a + b, 0) / data.olderScores.length;
      improvement = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    }

    result.push({
      phase,
      sessionCount: data.scores.length,
      avgScore: Math.round(avgScore * 10) / 10,
      avgDuration: Math.round(avgDuration),
      improvement: Math.round(improvement * 10) / 10,
    });
  });

  return result.sort((a, b) => b.sessionCount - a.sessionCount);
}

export async function getWeeklyStats(weeks: number): Promise<WeeklyStats[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from("trial_sessions")
    .select("score, duration_seconds, created_at")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const sessions = data || [];
  const weekMap = new Map<string, { scores: number[]; durations: number[] }>();

  sessions.forEach((s) => {
    const date = new Date(s.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { scores: [], durations: [] });
    }
    const weekData = weekMap.get(weekKey)!;
    weekData.scores.push(s.score || 0);
    weekData.durations.push(s.duration_seconds || 0);
  });

  const result: WeeklyStats[] = [];

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
    const weekKey = weekStart.toISOString().split("T")[0];

    const weekData = weekMap.get(weekKey);
    if (weekData) {
      result.push({
        week: weekKey,
        sessions: weekData.scores.length,
        avgScore: Math.round(
          (weekData.scores.reduce((a, b) => a + b, 0) / weekData.scores.length) * 10
        ) / 10,
        totalDuration: weekData.durations.reduce((a, b) => a + b, 0),
      });
    } else {
      result.push({
        week: weekKey,
        sessions: 0,
        avgScore: 0,
        totalDuration: 0,
      });
    }
  }

  return result.reverse();
}

export async function getRecentSessions(limit: number): Promise<TrialSession[]> {
  const { data, error } = await supabase
    .from("trial_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as TrialSession[]) || [];
}

export async function getScoreTrend(days: number): Promise<{ date: string; score: number }[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("trial_sessions")
    .select("score, created_at")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const sessions = data || [];
  const dateMap = new Map<string, number[]>();

  sessions.forEach((s) => {
    const dateKey = new Date(s.created_at).toISOString().split("T")[0];
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)!.push(s.score || 0);
  });

  const result: { date: string; score: number }[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];

    const scores = dateMap.get(dateKey);
    if (scores && scores.length > 0) {
      result.push({
        date: dateKey,
        score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      });
    }
  }

  return result;
}

export async function getFillerWordStats(): Promise<FillerWordStats[]> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data, error } = await supabase
    .from("trial_sessions")
    .select("metrics, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const sessions = data || [];
  const currentFillerMap = new Map<string, number>();
  const previousFillerMap = new Map<string, number>();

  sessions.forEach((s) => {
    const metrics = s.metrics as { fillerWords?: { word: string; count: number }[] } | null;
    const sessionDate = new Date(s.created_at);

    if (metrics?.fillerWords) {
      const targetMap = sessionDate >= twoWeeksAgo ? currentFillerMap : previousFillerMap;
      metrics.fillerWords.forEach((fw) => {
        targetMap.set(fw.word, (targetMap.get(fw.word) || 0) + fw.count);
      });
    }
  });

  const totalCurrent = Array.from(currentFillerMap.values()).reduce((a, b) => a + b, 0);
  const result: FillerWordStats[] = [];

  currentFillerMap.forEach((count, word) => {
    const previousCount = previousFillerMap.get(word) || 0;
    let trend: "up" | "down" | "stable" = "stable";
    if (previousCount > 0) {
      const change = ((count - previousCount) / previousCount) * 100;
      trend = change > 10 ? "up" : change < -10 ? "down" : "stable";
    } else if (count > 0) {
      trend = "up";
    }

    result.push({
      word,
      count,
      percentage: totalCurrent > 0 ? Math.round((count / totalCurrent) * 100 * 10) / 10 : 0,
      trend,
      previousCount,
    });
  });

  return result.sort((a, b) => b.count - a.count).slice(0, 10);
}

export const fillerWordTips: Record<string, string> = {
  um: "Pause briefly instead of saying 'um'. Silence is more powerful.",
  uh: "Take a breath before speaking to reduce 'uh' usage.",
  like: "Be intentional with comparisons. Reserve 'like' for actual similarities.",
  you: "Use 'one' or be specific instead of overusing 'you know'.",
  know: "Avoid 'you know' as a filler. Make clear statements.",
  so: "Start sentences directly without 'so' when possible.",
  basically: "Skip 'basically' - just state your point directly.",
  actually: "Reserve 'actually' for genuine corrections or surprises.",
  literally: "Use 'literally' only for exact, factual statements.",
  right: "Avoid ending statements with 'right?' - make confident assertions.",
};
