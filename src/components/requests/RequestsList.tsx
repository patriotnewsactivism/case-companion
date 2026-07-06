import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Inbox } from "lucide-react";
import { RequestCard } from "./RequestCard";
import {
  REQUEST_CATEGORY_LABELS,
  type OutboundRequest,
  type RequestCategory,
} from "@/lib/outbound-requests-api";

type CategoryFilter = RequestCategory | "all";

interface RequestsListProps {
  requests: OutboundRequest[];
  selectedId?: string;
  isLoading?: boolean;
  onSelect: (request: OutboundRequest) => void;
}

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "public_records", label: "Records" },
  { value: "discovery_demand", label: "Discovery" },
  { value: "preservation_letter", label: "Preserve" },
  { value: "subpoena", label: "Subpoenas" },
];

export function RequestsList({ requests, selectedId, isLoading, onSelect }: RequestsListProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? requests : requests.filter((r) => r.requestCategory === filter)),
    [requests, filter]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Requests</CardTitle>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as CategoryFilter)}>
          <TabsList className="grid w-full grid-cols-5">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="text-xs">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8" />
            <p>
              No {filter === "all" ? "requests" : REQUEST_CATEGORY_LABELS[filter as RequestCategory]} yet.
            </p>
            <p>Click “New Request” to draft one.</p>
          </div>
        ) : (
          filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              selected={request.id === selectedId}
              onClick={() => onSelect(request)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
