import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Copy, Check, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { generateMotionDraft } from "@/lib/evidence-api";

interface MotionDraftProps {
  analysisId: string;
  initialDraft: string | null;
}

const MOTION_TEMPLATES = [
  { id: 'motion_in_limine', label: 'Motion in Limine' },
  { id: 'motion_to_admit', label: 'Motion to Admit Evidence' },
  { id: 'motion_to_exclude', label: 'Motion to Exclude Evidence' },
  { id: 'motion_foundation', label: 'Foundation Brief' },
  { id: 'response_opposition', label: 'Response/Opposition' },
];

export function MotionDraft({ analysisId, initialDraft }: MotionDraftProps) {
  const [draft, setDraft] = useState(initialDraft || "");
  const [selectedTemplate, setSelectedTemplate] = useState("motion_in_limine");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const newDraft = await generateMotionDraft(analysisId, selectedTemplate);
      setDraft(newDraft);
      toast.success("Motion draft generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate motion");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft);
    setIsCopied(true);
    toast.success("Motion copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([draft], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motion_${selectedTemplate}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Motion exported");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Motion Draft
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label>Motion Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                {MOTION_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate Draft
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Motion Text</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!draft}
                className="gap-1"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!draft}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Generate a motion draft or paste your own text..."
            rows={15}
            className="font-mono text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
