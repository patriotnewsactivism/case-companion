import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, AlertCircle, Lightbulb, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrengthsWeaknessesProps {
  strengths: string[];
  weaknesses: string[];
  suggestions?: Record<string, string>;
}

const improvementSuggestions: Record<string, string> = {
  "Overall performance needs improvement": "Focus on consistent practice sessions and review your recorded sessions to identify areas for growth.",
  "High filler word usage detected": "Practice speaking slowly and pause instead of using filler words. Record yourself and count filler words.",
  "Performance declining recently": "Review your recent sessions and identify what changed. Consider more focused practice on weak areas.",
  "Need more practice sessions": "Aim for at least 2-3 practice sessions per week to maintain and improve your skills.",
};

const strengthDetails: Record<string, string> = {
  "Strong overall performance": "Your scores consistently rank in the top tier. Keep maintaining your preparation routine.",
  "Minimal filler word usage": "Excellent control over speech patterns. This helps maintain credibility and clarity.",
  "Consistent improvement trend": "Your practice is paying off. Continue the current training approach.",
  "Regular practice sessions": "Consistent practice is key to improvement. Your dedication shows in your results.",
};

export function StrengthsWeaknesses({
  strengths,
  weaknesses,
}: StrengthsWeaknessesProps) {
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  const toggleItem = (item: string) => {
    setOpenItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Strengths & Areas for Improvement</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <h4 className="font-medium text-sm">Strengths</h4>
            </div>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">Complete more sessions to identify your strengths.</p>
            ) : (
              <div className="space-y-2">
                {strengths.map((strength) => (
                  <Collapsible
                    key={strength}
                    open={openItems.includes(strength)}
                    onOpenChange={() => toggleItem(strength)}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-sm text-left">{strength}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          openItems.includes(strength) && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-2 pb-2">
                      <p className="text-xs text-muted-foreground mt-2 pl-6">
                        {strengthDetails[strength] || "Keep up the great work in this area!"}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <h4 className="font-medium text-sm">Areas for Improvement</h4>
            </div>
            {weaknesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Great job! No significant areas of concern identified.</p>
            ) : (
              <div className="space-y-2">
                {weaknesses.map((weakness) => (
                  <Collapsible
                    key={weakness}
                    open={openItems.includes(weakness)}
                    onOpenChange={() => toggleItem(weakness)}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-sm text-left">{weakness}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          openItems.includes(weakness) && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-2 pb-2">
                      <div className="flex items-start gap-2 mt-2 pl-6">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          {improvementSuggestions[weakness] || "Focus on this area during your next practice session."}
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
