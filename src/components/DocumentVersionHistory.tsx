import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  History,
  Eye,
  RotateCcw,
  Loader2,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  change_type: "edit" | "reanalysis" | "file_replace" | "rollback";
  change_description: string | null;
  summary: string | null;
  key_facts: string[] | null;
  ocr_text: string | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
}

interface DocumentVersionHistoryProps {
  documentId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const changeTypeBadgeConfig: Record<
  string,
  { label: string; className: string }
> = {
  edit: {
    label: "Edit",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  reanalysis: {
    label: "Reanalysis",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  },
  file_replace: {
    label: "File Replace",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  rollback: {
    label: "Rollback",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  },
};

export function DocumentVersionHistory({
  documentId,
  documentName,
  open,
  onOpenChange,
}: DocumentVersionHistoryProps) {
  const queryClient = useQueryClient();
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(
    null,
  );
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);

  const {
    data: versions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["document-versions", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", documentId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return (data as unknown as DocumentVersion[]) || [];
    },
    enabled: open && !!documentId,
  });

  const rollbackMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const version = versions.find((v) => v.id === versionId);
      if (!version) throw new Error("Version not found");

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (version.summary !== undefined) updates.summary = version.summary;
      if (version.key_facts !== undefined)
        updates.key_facts = version.key_facts;
      if (version.ocr_text !== undefined) updates.ocr_text = version.ocr_text;
      if (version.file_url !== undefined) updates.file_url = version.file_url;

      const { error: updateError } = await supabase
        .from("documents")
        .update(updates)
        .eq("id", documentId);

      if (updateError) throw updateError;

      const { data: userData } = await supabase.auth.getUser();

      const { error: versionError } = await supabase
        .from("document_versions")
        .insert({
          document_id: documentId,
          version_number: (versions[0]?.version_number ?? 0) + 1,
          change_type: "rollback",
          change_description: `Rolled back to version ${version.version_number}`,
          summary: version.summary,
          key_facts: version.key_facts,
          ocr_text: version.ocr_text,
          file_url: version.file_url,
          created_by: userData.user?.id || null,
        });

      if (versionError) throw versionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["document-versions", documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setRollbackTargetId(null);
      toast.success("Document rolled back successfully.");
    },
    onError: (e: Error) => {
      toast.error(`Rollback failed: ${e.message}`);
    },
  });

  const toggleExpanded = (versionId: string) => {
    setExpandedVersionId((prev) => (prev === versionId ? null : versionId));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              Viewing version history for{" "}
              <span className="font-medium">{documentName}</span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm">Loading version history...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-sm">Failed to load version history.</p>
              </div>
            )}

            {!isLoading && !error && versions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-sm font-medium">No version history</p>
                <p className="text-xs mt-1">
                  Changes to this document will be tracked here.
                </p>
              </div>
            )}

            {!isLoading && !error && versions.length > 0 && (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />

                <div className="space-y-1">
                  {versions.map((version, index) => {
                    const badgeConfig =
                      changeTypeBadgeConfig[version.change_type] ||
                      changeTypeBadgeConfig.edit;
                    const isExpanded = expandedVersionId === version.id;
                    const isLatest = index === 0;

                    return (
                      <div key={version.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 border-background ${
                            isLatest ? "bg-primary" : "bg-muted-foreground/40"
                          }`}
                        />

                        <div
                          className={`rounded-lg border p-4 transition-colors ${
                            isLatest
                              ? "border-primary/30 bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">
                                  v{version.version_number}
                                </span>
                                <Badge className={badgeConfig.className}>
                                  {badgeConfig.label}
                                </Badge>
                                {isLatest && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-primary/50 text-primary"
                                  >
                                    Current
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span
                                  title={format(
                                    new Date(version.created_at),
                                    "PPpp",
                                  )}
                                >
                                  {formatDistanceToNow(
                                    new Date(version.created_at),
                                    { addSuffix: true },
                                  )}
                                </span>
                              </div>

                              {version.change_description && (
                                <p className="text-sm text-muted-foreground mt-1.5">
                                  {version.change_description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpanded(version.id)}
                                className="h-8 w-8 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              {!isLatest && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setRollbackTargetId(version.id)
                                  }
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-orange-600"
                                  title="Rollback to this version"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <>
                              <Separator className="my-3" />
                              <div className="space-y-3">
                                {version.summary && (
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                      Summary
                                    </p>
                                    <p className="text-sm">
                                      {version.summary}
                                    </p>
                                  </div>
                                )}

                                {version.key_facts &&
                                  version.key_facts.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                        Key Facts
                                      </p>
                                      <ul className="text-sm space-y-1">
                                        {version.key_facts.map((fact, i) => (
                                          <li
                                            key={i}
                                            className="flex items-start gap-2"
                                          >
                                            <span className="text-muted-foreground mt-1">
                                              -
                                            </span>
                                            <span>{fact}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                {version.ocr_text && (
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                      OCR Text Preview
                                    </p>
                                    <div className="bg-muted/50 rounded p-3 max-h-40 overflow-y-auto">
                                      <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {version.ocr_text.length > 2000
                                          ? version.ocr_text.substring(
                                              0,
                                              2000,
                                            ) + "..."
                                          : version.ocr_text}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                {!version.summary &&
                                  !version.key_facts?.length &&
                                  !version.ocr_text && (
                                    <p className="text-sm text-muted-foreground italic">
                                      No detailed content stored for this
                                      version.
                                    </p>
                                  )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Rollback confirmation */}
      <AlertDialog
        open={!!rollbackTargetId}
        onOpenChange={(open) => {
          if (!open) setRollbackTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback this document to version{" "}
              <span className="font-semibold">
                v
                {versions.find((v) => v.id === rollbackTargetId)
                  ?.version_number ?? "?"}
              </span>
              ? This will restore the document's content to that version. A new
              version entry will be created to record this rollback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rollbackTargetId) {
                  rollbackMutation.mutate(rollbackTargetId);
                }
              }}
              disabled={rollbackMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {rollbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Rolling back...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rollback
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
