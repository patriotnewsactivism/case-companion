import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { FileText, Target, Upload, Loader2 } from "lucide-react";
import { Document } from "@/lib/api";

interface EvidenceInputProps {
  onSubmit: (description: string, documentId?: string) => void;
  isLoading: boolean;
  documents: Document[];
  selectedCaseId: string;
}

const QUICK_FILL_OPTIONS = [
  { label: "Email Communication", value: "An email correspondence between parties dated [DATE] regarding [TOPIC]" },
  { label: "Photograph", value: "A photograph showing [SUBJECT] taken on [DATE] at [LOCATION]" },
  { label: "Contract Document", value: "A signed contract dated [DATE] between [PARTY A] and [PARTY B]" },
  { label: "Medical Record", value: "Medical records from [PROVIDER] documenting treatment for [CONDITION]" },
  { label: "Financial Document", value: "Financial records including [TYPE] from [INSTITUTION] for period [DATES]" },
  { label: "Witness Statement", value: "A written statement from [WITNESS NAME] describing their observations of [EVENT]" },
  { label: "Expert Report", value: "Expert report prepared by [EXPERT NAME] regarding [TOPIC]" },
  { label: "Video Recording", value: "Video recording from [SOURCE] capturing [EVENT] on [DATE]" },
];

export function EvidenceInput({ onSubmit, isLoading, documents, selectedCaseId }: EvidenceInputProps) {
  const [description, setDescription] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");

  const handleSubmit = () => {
    if (!description.trim()) return;
    onSubmit(description, selectedDocumentId || undefined);
  };

  const handleQuickFill = (value: string) => {
    setDescription(value);
  };

  const caseDocuments = documents.filter(d => d.case_id === selectedCaseId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Evidence Description
        </CardTitle>
        <CardDescription>
          Describe the evidence you want to analyze for admissibility
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Evidence Description</Label>
          <Textarea
            placeholder="Describe the evidence in detail, including what it shows, who created it, when it was created, and how you intend to use it..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Quick Fill Templates</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILL_OPTIONS.map((option) => (
              <Button
                key={option.label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickFill(option.value)}
                disabled={isLoading}
                className="text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Link to Case Document (Optional)</Label>
          <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Select a document from this case..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {caseDocuments.length === 0 ? (
                <SelectItem value="_empty" disabled>No documents available</SelectItem>
              ) : (
                caseDocuments.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.name}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={isLoading || !description.trim()} className="gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Analyze Admissibility
              </>
            )}
          </Button>
          <Button variant="outline" disabled={isLoading} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Evidence
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
