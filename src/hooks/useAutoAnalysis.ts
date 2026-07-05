/**
 * useAutoAnalysis — Enqueues documents for async OCR + AI analysis via the
 * ocr-queue-processor, then runs Document Intelligence for auto-naming,
 * dating, and classification once processing completes.
 *
 * Flow:
 *   1. Enqueue document to ocr_queue (edge function: action=enqueue)
 *   2. Trigger processing (edge function: action=process, user-scoped)
 *   3. Poll documents table for ocr_processed_at changes
 *   4. When processed, run documentIntelligence and invalidate React Query caches
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { runDocumentIntelligence } from "@/services/documentIntelligence";

interface QueueItem {
  documentId: string;
  fileName: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  suggestedName?: string;
  documentType?: string;
  documentDate?: string | null;
}

interface UseAutoAnalysisReturn {
  enqueueForAnalysis: (docId: string, fileName: string) => void;
  analysisQueue: QueueItem[];
  isProcessing: boolean;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // 2 minutes at 3s intervals

export function useAutoAnalysis(caseId: string | undefined): UseAutoAnalysisReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const queryClient = useQueryClient();

  // Clean up poll timers on unmount
  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  const getFunctionUrl = (fn: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  const enqueueForAnalysis = useCallback(
    (docId: string, fileName: string) => {
      setQueue((prev) => {
        if (prev.some((q) => q.documentId === docId)) return prev;
        return [...prev, { documentId: docId, fileName, status: "pending" as const }];
      });
    },
    []
  );

  // Process queue: enqueue + trigger processor
  useEffect(() => {
    if (!caseId) return;

    const pendingItems = queue.filter((q) => q.status === "pending");
    if (pendingItems.length === 0 || processingRef.current) return;

    const processNext = async () => {
      const item = pendingItems[0];
      if (!item) return;

      processingRef.current = true;
      setIsProcessing(true);

      setQueue((prev) =>
        prev.map((q) =>
          q.documentId === item.documentId ? { ...q, status: "processing" as const } : q
        )
      );

      try {
        const headers = await getAuthHeaders();

        // Step 1: Enqueue to ocr_queue
        const enqueueBody = JSON.stringify({
          action: "enqueue",
          caseId,
          documentIds: [item.documentId],
        });

        const enqueueRes = await fetch(getFunctionUrl("ocr-queue-processor"), {
          method: "POST",
          headers,
          body: enqueueBody,
        });

        if (!enqueueRes.ok) {
          const errText = await enqueueRes.text();
          console.warn(`Enqueue failed for ${item.fileName}: ${errText}`);
        }

        // Step 2: Trigger processing (processes one user-scoped job)
        const processBody = JSON.stringify({ action: "process" });
        const processRes = await fetch(getFunctionUrl("ocr-queue-processor"), {
          method: "POST",
          headers,
          body: processBody,
        });

        if (!processRes.ok) {
          const errText = await processRes.text();
          console.warn(`Process trigger failed for ${item.fileName}: ${errText}`);
        }

        // Step 3: Poll for completion
        const docId = item.documentId;
        const fileName = item.fileName;
        let pollCount = 0;

        const pollTimer = setInterval(async () => {
          pollCount++;
          if (pollCount > MAX_POLL_ATTEMPTS) {
            clearInterval(pollTimer);
            pollTimersRef.current.delete(docId);
            console.warn(`Polling timeout for ${fileName}`);

            setQueue((prev) =>
              prev.map((q) =>
                q.documentId === docId
                  ? { ...q, status: "failed" as const, error: "Processing timed out" }
                  : q
              )
            );
            return;
          }

          try {
            const { data: docData, error } = await supabase
              .from("documents")
              .select("ocr_text, ocr_processed_at, summary, key_facts, entities")
              .eq("id", docId)
              .single();

            if (error || !docData?.ocr_processed_at) return;

            // Document has been processed
            clearInterval(pollTimer);
            pollTimersRef.current.delete(docId);

            // Run document intelligence
            let intelligence = {
              suggestedName: fileName,
              documentType: "unknown" as string,
              documentDate: null as string | null,
            };

            try {
              if (docData.ocr_text) {
                // Use the timeline events extracted from this document to
                // improve document-date detection
                const { data: eventData } = await supabase
                  .from("timeline_events")
                  .select("event_date, title")
                  .eq("linked_document_id", docId)
                  .order("event_date", { ascending: true })
                  .limit(20);

                const timelineEvents = (eventData || []).map((e) => ({
                  date: String(e.event_date).split("T")[0],
                  event: String(e.title || ""),
                }));

                intelligence = await runDocumentIntelligence(
                  docId,
                  docData.ocr_text,
                  docData.summary,
                  docData.key_facts,
                  timelineEvents,
                  docData.entities || []
                );
              }
            } catch (intErr) {
              console.warn(`Document intelligence failed for ${fileName}:`, intErr);
            }

            setQueue((prev) =>
              prev.map((q) =>
                q.documentId === docId
                  ? {
                      ...q,
                      status: "completed" as const,
                      suggestedName: intelligence.suggestedName,
                      documentType: intelligence.documentType,
                      documentDate: intelligence.documentDate,
                    }
                  : q
              )
            );

            // Invalidate caches
            queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
            queryClient.invalidateQueries({ queryKey: ["timeline_events", caseId] });
            queryClient.invalidateQueries({ queryKey: ["case_stats", caseId] });
            queryClient.invalidateQueries({ queryKey: ["case_knowledge", caseId] });
          } catch {
            // Polling error, continue
          }
        }, POLL_INTERVAL_MS);

        pollTimersRef.current.set(docId, pollTimer);
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

  const completedCount = queue.filter((q) => q.status === "completed").length;
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
