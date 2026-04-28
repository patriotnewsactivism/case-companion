/**
 * useAutoAnalysis – Automatically triggers OCR + AI analysis after document upload,
 * then runs Document Intelligence for auto-naming, dating, and classification.
 *
 * When a document is uploaded, it gets queued here. This hook:
 *   1. Calls the `ocr-document` edge function (OCR → AI analysis → timeline → DB)
 *   2. Runs documentIntelligence to auto-name, classify, and date the document
 *   3. Invalidates React Query caches so the UI updates
 *
 * Usage:
 *   const { enqueueForAnalysis, analysisQueue, isProcessing } = useAutoAnalysis(caseId);
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { runDocumentIntelligence } from "@/services/documentIntelligence";

interface QueueItem {
  documentId: string;
  fileName: string;
  fileUrl: string;
  status: "pending" | "processing" | "analyzing" | "done" | "failed";
  error?: string;
  timelineEventsInserted?: number;
  suggestedName?: string;
  documentType?: string;
  documentDate?: string | null;
}

interface UseAutoAnalysisReturn {
  /** Enqueue a document for automatic analysis right after upload */
  enqueueForAnalysis: (docId: string, fileName: string, fileUrl: string) => void;
  /** Current analysis queue items */
  analysisQueue: QueueItem[];
  /** Whether the analysis loop is currently processing */
  isProcessing: boolean;
  /** Number of documents waiting or processing */
  pendingCount: number;
  /** Number of documents that completed successfully */
  completedCount: number;
  /** Number of documents that failed */
  failedCount: number;
}

export function useAutoAnalysis(caseId: string | undefined): UseAutoAnalysisReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const queryClient = useQueryClient();

  const enqueueForAnalysis = useCallback(
    (docId: string, fileName: string, fileUrl: string) => {
      setQueue((prev) => {
        // Deduplicate
        if (prev.some((q) => q.documentId === docId)) return prev;
        return [
          ...prev,
          { documentId: docId, fileName, fileUrl, status: "pending" as const },
        ];
      });
    },
    []
  );

  // Process queue sequentially
  useEffect(() => {
    if (!caseId) return;
    const pendingItems = queue.filter((q) => q.status === "pending");
    if (pendingItems.length === 0 || processingRef.current) return;

    const processNext = async () => {
      const item = pendingItems[0];
      if (!item) return;

      processingRef.current = true;
      setIsProcessing(true);

      // Mark as processing (OCR phase)
      setQueue((prev) =>
        prev.map((q) =>
          q.documentId === item.documentId ? { ...q, status: "processing" as const } : q
        )
      );

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // ── Step 1: Call ocr-document edge function ──
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
        const response = await fetch(functionUrl, {
          method: "POST",
          mode: "cors",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            documentId: item.documentId,
            fileUrl: item.fileUrl,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // ── Step 2: Run Document Intelligence (auto-name, classify, date) ──
        setQueue((prev) =>
          prev.map((q) =>
            q.documentId === item.documentId ? { ...q, status: "analyzing" as const } : q
          )
        );

        let intelligence = { suggestedName: item.fileName, documentType: "unknown", documentDate: null as string | null };

        try {
          // Get the OCR text from the document (it was just saved by the edge function)
          const { data: docData } = await (supabase as any)
            .from("documents")
            .select("ocr_text, summary, key_facts, entities")
            .eq("id", item.documentId)
            .single();

          if (docData?.ocr_text) {
            intelligence = await runDocumentIntelligence(
              item.documentId,
              docData.ocr_text,
              docData.summary || data.summary,
              docData.key_facts || data.keyFacts,
              data.timelineEvents || [],
              docData.entities || []
            );
          }
        } catch (intErr) {
          console.warn(`Document intelligence failed for ${item.fileName}:`, intErr);
          // Non-fatal — OCR and analysis still succeeded
        }

        setQueue((prev) =>
          prev.map((q) =>
            q.documentId === item.documentId
              ? {
                  ...q,
                  status: "done" as const,
                  timelineEventsInserted: data.timelineEventsInserted ?? 0,
                  suggestedName: intelligence.suggestedName,
                  documentType: intelligence.documentType,
                  documentDate: intelligence.documentDate,
                }
              : q
          )
        );

        // Invalidate queries so UI reflects new analysis + timeline + intelligence
        queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
        queryClient.invalidateQueries({ queryKey: ["timeline_events", caseId] });
        queryClient.invalidateQueries({ queryKey: ["case_stats", caseId] });
        queryClient.invalidateQueries({ queryKey: ["case_knowledge", caseId] });
      } catch (err) {
        console.error(`Auto-analysis failed for ${item.fileName}:`, err);
        setQueue((prev) =>
          prev.map((q) =>
            q.documentId === item.documentId
              ? {
                  ...q,
                  status: "failed" as const,
                  error: err instanceof Error ? err.message : "Unknown error",
                }
              : q
          )
        );
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    };

    processNext();
  }, [caseId, queue, queryClient]);

  const pendingCount = queue.filter(
    (q) => q.status === "pending" || q.status === "processing" || q.status === "analyzing"
  ).length;

  const completedCount = queue.filter((q) => q.status === "done").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;

  return {
    enqueueForAnalysis,
    analysisQueue: queue,
    isProcessing,
    pendingCount,
    completedCount,
    failedCount,
  };
}
