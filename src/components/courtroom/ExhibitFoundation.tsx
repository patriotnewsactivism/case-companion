import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Circle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
  Image,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FoundationStep {
  id: string;
  question: string;
  completed: boolean;
  required: boolean;
  notes?: string;
}

interface EvidenceType {
  type: string;
  label: string;
  icon: React.ReactNode;
  foundationSteps: FoundationStep[];
  tips: string[];
}

const EVIDENCE_TYPES: EvidenceType[] = [
  {
    type: 'document',
    label: 'Document',
    icon: <FileText className="h-4 w-4" />,
    foundationSteps: [
      { id: 'doc-1', question: 'Can you identify this document?', completed: false, required: true },
      { id: 'doc-2', question: 'How are you familiar with this document?', completed: false, required: true },
      { id: 'doc-3', question: 'Is this document kept in the regular course of business?', completed: false, required: false },
      { id: 'doc-4', question: 'Was this document made at or near the time of the event?', completed: false, required: false },
      { id: 'doc-5', question: 'Is this a true and accurate copy of the original?', completed: false, required: true },
    ],
    tips: [
      'Establish who created the document and when',
      'For business records, show the custodian or someone with knowledge',
      'Be prepared to address hearsay exceptions if challenged',
    ],
  },
  {
    type: 'photograph',
    label: 'Photograph/Video',
    icon: <Image className="h-4 w-4" />,
    foundationSteps: [
      { id: 'photo-1', question: 'Do you recognize this photograph/video?', completed: false, required: true },
      { id: 'photo-2', question: 'What does this photograph/video depict?', completed: false, required: true },
      { id: 'photo-3', question: 'When and where was this taken?', completed: false, required: true },
      { id: 'photo-4', question: 'Does it fairly and accurately represent what you saw?', completed: false, required: true },
    ],
    tips: [
      'The witness must have personal knowledge of the scene',
      'Establish the date and location clearly',
      'Confirm it accurately represents reality',
    ],
  },
  {
    type: 'physical',
    label: 'Physical Evidence',
    icon: <Database className="h-4 w-4" />,
    foundationSteps: [
      { id: 'phys-1', question: 'Do you recognize this object?', completed: false, required: true },
      { id: 'phys-2', question: 'How do you recognize it?', completed: false, required: true },
      { id: 'phys-3', question: 'What is its condition now compared to when you first saw it?', completed: false, required: true },
      { id: 'phys-4', question: 'Has it been in your custody the entire time?', completed: false, required: false },
      { id: 'phys-5', question: 'How was it stored/handled?', completed: false, required: false },
    ],
    tips: [
      'Establish chain of custody clearly',
      'Document who handled the evidence and when',
      'Show no tampering or alteration occurred',
    ],
  },
  {
    type: 'business_record',
    label: 'Business Records',
    icon: <Database className="h-4 w-4" />,
    foundationSteps: [
      { id: 'br-1', question: 'What is your position at [company]?', completed: false, required: true },
      { id: 'br-2', question: 'Are you the custodian of records?', completed: false, required: true },
      { id: 'br-3', question: 'Are records like this kept in the regular course of business?', completed: false, required: true },
      { id: 'br-4', question: 'Was this record made at or near the time of the event?', completed: false, required: true },
      { id: 'br-5', question: 'Was it made by someone with knowledge?', completed: false, required: true },
      { id: 'br-6', question: 'Is it the regular practice of the business to make such records?', completed: false, required: true },
    ],
    tips: [
      'Custodian testimony is preferred but not always required',
      'Establish the reliability of the record-keeping system',
      'Be prepared for hearsay objections and exceptions',
    ],
  },
];

interface ExhibitFoundationProps {
  onQuestionClick: (question: string) => void;
}

export function ExhibitFoundation({ onQuestionClick }: ExhibitFoundationProps) {
  const [selectedType, setSelectedType] = useState<string>('document');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [steps, setSteps] = useState<Record<string, FoundationStep[]>>(() => {
    const initial: Record<string, FoundationStep[]> = {};
    EVIDENCE_TYPES.forEach(type => {
      initial[type.type] = type.foundationSteps.map(step => ({ ...step }));
    });
    return initial;
  });

  const currentEvidence = EVIDENCE_TYPES.find(e => e.type === selectedType);
  const currentSteps = steps[selectedType] || [];

  const toggleStep = (stepId: string) => {
    setSteps(prev => ({
      ...prev,
      [selectedType]: prev[selectedType].map(step =>
        step.id === stepId ? { ...step, completed: !step.completed } : step
      ),
    }));
  };

  const toggleExpand = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const completedCount = currentSteps.filter(s => s.completed).length;
  const requiredSteps = currentSteps.filter(s => s.required);
  const completedRequired = requiredSteps.filter(s => s.completed).length;
  const allRequiredComplete = requiredSteps.every(s => s.completed);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Foundation Checklist
          </CardTitle>
          {allRequiredComplete && (
            <Badge className="bg-green-500 text-white text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {completedRequired}/{requiredSteps.length} required steps complete
        </p>
      </CardHeader>

      <div className="border-b px-3 py-2">
        <div className="flex gap-1">
          {EVIDENCE_TYPES.map(type => (
            <Button
              key={type.type}
              size="sm"
              variant={selectedType === type.type ? "default" : "ghost"}
              onClick={() => setSelectedType(type.type)}
              className="h-7 px-2 text-xs"
            >
              {type.icon}
              <span className="ml-1 hidden sm:inline">{type.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {currentSteps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "rounded-lg border transition-all",
                  step.completed
                    ? "border-green-500/30 bg-green-500/5"
                    : step.required
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border"
                )}
              >
                <div className="flex items-start gap-3 p-3">
                  <Checkbox
                    id={step.id}
                    checked={step.completed}
                    onCheckedChange={() => toggleStep(step.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={step.id}
                        className={cn(
                          "text-sm cursor-pointer",
                          step.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {step.question}
                      </label>
                      {step.required && !step.completed && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleExpand(step.id)}
                    className="h-6 w-6 p-0"
                  >
                    {expandedSteps.has(step.id) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                {expandedSteps.has(step.id) && (
                  <div className="px-3 pb-3 pt-0 space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onQuestionClick(step.question)}
                        className="flex-1"
                      >
                        Ask This Question
                      </Button>
                    </div>
                    {step.notes && (
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        {step.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      {currentEvidence && currentEvidence.tips.length > 0 && (
        <div className="border-t p-3 bg-muted/30">
          <p className="text-xs font-medium mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Tips
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {currentEvidence.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
