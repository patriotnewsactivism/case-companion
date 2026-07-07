import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface ScoreChartProps {
  data: { date: string; score: number }[];
  averageScore?: number;
  title?: string;
}

const chartConfig: ChartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--primary))",
  },
  average: {
    label: "Average",
    color: "hsl(var(--muted-foreground))",
  },
};

export function ScoreChart({
  data,
  averageScore,
  title = "Score Trend",
}: ScoreChartProps) {
  const avg = averageScore || (data.length > 0
    ? data.reduce((sum, d) => sum + d.score, 0) / data.length
    : 0);

  const formattedData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Avg: {avg.toFixed(1)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#scoreGradient)"
            />
            <ReferenceLine
              y={avg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              label={{
                value: "Avg",
                position: "right",
                className: "text-xs fill-muted-foreground",
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
