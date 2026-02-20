import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Play, FileText, User } from "lucide-react";
import { toast } from "sonner";

interface FoundationSuggestion {
  question: string;
  witnessType: string;
  requiredDocuments: string[];
}

interface FoundationSuggestionsProps {
  suggestions: string[];
  onUseInSimulator?: (question: string) => void;
}

function parseSuggestion(suggestion: string): FoundationSuggestion {
  const lines = suggestion.split('\n');
  let question = suggestion;
  let witnessType = 'Witness';
  let requiredDocuments: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().includes('witness:') || line.toLowerCase().includes('witness type:')) {
      witnessType = line.split(':').slice(1).join(':').trim();
    }
    if (line.toLowerCase().includes('document') || line.toLowerCase().includes('exhibit')) {
      const docs = line.split(':').slice(1).join(':').trim();
      if (docs) {
        requiredDocuments = docs.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
  }

  return { question, witnessType, requiredDocuments };
}

export function FoundationSuggestions({ suggestions, onUseInSimulator }: FoundationSuggestionsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Foundation Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No foundation suggestions available
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Foundation Suggestions
          <Badge variant="secondary" className="ml-2">{suggestions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion, index) => {
          const parsed = parseSuggestion(suggestion);
          return (
            <div
              key={index}
              className="p-4 rounded-lg border bg-muted/30 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="gap-1">
                      {index + 1}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <User className="h-3 w-3" />
                      {parsed.witnessType}
                    </Badge>
                  </div>
                  <p className="text-sm">{parsed.question}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(suggestion, index)}
                    className="h-8 w-8 p-0"
                  >
                    {copiedIndex === index ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {onUseInSimulator && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUseInSimulator(suggestion)}
                      className="h-8 w-8 p-0"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {parsed.requiredDocuments.length > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Required: </span>
                  <span className="text-xs">{parsed.requiredDocuments.join(', ')}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
