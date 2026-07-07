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
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import type { FillerWordStats, fillerWordTips } from "@/lib/analytics-api";

interface FillerWordAnalysisProps {
  data: FillerWordStats[];
  tips?: Record<string, string>;
}

const chartConfig: ChartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--primary))",
  },
};

export function FillerWordAnalysis({
  data,
  tips = {},
}: FillerWordAnalysisProps) {
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  const formattedData = data.map((d) => ({
    ...d,
    fill: d.trend === "up" ? "hsl(0, 84%, 60%)" : d.trend === "down" ? "hsl(142, 76%, 36%)" : "hsl(var(--primary))",
  }));

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case "down":
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case "up":
        return "Increasing";
      case "down":
        return "Decreasing";
      default:
        return "Stable";
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Filler Word Analysis</CardTitle>
        <Badge variant="secondary">{totalCount} total</Badge>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            layout="vertical"
            data={formattedData}
            margin={{ top: 10, right: 10, left: 60, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis
              dataKey="word"
              type="category"
              tickLine={false}
              axisLine={false}
              className="text-xs"
              width={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <div className="space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Count:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Percentage:</span>
                        <span className="font-medium">{item.payload.percentage}%</span>
                      </div>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {data.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>Tips for Improvement</span>
            </div>
            <div className="space-y-2">
              {data.slice(0, 3).map((item) => {
                const tip = tips[item.word.toLowerCase()];
                if (!tip) return null;
                return (
                  <div
                    key={item.word}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <Badge variant="outline" className="shrink-0">
                      "{item.word}"
                    </Badge>
                    <span>{tip}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-red-500" />
            <span className="text-xs text-muted-foreground">Increasing</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-3 w-3 text-green-500" />
            <span className="text-xs text-muted-foreground">Decreasing</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Stable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
