import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Juror } from "@/lib/jury-api";

interface JurorCardProps {
  juror: Juror;
  className?: string;
}

export function JurorCard({ juror, className }: JurorCardProps) {
  const getLeaningLabel = (score: number) => {
    if (score > 0.15) return { label: "Prosecution", color: "text-red-600" };
    if (score < -0.15) return { label: "Defense", color: "text-blue-600" };
    return { label: "Neutral", color: "text-muted-foreground" };
  };

  const leaning = getLeaningLabel(juror.leaningScore);

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={juror.avatar} alt={juror.name} />
            <AvatarFallback>{juror.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm truncate">{juror.name}</h4>
              <div className="flex items-center gap-1">
                <Scale className={cn("h-3.5 w-3.5", leaning.color)} />
                <span className={cn("text-xs", leaning.color)}>{leaning.label}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {juror.age} • {juror.occupation}
            </p>
            <Badge variant="outline" className="mt-1 text-[10px]">
              {juror.education}
            </Badge>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground line-clamp-2">{juror.background}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {juror.biases.slice(0, 2).map((bias, index) => (
            <Badge key={index} variant="secondary" className="text-[10px] px-1.5 py-0">
              {bias}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
