import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CaseLawCitation } from "@/lib/evidence-api";

interface CaseLawSupportProps {
  citations: CaseLawCitation[];
}

export function CaseLawSupport({ citations }: CaseLawSupportProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (citations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Supporting Case Law
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No relevant case law found
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async (citation: string, index: number) => {
    await navigator.clipboard.writeText(citation);
    setCopiedIndex(index);
    toast.success("Citation copied");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getFavorableConfig = (favorableTo: string) => {
    switch (favorableTo) {
      case 'plaintiff':
        return { label: 'Favors Plaintiff', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' };
      case 'defendant':
        return { label: 'Favors Defense', color: 'bg-orange-500/10 text-orange-500 border-orange-500/30' };
      default:
        return { label: 'Neutral', color: 'bg-gray-500/10 text-gray-500 border-gray-500/30' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Supporting Case Law
          <Badge variant="secondary" className="ml-2">{citations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {citations.map((citation, index) => {
          const favorableConfig = getFavorableConfig(citation.favorableTo);
          return (
            <div
              key={index}
              className="p-4 rounded-lg border bg-muted/30 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm">{citation.caseName}</h4>
                    <Badge variant="outline" className={cn("text-xs", favorableConfig.color)}>
                      {favorableConfig.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {citation.citation} • {citation.court} • {citation.date}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(citation.citation, index)}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  {copiedIndex === index ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Holding: </span>
                  {citation.holding}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
