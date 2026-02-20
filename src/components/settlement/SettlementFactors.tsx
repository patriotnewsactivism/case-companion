import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Sparkles, TrendingUp, TrendingDown, Minus, Loader2, Scale } from "lucide-react";
import type { SettlementFactor } from "@/lib/settlement-api";

interface SettlementFactorsProps {
  factors: SettlementFactor[];
  onFactorsChange: (factors: SettlementFactor[]) => void;
  onAISuggest?: () => void;
  isGenerating?: boolean;
}

const suggestedFactors: SettlementFactor[] = [
  { factor: "Strong documentary evidence", impact: "positive", weight: 80, description: "Well-documented medical records and bills support the claim" },
  { factor: "Clear liability", impact: "positive", weight: 90, description: "Defendant clearly at fault with multiple witnesses" },
  { factor: "Pre-existing condition", impact: "negative", weight: 60, description: "Prior injury to same body part may complicate causation" },
  { factor: "Gap in treatment", impact: "negative", weight: 40, description: "Delayed seeking medical treatment may suggest minor injury" },
  { factor: "Sympathetic plaintiff", impact: "positive", weight: 50, description: "Plaintiff presents well and jury will empathize" },
  { factor: "Experienced defense counsel", impact: "negative", weight: 30, description: "Defense has strong litigation track record" },
];

export function SettlementFactors({
  factors,
  onFactorsChange,
  onAISuggest,
  isGenerating = false,
}: SettlementFactorsProps) {
  const [newFactor, setNewFactor] = useState<SettlementFactor>({
    factor: "",
    impact: "neutral",
    weight: 50,
    description: "",
  });
  const [showForm, setShowForm] = useState(false);

  const handleAddFactor = () => {
    if (!newFactor.factor.trim()) return;
    onFactorsChange([...factors, { ...newFactor }]);
    setNewFactor({ factor: "", impact: "neutral", weight: 50, description: "" });
    setShowForm(false);
  };

  const handleRemoveFactor = (index: number) => {
    onFactorsChange(factors.filter((_, i) => i !== index));
  };

  const handleWeightChange = (index: number, weight: number) => {
    const updated = [...factors];
    updated[index] = { ...updated[index], weight };
    onFactorsChange(updated);
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "positive": return <TrendingUp className="h-4 w-4" />;
      case "negative": return <TrendingDown className="h-4 w-4" />;
      default: return <Minus className="h-4 w-4" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "positive": return "bg-green-100 text-green-800 border-green-200";
      case "negative": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Settlement Factors
            </CardTitle>
            <CardDescription>
              Factors affecting settlement value
            </CardDescription>
          </div>
          {onAISuggest && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onAISuggest}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI Suggest
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors.length > 0 ? (
          <div className="space-y-3">
            {factors.map((factor, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getImpactColor(factor.impact)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getImpactIcon(factor.impact)}
                      <span className="font-medium">{factor.factor}</span>
                      <Badge variant="outline" className="ml-auto">
                        {factor.weight}% weight
                      </Badge>
                    </div>
                    {factor.description && (
                      <p className="text-sm opacity-80">{factor.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFactor(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <Slider
                    value={[factor.weight]}
                    onValueChange={([value]) => handleWeightChange(index, value)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No factors added yet</p>
            <p className="text-sm">Add factors that may affect settlement value</p>
          </div>
        )}

        {showForm ? (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="factorName">Factor Name</Label>
              <Input
                id="factorName"
                placeholder="e.g., Strong documentary evidence"
                value={newFactor.factor}
                onChange={(e) => setNewFactor({ ...newFactor, factor: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="impact">Impact</Label>
              <Select
                value={newFactor.impact}
                onValueChange={(value: 'positive' | 'negative' | 'neutral') => 
                  setNewFactor({ ...newFactor, impact: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Positive
                    </div>
                  </SelectItem>
                  <SelectItem value="negative">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Negative
                    </div>
                  </SelectItem>
                  <SelectItem value="neutral">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-gray-600" />
                      Neutral
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Weight: {newFactor.weight}%</Label>
              <Slider
                value={[newFactor.weight]}
                onValueChange={([value]) => setNewFactor({ ...newFactor, weight: value })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Explain how this factor affects the settlement..."
                value={newFactor.description}
                onChange={(e) => setNewFactor({ ...newFactor, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddFactor} disabled={!newFactor.factor.trim()}>
                Add Factor
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Factor
          </Button>
        )}

        {factors.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick Add Common Factors:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedFactors.slice(0, 4).map((factor, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => onFactorsChange([...factors, factor])}
                >
                  {factor.factor}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Scale } from "lucide-react";
