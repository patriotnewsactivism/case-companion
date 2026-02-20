import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceAnalysis } from "@/lib/evidence-api";

interface AdmissibilityResultProps {
  analysis: EvidenceAnalysis;
}

export function AdmissibilityResult({ analysis }: AdmissibilityResultProps) {
  const getStatusConfig = () => {
    switch (analysis.overallAdmissibility) {
      case 'admissible':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          label: 'Likely Admissible',
          description: 'This evidence is likely to be admitted at trial',
        };
      case 'conditional':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          label: 'Conditionally Admissible',
          description: 'This evidence may be admitted with proper foundation or limiting instruction',
        };
      case 'inadmissible':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Likely Inadmissible',
          description: 'This evidence faces significant admissibility challenges',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className={cn("border-2", config.borderColor)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          <div className={cn("p-4 rounded-full", config.bgColor)}>
            <Icon className={cn("h-12 w-12", config.color)} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{config.label}</h3>
            <p className="text-muted-foreground text-sm mt-1">{config.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Confidence:</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        analysis.confidenceScore >= 70 ? "bg-green-500" :
                        analysis.confidenceScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${analysis.confidenceScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">{analysis.confidenceScore}%</span>
                </div>
              </div>
              <div className="text-sm">
                <span className="font-medium">{analysis.issues.length}</span>
                <span className="text-muted-foreground ml-1">issue{analysis.issues.length !== 1 ? 's' : ''} identified</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
