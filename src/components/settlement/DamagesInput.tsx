import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Calculator } from "lucide-react";
import type { EconomicDamages, NonEconomicDamages } from "@/lib/settlement-api";

interface DamagesInputProps {
  economicDamages: EconomicDamages;
  nonEconomicDamages: NonEconomicDamages;
  onEconomicChange: (damages: EconomicDamages) => void;
  onNonEconomicChange: (damages: NonEconomicDamages) => void;
  painMultiplier?: number;
  onPainMultiplierChange?: (multiplier: number) => void;
}

export function DamagesInput({
  economicDamages,
  nonEconomicDamages,
  onEconomicChange,
  onNonEconomicChange,
  painMultiplier = 0,
  onPainMultiplierChange,
}: DamagesInputProps) {
  const totalEconomic = 
    economicDamages.medicalExpenses +
    economicDamages.medicalExpensesFuture +
    economicDamages.lostWages +
    economicDamages.lostWagesFuture +
    economicDamages.propertyDamage +
    economicDamages.otherEconomic;

  const handleEconomicChange = (field: keyof EconomicDamages, value: string) => {
    const numValue = parseFloat(value) || 0;
    onEconomicChange({ ...economicDamages, [field]: numValue });
  };

  const handleNonEconomicChange = (field: keyof NonEconomicDamages, value: string) => {
    const numValue = parseFloat(value) || 0;
    onNonEconomicChange({ ...nonEconomicDamages, [field]: numValue });
  };

  const handleMultiplierSelect = (multiplier: number) => {
    if (onPainMultiplierChange) {
      onPainMultiplierChange(multiplier);
      const painSuffering = totalEconomic * multiplier;
      onNonEconomicChange({ ...nonEconomicDamages, painSuffering });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Damages Input
        </CardTitle>
        <CardDescription>
          Enter economic and non-economic damages for settlement calculation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="economic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="economic">Economic Damages</TabsTrigger>
            <TabsTrigger value="non-economic">Non-Economic Damages</TabsTrigger>
          </TabsList>

          <TabsContent value="economic" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="medicalExpenses">Medical Expenses (Past)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="medicalExpenses"
                    type="number"
                    placeholder="0"
                    value={economicDamages.medicalExpenses || ''}
                    onChange={(e) => handleEconomicChange('medicalExpenses', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicalExpensesFuture">Medical Expenses (Future)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="medicalExpensesFuture"
                    type="number"
                    placeholder="0"
                    value={economicDamages.medicalExpensesFuture || ''}
                    onChange={(e) => handleEconomicChange('medicalExpensesFuture', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lostWages">Lost Wages (Past)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lostWages"
                    type="number"
                    placeholder="0"
                    value={economicDamages.lostWages || ''}
                    onChange={(e) => handleEconomicChange('lostWages', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lostWagesFuture">Lost Wages (Future)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lostWagesFuture"
                    type="number"
                    placeholder="0"
                    value={economicDamages.lostWagesFuture || ''}
                    onChange={(e) => handleEconomicChange('lostWagesFuture', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyDamage">Property Damage</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="propertyDamage"
                    type="number"
                    placeholder="0"
                    value={economicDamages.propertyDamage || ''}
                    onChange={(e) => handleEconomicChange('propertyDamage', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherEconomic">Other Economic</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otherEconomic"
                    type="number"
                    placeholder="0"
                    value={economicDamages.otherEconomic || ''}
                    onChange={(e) => handleEconomicChange('otherEconomic', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="font-medium">Total Economic Damages</span>
              <Badge variant="secondary" className="text-lg">
                <TrendingUp className="h-4 w-4 mr-1" />
                {formatCurrency(totalEconomic)}
              </Badge>
            </div>
          </TabsContent>

          <TabsContent value="non-economic" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pain & Suffering Multiplier</Label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((mult) => (
                    <Badge
                      key={mult}
                      variant={painMultiplier === mult ? "default" : "outline"}
                      className="cursor-pointer px-3 py-1"
                      onClick={() => handleMultiplierSelect(mult)}
                    >
                      {mult}x
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click a multiplier to auto-calculate pain & suffering based on economic damages ({formatCurrency(totalEconomic)})
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="painSuffering">Pain & Suffering</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="painSuffering"
                    type="number"
                    placeholder="0"
                    value={nonEconomicDamages.painSuffering || ''}
                    onChange={(e) => handleNonEconomicChange('painSuffering', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emotionalDistress">Emotional Distress</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="emotionalDistress"
                    type="number"
                    placeholder="0"
                    value={nonEconomicDamages.emotionalDistress || ''}
                    onChange={(e) => handleNonEconomicChange('emotionalDistress', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lossOfConsortium">Loss of Consortium</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lossOfConsortium"
                    type="number"
                    placeholder="0"
                    value={nonEconomicDamages.lossOfConsortium || ''}
                    onChange={(e) => handleNonEconomicChange('lossOfConsortium', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lossOfEnjoyment">Loss of Enjoyment</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lossOfEnjoyment"
                    type="number"
                    placeholder="0"
                    value={nonEconomicDamages.lossOfEnjoyment || ''}
                    onChange={(e) => handleNonEconomicChange('lossOfEnjoyment', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disfigurement">Disfigurement</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="disfigurement"
                    type="number"
                    placeholder="0"
                    value={nonEconomicDamages.disfigurement || ''}
                    onChange={(e) => handleNonEconomicChange('disfigurement', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
