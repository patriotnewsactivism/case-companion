/**
 * useAutoAnalysis – Automatically triggers OCR + AI analysis after document upload.
 *
 * When a document is uploaded via the unified upload handler, it gets queued in
 * `processing_queue` but nothing picks the jobs up on the client side. This hook
 * watches for newly-uploaded documents and fires the `ocr-document` edge function
 * which does:  OCR → AI analysis → timeline event extraction → DB persistence.
 *
 * Usage:
 *   const { analysisQueue, isProcessing } = useAutoAnalysis(caseId);
 *
 * The hook de-duplicates by document ID and processes sequentially to avoid
 * hammering the edge function.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface QueueItem {
  documentId: string;
  fileName: string;
  fileUrl: string;
  status: "pending" | "processing" | "done" | "failed";
  error?: string;
  timelineEventsInserted?: number;
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

      // Mark as processing
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

        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-document`;
        const response = await fetch(functionUrl, {
          method: "POST",
          mode: "cors",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

        setQueue((prev) =>
          prev.map((q) =>
            q.documentId === item.documentId
              ? {
                  ...q,
                  status: "done" as const,
                  timelineEventsInserted: data.timelineEventsInserted ?? 0,
                }
              : q
          )
        );

        // Invalidate queries so UI reflects new analysis + timeline
        queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
        queryClient.invalidateQueries({ queryKey: ["timeline_events", caseId] });
        queryClient.invalidateQueries({ queryKey: ["case_stats", caseId] });
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
    (q) => q.status === "pending" || q.status === "processing"
  ).length;

  return { enqueueForAnalysis, analysisQueue: queue, isProcessing, pendingCount };
}
