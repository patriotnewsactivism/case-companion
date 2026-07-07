import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  Save,
  Loader2,
  AlertTriangle,
  Shield,
  Copy,
  FileText,
} from "lucide-react";
import type { DiscoveryRequest } from "@/lib/discovery-api";
import { OBJECTION_TYPES } from "@/lib/discovery-api";
import { toast } from "sonner";

interface ResponseGeneratorProps {
  request: DiscoveryRequest;
  onGenerateResponse: (requestId: string) => Promise<string>;
  onSave: (requestId: string, updates: Partial<DiscoveryRequest>) => Promise<void>;
}

export function ResponseGenerator({
  request,
  onGenerateResponse,
  onSave,
}: ResponseGeneratorProps) {
  const [response, setResponse] = useState(request.response || '');
  const [objections, setObjections] = useState<string[]>(request.objections || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrivilegeCheck, setShowPrivilegeCheck] = useState(false);
  const [privilegeLogEntry, setPrivilegeLogEntry] = useState(request.privilegeLogEntry);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generatedResponse = await onGenerateResponse(request.id);
      setResponse(generatedResponse);
      toast.success("Response generated successfully");
    } catch (error) {
      toast.error("Failed to generate response");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (asDraft: boolean = true) => {
    setIsSaving(true);
    try {
      await onSave(request.id, {
        response,
        objections,
        privilegeLogEntry,
        status: asDraft ? 'draft' : 'responded',
        responseDate: asDraft ? null : new Date().toISOString(),
      });
      toast.success(asDraft ? "Saved as draft" : "Marked as responded");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleObjection = (objection: string) => {
    setObjections(prev =>
      prev.includes(objection)
        ? prev.filter(o => o !== objection)
        : [...prev, objection]
    );
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(response);
    toast.success("Response copied to clipboard");
  };

  const suggestedObjections = OBJECTION_TYPES.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Response Editor
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {request.requestNumber}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-muted/30 p-3 rounded-md">
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Original Request</h4>
          <p className="text-sm">{request.question}</p>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Generated Response</h4>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
                disabled={!response}
                className="gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="gap-1"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate
              </Button>
            </div>
          </div>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Click 'Generate' to create an AI-assisted response, or write your own..."
            className="min-h-[150px]"
          />
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Suggested Objections</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedObjections.map((objection) => (
              <Badge
                key={objection}
                variant={objections.includes(objection) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleObjection(objection)}
              >
                {objection}
              </Badge>
            ))}
          </div>
          
          <div className="mt-3 grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-2 bg-muted/20 rounded-md">
            {OBJECTION_TYPES.map((objection) => (
              <label
                key={objection}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
              >
                <Checkbox
                  checked={objections.includes(objection)}
                  onCheckedChange={() => toggleObjection(objection)}
                />
                {objection}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrivilegeCheck(!showPrivilegeCheck)}
            className={cn("gap-1", privilegeLogEntry && "text-amber-600")}
          >
            <Shield className="h-3 w-3" />
            Privilege Check
          </Button>
          {privilegeLogEntry && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Privilege Log Entry Required
            </Badge>
          )}
        </div>

        {showPrivilegeCheck && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md space-y-2">
            <p className="text-sm text-amber-800">
              If this response involves privileged information, mark it for the privilege log.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={privilegeLogEntry}
                onCheckedChange={(checked) => setPrivilegeLogEntry(checked as boolean)}
              />
              <span className="text-sm">Add to privilege log</span>
            </label>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {request.responseDate && (
              <span>Last responded: {new Date(request.responseDate).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSaving || !response}
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving || !response}
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Mark Responded
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
