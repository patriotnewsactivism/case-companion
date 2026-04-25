import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Table2,
  DollarSign,
  BookOpen,
  File,
  Download,
  Loader2,
  Check,
  ExternalLink,
} from "lucide-react";

type ExportFormat =
  | "pdf_summary"
  | "csv_documents"
  | "csv_billing"
  | "pdf_brief"
  | "docx_filing";

interface ExportOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  fileExtension: string;
}

interface ExportDialogProps {
  caseId: string;
  caseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const exportOptions: ExportOption[] = [
  {
    id: "pdf_summary",
    label: "PDF Case Summary",
    description: "Complete case overview with AI analysis",
    icon: FileText,
    fileExtension: "pdf",
  },
  {
    id: "csv_documents",
    label: "CSV Documents",
    description: "Document list with Bates numbers and summaries",
    icon: Table2,
    fileExtension: "csv",
  },
  {
    id: "csv_billing",
    label: "CSV Billing",
    description: "Time entries and billing data",
    icon: DollarSign,
    fileExtension: "csv",
  },
  {
    id: "pdf_brief",
    label: "PDF Brief",
    description: "Legal brief formatted for filing",
    icon: BookOpen,
    fileExtension: "pdf",
  },
  {
    id: "docx_filing",
    label: "DOCX Filing",
    description: "Court filing document",
    icon: File,
    fileExtension: "docx",
  },
];

export function ExportDialog({
  caseId,
  caseName,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(
    null,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // CSV options
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // PDF options
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFormat) throw new Error("Select an export format");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const body: Record<string, unknown> = {
        caseId,
        format: selectedFormat,
      };

      if (
        selectedFormat === "csv_documents" ||
        selectedFormat === "csv_billing"
      ) {
        if (dateFrom) body.dateFrom = dateFrom;
        if (dateTo) body.dateTo = dateTo;
      }

      if (
        selectedFormat === "pdf_summary" ||
        selectedFormat === "pdf_brief"
      ) {
        body.includeTimeline = includeTimeline;
        body.includeAiAnalysis = includeAiAnalysis;
        body.includeDocuments = includeDocuments;
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-document`;

      const response = await fetch(functionUrl, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.downloadUrl as string;
    },
    onSuccess: (url) => {
      setDownloadUrl(url);
      toast.success("Export generated successfully.");
    },
    onError: (e: Error) => {
      toast.error(`Export failed: ${e.message}`);
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedFormat(null);
      setDownloadUrl(null);
      setDateFrom("");
      setDateTo("");
      setIncludeTimeline(true);
      setIncludeAiAnalysis(true);
      setIncludeDocuments(true);
    }
    onOpenChange(newOpen);
  };

  const showCsvOptions =
    selectedFormat === "csv_documents" || selectedFormat === "csv_billing";
  const showPdfOptions =
    selectedFormat === "pdf_summary" || selectedFormat === "pdf_brief";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Case Data
          </DialogTitle>
          <DialogDescription>
            Export data from{" "}
            <span className="font-medium">{caseName}</span> in your preferred
            format.
          </DialogDescription>
        </DialogHeader>

        {/* Format selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Select Format</Label>
          <div className="grid grid-cols-1 gap-2">
            {exportOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFormat === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedFormat(option.id);
                    setDownloadUrl(null);
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Options section */}
        {selectedFormat && (showCsvOptions || showPdfOptions) && (
          <>
            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Options</Label>

              {/* CSV date range */}
              {showCsvOptions && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="export-date-from" className="text-xs">
                      From Date
                    </Label>
                    <Input
                      id="export-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="export-date-to" className="text-xs">
                      To Date
                    </Label>
                    <Input
                      id="export-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* PDF section checkboxes */}
              {showPdfOptions && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTimeline}
                      onChange={(e) => setIncludeTimeline(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Include Timeline</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAiAnalysis}
                      onChange={(e) => setIncludeAiAnalysis(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Include AI Analysis</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDocuments}
                      onChange={(e) => setIncludeDocuments(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Include Documents</span>
                  </label>
                </div>
              )}
            </div>
          </>
        )}

        {/* Download link after generation */}
        {downloadUrl && (
          <>
            <Separator />
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Export Ready
                </span>
              </div>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 underline underline-offset-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download{" "}
                {exportOptions.find((o) => o.id === selectedFormat)?.label ||
                  "File"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={exportMutation.isPending}
          >
            {downloadUrl ? "Close" : "Cancel"}
          </Button>
          {!downloadUrl && (
            <Button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || !selectedFormat}
            >
              {exportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Export
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
