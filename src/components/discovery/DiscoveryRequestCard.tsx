import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  FileSearch,
  Save,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { DiscoveryRequest, DiscoveryStatus } from "@/lib/discovery-api";
import { 
  DISCOVERY_TYPE_LABELS, 
  DISCOVERY_STATUS_COLORS, 
  OBJECTION_TYPES 
} from "@/lib/discovery-api";

interface DiscoveryRequestCardProps {
  request: DiscoveryRequest;
  onUpdate: (id: string, updates: Partial<DiscoveryRequest>) => Promise<void>;
  onGenerateResponse: (id: string) => Promise<string>;
  isUpdating?: boolean;
}

export function DiscoveryRequestCard({ 
  request, 
  onUpdate, 
  onGenerateResponse,
  isUpdating = false 
}: DiscoveryRequestCardProps) {
  const [response, setResponse] = useState(request.response || '');
  const [selectedObjections, setSelectedObjections] = useState<string[]>(request.objections || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showObjections, setShowObjections] = useState(false);

  const getDaysRemaining = () => {
    if (!request.responseDueDate) return null;
    const due = new Date(request.responseDueDate);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysRemaining = getDaysRemaining();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(request.id, {
        response,
        objections: selectedObjections,
        status: response ? 'draft' : request.status,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateResponse = async () => {
    setIsGenerating(true);
    try {
      const generatedResponse = await onGenerateResponse(request.id);
      setResponse(generatedResponse);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleObjection = (objection: string) => {
    setSelectedObjections(prev => 
      prev.includes(objection)
        ? prev.filter(o => o !== objection)
        : [...prev, objection]
    );
  };

  const getStatusIcon = (status: DiscoveryStatus) => {
    switch (status) {
      case 'overdue':
        return <AlertCircle className="h-3 w-3" />;
      case 'responded':
        return <CheckCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card className={cn(
      "transition-all",
      daysRemaining !== null && daysRemaining < 0 && "border-red-300 bg-red-50/30",
      daysRemaining === 0 && "border-yellow-300 bg-yellow-50/30"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {request.requestNumber}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {DISCOVERY_TYPE_LABELS[request.requestType]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs gap-1", DISCOVERY_STATUS_COLORS[request.status])}>
              {getStatusIcon(request.status)}
              {request.status}
            </Badge>
            {daysRemaining !== null && (
              <Badge variant={daysRemaining < 0 ? "destructive" : daysRemaining === 0 ? "default" : "outline"}>
                {daysRemaining < 0 
                  ? `${Math.abs(daysRemaining)} days overdue`
                  : daysRemaining === 0 
                  ? 'Due today'
                  : `${daysRemaining} days left`
                }
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Question/Request</h4>
          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
            {request.question}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Response</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateResponse}
              disabled={isGenerating}
              className="gap-1"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI Generate
            </Button>
          </div>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Enter your response or use AI to generate..."
            className="min-h-[120px]"
          />
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowObjections(!showObjections)}
            className="text-xs mb-2"
          >
            {showObjections ? 'Hide' : 'Show'} Objections ({selectedObjections.length})
          </Button>
          {showObjections && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-md max-h-[200px] overflow-y-auto">
              {OBJECTION_TYPES.map((objection) => (
                <label
                  key={objection}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
                >
                  <Checkbox
                    checked={selectedObjections.includes(objection)}
                    onCheckedChange={() => toggleObjection(objection)}
                  />
                  {objection}
                </label>
              ))}
            </div>
          )}
        </div>

        {request.privilegeLogEntry && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
            <AlertCircle className="h-3 w-3" />
            Privilege log entry required
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Select
              value={request.status}
              onValueChange={(value: DiscoveryStatus) => 
                onUpdate(request.id, { status: value })
              }
            >
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="objected">Objected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isUpdating}
            className="gap-1"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
