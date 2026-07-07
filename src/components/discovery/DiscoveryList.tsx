import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileSearch,
  Filter,
  Download,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { DiscoveryRequest, DiscoveryType, DiscoveryStatus } from "@/lib/discovery-api";
import { DISCOVERY_TYPE_LABELS, DISCOVERY_STATUS_COLORS } from "@/lib/discovery-api";

interface DiscoveryListProps {
  requests: DiscoveryRequest[];
  onSelectRequest: (request: DiscoveryRequest) => void;
  onBulkUpdate: (ids: string[], status: DiscoveryStatus) => Promise<void>;
  onExportPdf?: () => void;
  isLoading?: boolean;
}

export function DiscoveryList({
  requests,
  onSelectRequest,
  onBulkUpdate,
  onExportPdf,
  isLoading = false,
}: DiscoveryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DiscoveryStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DiscoveryType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'created' | 'number'>('dueDate');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter((req) => {
      const matchesSearch = !searchQuery || 
        req.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.response?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesType = typeFilter === 'all' || req.requestType === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.responseDueDate) return 1;
          if (!b.responseDueDate) return -1;
          return new Date(a.responseDueDate).getTime() - new Date(b.responseDueDate).getTime();
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'number':
          return a.requestNumber.localeCompare(b.requestNumber);
        default:
          return 0;
      }
    });
  }, [requests, searchQuery, statusFilter, typeFilter, sortBy]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkUpdate = async (status: DiscoveryStatus) => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await onBulkUpdate(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusIcon = (status: DiscoveryStatus) => {
    switch (status) {
      case 'overdue':
        return <AlertCircle className="h-3 w-3" />;
      case 'responded':
        return <CheckCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Discovery Requests
              <Badge variant="secondary" className="font-normal">
                {filteredRequests.length} of {requests.length}
              </Badge>
            </CardTitle>
            {onExportPdf && (
              <Button variant="outline" size="sm" onClick={onExportPdf} className="gap-1">
                <Download className="h-3 w-3" />
                Export PDF
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Due Date</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DiscoveryStatus | 'all')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="objected">Objected</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DiscoveryType | 'all')}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="interrogatory">Interrogatories</SelectItem>
                  <SelectItem value="request_for_production">RFP</SelectItem>
                  <SelectItem value="request_for_admission">RFA</SelectItem>
                  <SelectItem value="deposition">Depositions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-md">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkUpdate('responded')}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Mark Responded
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkUpdate('objected')}
              disabled={isBulkUpdating}
            >
              Mark Objected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No discovery requests found</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground border-b">
              <Checkbox
                checked={selectedIds.size === filteredRequests.length && filteredRequests.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="w-20">Number</span>
              <span className="flex-1">Question</span>
              <span className="w-20 text-center">Type</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-24 text-right">Due</span>
            </div>

            {filteredRequests.map((request) => {
              const days = getDaysRemaining(request.responseDueDate);
              
              return (
                <div
                  key={request.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-3 rounded-md cursor-pointer transition-colors hover:bg-muted/50",
                    selectedIds.has(request.id) && "bg-muted/50"
                  )}
                  onClick={() => onSelectRequest(request)}
                >
                  <Checkbox
                    checked={selectedIds.has(request.id)}
                    onCheckedChange={() => toggleSelect(request.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="w-20 font-mono text-xs">{request.requestNumber}</span>
                  <span className="flex-1 text-sm truncate">{request.question}</span>
                  <Badge variant="outline" className="w-20 justify-center text-xs">
                    {DISCOVERY_TYPE_LABELS[request.requestType]?.split(' ')[0]}
                  </Badge>
                  <Badge className={cn("w-20 justify-center text-xs gap-1", DISCOVERY_STATUS_COLORS[request.status])}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </Badge>
                  <div className="w-24 text-right">
                    {days !== null && (
                      <span className={cn(
                        "text-xs",
                        days < 0 ? "text-red-600 font-medium" : days === 0 ? "text-yellow-600 font-medium" : "text-muted-foreground"
                      )}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
