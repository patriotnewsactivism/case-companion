/**
 * AnalysisProgressPanel — Shows real-time progress of auto-analysis after upload.
 *
 * Displays each document moving through: OCR → AI Analysis → Intelligence
 * with status indicators, suggested names, and document types as they complete.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Brain,
  Eye,
  Sparkles,
} from "lucide-react";

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

interface AnalysisProgressPanelProps {
  queue: QueueItem[];
  isProcessing: boolean;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
}

const STATUS_CONFIG = {
  pending: {
    icon: FileText,
    label: "Waiting",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  processing: {
    icon: Eye,
    label: "OCR Processing",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  analyzing: {
    icon: Brain,
    label: "AI Analysis",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  done: {
    icon: CheckCircle,
    label: "Complete",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
};

export function AnalysisProgressPanel({
  queue,
  isProcessing,
  pendingCount,
  completedCount,
  failedCount,
}: AnalysisProgressPanelProps) {
  if (queue.length === 0) return null;

  const totalDone = completedCount + failedCount;
  const total = queue.length;
  const progressPercent = total > 0 ? Math.round((totalDone / total) * 100) : 0;
  const allDone = pendingCount === 0 && !isProcessing;

  return (
    <Card className={allDone ? "border-green-300" : "border-blue-300"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {allDone ? (
            <>
              <Sparkles className="h-4 w-4 text-green-600" />
              Analysis Complete — {completedCount}/{total} documents processed
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Analyzing Documents — {totalDone}/{total} ({progressPercent}%)
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              allDone ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Queue items */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {queue.map((item) => {
            const config = STATUS_CONFIG[item.status];
            const Icon = config.icon;

            return (
              <div
                key={item.documentId}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${config.bgColor}`}
              >
                {item.status === "processing" || item.status === "analyzing" ? (
                  <Loader2 className={`h-3.5 w-3.5 animate-spin ${config.color} flex-shrink-0`} />
                ) : (
                  <Icon className={`h-3.5 w-3.5 ${config.color} flex-shrink-0`} />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-medium">
                      {item.status === "done" && item.suggestedName
                        ? item.suggestedName
                        : item.fileName}
                    </span>
                    {item.status === "done" && item.documentType && item.documentType !== "unknown" && (
                      <span className="inline-flex px-1.5 py-0 rounded-full bg-blue-100 text-blue-700 text-[10px] flex-shrink-0">
                        {item.documentType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {item.status === "done" && item.timelineEventsInserted && item.timelineEventsInserted > 0 && (
                    <span className="text-green-700 text-[10px]">
                      +{item.timelineEventsInserted} timeline events
                    </span>
                  )}
                  {item.status === "failed" && item.error && (
                    <span className="text-red-600 text-[10px] truncate block">{item.error}</span>
                  )}
                </div>

                <span className={`text-[10px] ${config.color} flex-shrink-0`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
