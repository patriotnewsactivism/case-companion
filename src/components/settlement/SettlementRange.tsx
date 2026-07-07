import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TrendingUp, Scale, DollarSign } from "lucide-react";
import type { EconomicDamages, NonEconomicDamages } from "@/lib/settlement-api";

interface SettlementRangeProps {
  rangeLow: number;
  rangeHigh: number;
  recommended: number;
  economicDamages: EconomicDamages;
  nonEconomicDamages: NonEconomicDamages;
  comparativeNegligence: number;
  onComparativeNegligenceChange: (value: number) => void;
}

export function SettlementRange({
  rangeLow,
  rangeHigh,
  recommended,
  economicDamages,
  nonEconomicDamages,
  comparativeNegligence,
  onComparativeNegligenceChange,
}: SettlementRangeProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalEconomic = 
    economicDamages.medicalExpenses +
    economicDamages.medicalExpensesFuture +
    economicDamages.lostWages +
    economicDamages.lostWagesFuture +
    economicDamages.propertyDamage +
    economicDamages.otherEconomic;

  const totalNonEconomic =
    nonEconomicDamages.painSuffering +
    nonEconomicDamages.emotionalDistress +
    nonEconomicDamages.lossOfConsortium +
    nonEconomicDamages.lossOfEnjoyment +
    nonEconomicDamages.disfigurement;

  const chartData = [
    { name: "Medical Expenses", value: economicDamages.medicalExpenses + economicDamages.medicalExpensesFuture, color: "#3b82f6" },
    { name: "Lost Wages", value: economicDamages.lostWages + economicDamages.lostWagesFuture, color: "#10b981" },
    { name: "Property Damage", value: economicDamages.propertyDamage, color: "#f59e0b" },
    { name: "Other Economic", value: economicDamages.otherEconomic, color: "#8b5cf6" },
    { name: "Pain & Suffering", value: nonEconomicDamages.painSuffering, color: "#ef4444" },
    { name: "Other Non-Economic", value: 
      nonEconomicDamages.emotionalDistress + 
      nonEconomicDamages.lossOfConsortium + 
      nonEconomicDamages.lossOfEnjoyment + 
      nonEconomicDamages.disfigurement, color: "#ec4899" },
  ].filter(item => item.value > 0);

  const chartConfig: ChartConfig = {
    medical: { label: "Medical Expenses", color: "#3b82f6" },
    wages: { label: "Lost Wages", color: "#10b981" },
    property: { label: "Property Damage", color: "#f59e0b" },
    other: { label: "Other Economic", color: "#8b5cf6" },
    pain: { label: "Pain & Suffering", color: "#ef4444" },
    nonEconomic: { label: "Other Non-Economic", color: "#ec4899" },
  };

  const sliderPosition = rangeHigh > 0 ? ((recommended - rangeLow) / (rangeHigh - rangeLow)) * 100 : 50;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Settlement Range
        </CardTitle>
        <CardDescription>
          Calculated settlement range based on damages and factors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold text-primary">
            {formatCurrency(rangeLow)} - {formatCurrency(rangeHigh)}
          </div>
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Recommended Demand:</span>
            <Badge variant="default" className="text-lg px-3">
              {formatCurrency(recommended)}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative pt-8 pb-4">
            <div className="absolute left-0 right-0 top-0 h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full" />
            <div
              className="absolute top-[-8px] transform -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${Math.min(100, Math.max(0, sliderPosition))}%` }}
            >
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary" />
              <Badge className="mt-1">{formatCurrency(recommended)}</Badge>
            </div>
            <Slider
              value={[recommended]}
              min={rangeLow}
              max={rangeHigh}
              step={1000}
              disabled
              className="opacity-50"
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Low: {formatCurrency(rangeLow)}</span>
            <span>High: {formatCurrency(rangeHigh)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Comparative Negligence
            </Label>
            <Badge variant={comparativeNegligence > 0 ? "destructive" : "secondary"}>
              {comparativeNegligence}% reduction
            </Badge>
          </div>
          <Slider
            value={[comparativeNegligence]}
            onValueChange={([value]) => onComparativeNegligenceChange(value)}
            min={0}
            max={100}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0% (No fault)</span>
            <span>50% (Bar threshold)</span>
            <span>100% (Full fault)</span>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Damage Breakdown</h4>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-1/2">
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={<ChartTooltipContent 
                          formatter={(value) => formatCurrency(value as number)}
                        />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-2">
                {chartData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex items-center justify-between font-medium">
                  <span>Total Damages</span>
                  <span>{formatCurrency(totalEconomic + totalNonEconomic)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Label } from "@/components/ui/label";
