import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Plus, Loader2, DollarSign, Timer, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { getTimeEntries, createTimeEntry, deleteTimeEntry, getBillingSummary, type TimeEntry, type CreateTimeEntryInput } from "@/lib/premium-api";
import { format } from "date-fns";

interface BillableHoursProps {
  caseId?: string;
}

export function BillableHours({ caseId }: BillableHoursProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInterval, setTimerIntervalState] = useState<ReturnType<typeof setInterval> | null>(null);
  
  const [formData, setFormData] = useState<CreateTimeEntryInput>({
    case_id: caseId || "",
    description: "",
    duration_minutes: 0,
    hourly_rate: 350,
    billable: true,
    entry_date: new Date().toISOString().split('T')[0],
    notes: "",
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
    enabled: !caseId,
  });

  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ["time-entries", caseId],
    queryFn: () => getTimeEntries(caseId),
  });

  const { data: billingSummary } = useQuery({
    queryKey: ["billing-summary", caseId],
    queryFn: () => getBillingSummary(caseId),
  });

  const createMutation = useMutation({
    mutationFn: createTimeEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Time Entry Created", description: "Your billable time has been logged." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimeEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      toast({ title: "Entry Deleted", description: "Time entry has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      case_id: caseId || "",
      description: "",
      duration_minutes: 0,
      hourly_rate: 350,
      billable: true,
      entry_date: new Date().toISOString().split('T')[0],
      notes: "",
    });
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerIntervalState(null);
    }
    setTimerRunning(false);
    setTimerSeconds(0);
  };

  const startTimer = () => {
    if (timerRunning) {
      // Stop timer
      if (timerInterval) clearInterval(timerInterval);
      setTimerRunning(false);
      setFormData(prev => ({ ...prev, duration_minutes: Math.ceil(timerSeconds / 60) }));
    } else {
      // Start timer
      setTimerRunning(true);
      const interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
      setTimerIntervalState(interval);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: TimeEntry['status']) => {
    const styles = {
      unbilled: "bg-amber-500/10 text-amber-500",
      billed: "bg-blue-500/10 text-blue-500",
      paid: "bg-green-500/10 text-green-500",
      written_off: "bg-gray-500/10 text-gray-500",
    };
    return <Badge className={styles[status]}>{status}</Badge>;
  };

  const handleSubmit = () => {
    if (!formData.case_id || !formData.description) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {billingSummary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Total Hours</span>
              </div>
              <p className="text-2xl font-bold mt-1">{billingSummary.totalHours}h</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4" />
                <span className="text-sm">Billable Hours</span>
              </div>
              <p className="text-2xl font-bold mt-1">{billingSummary.billableHours}h</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-amber-500">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Unbilled</span>
              </div>
              <p className="text-2xl font-bold mt-1">${billingSummary.unbilledAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-500">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Collected</span>
              </div>
              <p className="text-2xl font-bold mt-1">${billingSummary.paidAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Time Entries Table */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              Billable Hours
            </CardTitle>
            <CardDescription>Track your time for accurate billing</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Log Time
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Log Time Entry</DialogTitle>
                <DialogDescription>Record billable time for a case</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Timer */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-mono">{formatTime(timerSeconds)}</div>
                  <Button variant={timerRunning ? "destructive" : "default"} onClick={startTimer}>
                    {timerRunning ? "Stop" : "Start Timer"}
                  </Button>
                </div>

                {!caseId && (
                  <div className="space-y-2">
                    <Label>Case *</Label>
                    <Select value={formData.case_id} onValueChange={(v) => setFormData({ ...formData, case_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a case" />
                      </SelectTrigger>
                      <SelectContent>
                        {cases.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Input
                    placeholder="Review discovery documents..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Billable</Label>
                  <Switch
                    checked={formData.billable}
                    onCheckedChange={(checked) => setFormData({ ...formData, billable: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="p-3 bg-accent/10 rounded-lg text-sm">
                  <p className="font-medium">Estimated Value</p>
                  <p className="text-2xl font-bold">
                    ${((formData.duration_minutes / 60) * (formData.hourly_rate || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries yet</p>
              <p className="text-sm">Start tracking your billable hours</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.entry_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                    <TableCell className="text-right">{(entry.duration_minutes / 60).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${entry.hourly_rate}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${((entry.duration_minutes / 60) * entry.hourly_rate).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
