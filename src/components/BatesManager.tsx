/**
 * BatesManager — View, review, and reorder Bates numbers for case documents.
 *
 * Features:
 * - View all documents with current Bates numbers, types, dates
 * - Preview chronological reorder before applying
 * - Safety warnings when changing existing Bates numbers
 * - Sort by Bates number, date, type, or name
 */

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle,
  Clock,
  FileText,
  Hash,
  Loader2,
  RefreshCcw,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reorderBatesChronologically, BatesReorderResult, BatesDocument } from "@/services/documentIntelligence";
import { useToast } from "@/hooks/use-toast";

interface BatesManagerProps {
  caseId: string;
}

type SortField = "bates" | "date" | "type" | "name";
type SortDir = "asc" | "desc";

export function BatesManager({ caseId }: BatesManagerProps) {
  const [documents, setDocuments] = useState<BatesDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batesPrefix, setBatesPrefix] = useState("DOC");
  const [previewResult, setPreviewResult] = useState<BatesReorderResult | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("bates");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("documents")
        .select("id, name, bates_number, document_date, document_type, created_at, ai_suggested_name")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setDocuments(data || []);

      // Detect existing prefix
      if (data && data.length > 0) {
        const firstBates = data.find((d: any) => d.bates_number)?.bates_number;
        if (firstBates) {
          const prefix = firstBates.replace(/-\d+$/, "");
          if (prefix) setBatesPrefix(prefix);
        }
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const sortedDocuments = [...documents].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "bates":
        return dir * (a.bates_number || "ZZZZ").localeCompare(b.bates_number || "ZZZZ");
      case "date":
        return dir * (a.document_date || "9999").localeCompare(b.document_date || "9999");
      case "type":
        return dir * (a.document_type || "zzz").localeCompare(b.document_type || "zzz");
      case "name":
        return dir * (a.ai_suggested_name || a.name).localeCompare(b.ai_suggested_name || b.name);
      default:
        return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      // Simulate the reorder without persisting
      const result = await simulateReorder(documents, batesPrefix);
      setPreviewResult(result);
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApplyReorder = async () => {
    setIsReordering(true);
    try {
      const result = await reorderBatesChronologically(caseId, batesPrefix);
      toast({
        title: "Bates numbers reordered",
        description: `${result.reorderedCount} document(s) updated to chronological order.`,
      });
      setPreviewResult(null);
      await fetchDocuments();
    } catch (err) {
      toast({
        title: "Reorder failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  const analyzedCount = documents.filter((d) => d.document_date).length;
  const totalCount = documents.length;
  const unanalyzedCount = totalCount - analyzedCount;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-600 mr-2" />
          <span>Loading documents...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-gold-600" />
            Bates Number Manager
          </CardTitle>
          <CardDescription>
            View, manage, and reorder Bates numbers for all case documents.
            Chronological ordering places documents by their detected date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {totalCount} documents
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-green-600" />
                {analyzedCount} dated
              </span>
              {unanalyzedCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  {unanalyzedCount} undated
                </span>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2 ml-auto">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Prefix:</label>
                <input
                  type="text"
                  value={batesPrefix}
                  onChange={(e) => setBatesPrefix(e.target.value.toUpperCase())}
                  className="w-20 px-2 py-1 border rounded text-sm"
                  maxLength={10}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={isPreviewing || documents.length === 0}
              >
                {isPreviewing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                )}
                Preview Chronological Reorder
              </Button>
              <Button variant="outline" size="sm" onClick={fetchDocuments}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      {previewResult && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Reorder Preview — {previewResult.changes.length} changes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Warnings */}
            {previewResult.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-100 p-2 rounded">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}

            {/* Changes table */}
            {previewResult.changes.length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100">
                    <tr>
                      <th className="px-3 py-1 text-left">Document</th>
                      <th className="px-3 py-1 text-left">Current Bates</th>
                      <th className="px-3 py-1 text-left">→ New Bates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.changes.map((change) => (
                      <tr key={change.documentId} className="border-b border-amber-200">
                        <td className="px-3 py-1 truncate max-w-[200px]">{change.name}</td>
                        <td className="px-3 py-1 font-mono text-xs">{change.oldBates || "—"}</td>
                        <td className="px-3 py-1 font-mono text-xs text-green-700">{change.newBates}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPreviewResult(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleApplyReorder}
                disabled={isReordering}
              >
                {isReordering ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Apply Reorder ({previewResult.changes.length} changes)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card>
        <CardContent className="pt-4">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No documents in this case yet.</p>
              <p className="text-sm">Upload documents to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th
                      className="px-3 py-2 text-left cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort("bates")}
                    >
                      Bates # {sortField === "bates" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-3 py-2 text-left cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort("name")}
                    >
                      Document {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-3 py-2 text-left cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort("type")}
                    >
                      Type {sortField === "type" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-3 py-2 text-left cursor-pointer hover:bg-muted/80"
                      onClick={() => toggleSort("date")}
                    >
                      Date {sortField === "date" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">
                        {doc.bates_number || (
                          <span className="text-muted-foreground italic">none</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate max-w-[300px]">
                          {doc.ai_suggested_name || doc.name}
                        </div>
                        {doc.ai_suggested_name && doc.ai_suggested_name !== doc.name && (
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            Original: {doc.name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {doc.document_type ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                            {formatDocType(doc.document_type)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {doc.document_date || (
                          <span className="text-muted-foreground">undated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDocType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Simulate a Bates reorder without writing to the database.
 * Returns the same shape as the real reorder for preview purposes.
 */
async function simulateReorder(
  documents: BatesDocument[],
  batesPrefix: string
): Promise<BatesReorderResult> {
  const warnings: string[] = [];

  const existingBatesWithDifferentPrefix = documents.filter(
    (d) => d.bates_number && !d.bates_number.startsWith(batesPrefix)
  );
  if (existingBatesWithDifferentPrefix.length > 0) {
    warnings.push(
      `⚠️ ${existingBatesWithDifferentPrefix.length} document(s) have Bates numbers with a different prefix. They will be renumbered with prefix "${batesPrefix}".`
    );
  }

  const docsWithExistingBates = documents.filter((d) => d.bates_number);
  if (docsWithExistingBates.length > 0) {
    warnings.push(
      `⚠️ ${docsWithExistingBates.length} document(s) already have Bates numbers. Renumbering will change them. If these numbers have been used in filings, depositions, or correspondence, this could cause confusion.`
    );
  }

  const sorted = [...documents].sort((a, b) => {
    const dateA = a.document_date || "";
    const dateB = b.document_date || "";
    if (dateA && dateB) return dateA.localeCompare(dateB);
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  const changes: BatesReorderResult["changes"] = [];
  for (let i = 0; i < sorted.length; i++) {
    const doc = sorted[i];
    const newBates = `${batesPrefix}-${String(i + 1).padStart(4, "0")}`;
    if (doc.bates_number !== newBates) {
      changes.push({
        documentId: doc.id,
        oldBates: doc.bates_number,
        newBates,
        name: doc.ai_suggested_name || doc.name,
      });
    }
  }

  const undatedCount = sorted.filter((d) => !d.document_date).length;
  if (undatedCount > 0) {
    warnings.push(
      `ℹ️ ${undatedCount} document(s) have no detected date — they will be placed at the end in upload order. Run AI analysis first for better ordering.`
    );
  }

  return { reorderedCount: changes.length, changes, warnings };
}
