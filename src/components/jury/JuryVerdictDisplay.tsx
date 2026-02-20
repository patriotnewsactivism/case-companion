import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, TrendingUp, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JuryVerdict } from "@/lib/jury-api";

interface JuryVerdictDisplayProps {
  verdict: JuryVerdict;
  className?: string;
}

export function JuryVerdictDisplay({ verdict, className }: JuryVerdictDisplayProps) {
  const getVerdictColor = () => {
    switch (verdict.verdict) {
      case 'guilty':
        return 'text-red-600';
      case 'not_guilty':
        return 'text-green-600';
      case 'hung':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getVerdictLabel = () => {
    switch (verdict.verdict) {
      case 'guilty':
        return 'GUILTY';
      case 'not_guilty':
        return 'NOT GUILTY';
      case 'hung':
        return 'HUNG JURY';
      default:
        return 'UNKNOWN';
    }
  };

  const totalVotes = verdict.voteTally.guilty + verdict.voteTally.notGuilty;
  const guiltyPercentage = totalVotes > 0 ? (verdict.voteTally.guilty / totalVotes) * 100 : 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="text-center pb-2">
        <CardTitle className={cn("text-4xl font-serif", getVerdictColor())}>
          {getVerdictLabel()}
        </CardTitle>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge variant="outline" className="text-sm">
            {verdict.confidence}% Confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span>Guilty: {verdict.voteTally.guilty}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>Not Guilty: {verdict.voteTally.notGuilty}</span>
              <TrendingDown className="h-4 w-4 text-green-500" />
            </span>
          </div>
          <div className="relative h-6 rounded-full overflow-hidden bg-secondary">
            <div 
              className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-500"
              style={{ width: `${guiltyPercentage}%` }}
            />
            <div 
              className="absolute right-0 top-0 h-full bg-green-500 transition-all duration-500"
              style={{ width: `${100 - guiltyPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
              <Users className="h-3 w-3 mr-1" />
              {totalVotes} Jurors
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Reasoning</h4>
          <p className="text-sm text-muted-foreground">{verdict.reasoning}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Strengths
            </h4>
            <ul className="space-y-1">
              {verdict.strengths.map((strength, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Weaknesses
            </h4>
            <ul className="space-y-1">
              {verdict.weaknesses.map((weakness, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5">•</span>
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
