import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, ListChecks, CheckCircle2, AlertTriangle, ClipboardList } from "lucide-react";

/** Minimal shape needed for rendering — matches the documents table analysis fields. */
export interface AnalyzedDocument {
  name: string;
  document_type?: string | null;
  bates_number?: string | null;
  summary?: string | null;
  key_facts?: string[] | null;
  favorable_findings?: string[] | null;
  adverse_findings?: string[] | null;
  action_items?: string[] | null;
}

interface DocumentAnalysisDialogProps {
  doc: AnalyzedDocument | null;
  onOpenChange: (open: boolean) => void;
}

function Section({
  icon: Icon,
  title,
  items,
  tone = "default",
}: {
  icon: typeof ListChecks;
  title: string;
  items?: string[] | null;
  tone?: "default" | "favorable" | "adverse";
}) {
  if (!items || items.length === 0) return null;
  const toneClass =
    tone === "favorable"
      ? "text-green-700"
      : tone === "adverse"
      ? "text-red-700"
      : "text-foreground";
  return (
    <div>
      <h4 className={`mb-1.5 flex items-center gap-1.5 text-sm font-semibold ${toneClass}`}>
        <Icon className="h-4 w-4" />
        {title}
        <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
      </h4>
      <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentAnalysisDialog({ doc, onOpenChange }: DocumentAnalysisDialogProps) {
  const open = !!doc;
  const hasAnalysis =
    !!doc &&
    (doc.summary ||
      doc.key_facts?.length ||
      doc.favorable_findings?.length ||
      doc.adverse_findings?.length ||
      doc.action_items?.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{doc?.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {doc?.document_type && <Badge variant="outline">{doc.document_type}</Badge>}
            {doc?.bates_number && (
              <span className="font-mono text-xs">{doc.bates_number}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!hasAnalysis ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No analysis yet. Run OCR / Analyze on this document to extract a summary,
            key facts, and findings.
          </p>
        ) : (
          <div className="space-y-5">
            {doc?.summary && (
              <div>
                <h4 className="mb-1.5 text-sm font-semibold">Summary</h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {doc.summary}
                </p>
              </div>
            )}
            <Section icon={ListChecks} title="Key Facts" items={doc?.key_facts} />
            <Section
              icon={CheckCircle2}
              title="Favorable Findings"
              items={doc?.favorable_findings}
              tone="favorable"
            />
            <Section
              icon={AlertTriangle}
              title="Adverse Findings"
              items={doc?.adverse_findings}
              tone="adverse"
            />
            <Section icon={ClipboardList} title="Action Items" items={doc?.action_items} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
