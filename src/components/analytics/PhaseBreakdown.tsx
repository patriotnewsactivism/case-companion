import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import type { PhaseStats } from "@/lib/analytics-api";

interface PhaseBreakdownProps {
  data: PhaseStats[];
  onPhaseClick?: (phase: string) => void;
}

const chartConfig: ChartConfig = {
  avgScore: {
    label: "Avg Score",
  },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "hsl(142, 76%, 36%)";
  if (score >= 60) return "hsl(45, 93%, 47%)";
  return "hsl(0, 84%, 60%)";
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

export function PhaseBreakdown({ data, onPhaseClick }: PhaseBreakdownProps) {
  const formattedData = data.map((d) => ({
    ...d,
    label: phaseLabels[d.phase] || d.phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    fill: getScoreColor(d.avgScore),
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Performance by Phase</CardTitle>
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
              className="text-xs"
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <div className="space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Score:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Sessions:</span>
                        <span className="font-medium">{item.payload.sessionCount}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Improvement:</span>
                        <span className={item.payload.improvement >= 0 ? "text-green-600" : "text-red-600"}>
                          {item.payload.improvement >= 0 ? "+" : ""}
                          {item.payload.improvement}%
                        </span>
                      </div>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="avgScore"
              radius={[4, 4, 0, 0]}
              onClick={(data) => onPhaseClick?.(data.phase)}
              className="cursor-pointer"
            >
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-600" />
            <span className="text-xs text-muted-foreground">80+ Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-xs text-muted-foreground">60-80 Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-xs text-muted-foreground">&lt;60 Score</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
