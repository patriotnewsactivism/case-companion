import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileText, Send, ShieldAlert, Gavel } from "lucide-react";
import {
  REQUEST_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  type OutboundRequest,
  type RequestCategory,
} from "@/lib/outbound-requests-api";

const CATEGORY_ICON: Record<RequestCategory, typeof FileText> = {
  public_records: FileText,
  discovery_demand: Send,
  preservation_letter: ShieldAlert,
  subpoena: Gavel,
};

interface RequestCardProps {
  request: OutboundRequest;
  selected?: boolean;
  onClick?: () => void;
}

export function RequestCard({ request, selected, onClick }: RequestCardProps) {
  const Icon = CATEGORY_ICON[request.requestCategory] || FileText;
  const due = request.responseDueDate ? new Date(`${request.responseDueDate}T00:00:00`) : null;
  const overdue =
    due && ["sent", "acknowledged", "partial", "appealed"].includes(request.status)
      ? due.getTime() < Date.now()
      : false;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
        selected && "border-primary ring-1 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium">{request.title || "Untitled Request"}</div>
            <div className="truncate text-xs text-muted-foreground">
              {REQUEST_CATEGORY_LABELS[request.requestCategory]}
              {request.recipientAgency ? ` · ${request.recipientAgency}` : ""}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0", REQUEST_STATUS_COLORS[request.status])}>
          {REQUEST_STATUS_LABELS[request.status]}
        </Badge>
      </div>
      {request.responseDueDate && (
        <div className={cn("mt-2 text-xs", overdue ? "font-medium text-red-600" : "text-muted-foreground")}>
          {overdue ? "Overdue · " : "Response due · "}
          {request.responseDueDate}
        </div>
      )}
    </button>
  );
}
