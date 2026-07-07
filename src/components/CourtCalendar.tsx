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
import { Calendar, Plus, Loader2, MapPin, Clock, Gavel, AlertCircle, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { getCourtDates, createCourtDate, deleteCourtDate, getUpcomingCourtDates, type CourtDate, type CreateCourtDateInput } from "@/lib/premium-api";
import { format, differenceInDays, isPast, isToday } from "date-fns";

interface CourtCalendarProps {
  caseId?: string;
  showUpcoming?: boolean;
}

const EVENT_TYPES = [
  { value: 'hearing', label: 'Hearing' },
  { value: 'trial', label: 'Trial' },
  { value: 'motion', label: 'Motion' },
  { value: 'deposition', label: 'Deposition' },
  { value: 'filing_deadline', label: 'Filing Deadline' },
  { value: 'discovery_deadline', label: 'Discovery Deadline' },
  { value: 'mediation', label: 'Mediation' },
  { value: 'conference', label: 'Conference' },
  { value: 'other', label: 'Other' },
] as const;

export function CourtCalendar({ caseId, showUpcoming = false }: CourtCalendarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<CreateCourtDateInput>({
    case_id: caseId || "",
    title: "",
    event_type: 'hearing',
    event_date: new Date().toISOString().split('T')[0],
    all_day: false,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
    enabled: !caseId,
  });

  const { data: courtDates = [], isLoading } = useQuery({
    queryKey: showUpcoming ? ["upcoming-court-dates"] : ["court-dates", caseId],
    queryFn: () => showUpcoming ? getUpcomingCourtDates(60) : getCourtDates(caseId),
  });

  const createMutation = useMutation({
    mutationFn: createCourtDate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-dates"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-court-dates"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Court Date Added", description: "Event has been added to your calendar." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourtDate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-dates"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-court-dates"] });
      toast({ title: "Event Deleted", description: "Court date has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      case_id: caseId || "",
      title: "",
      event_type: 'hearing',
      event_date: new Date().toISOString().split('T')[0],
      all_day: false,
    });
  };

  const getEventBadge = (type: CourtDate['event_type']) => {
    const styles: Record<string, string> = {
      hearing: "bg-blue-500/10 text-blue-500",
      trial: "bg-red-500/10 text-red-500",
      motion: "bg-purple-500/10 text-purple-500",
      deposition: "bg-amber-500/10 text-amber-500",
      filing_deadline: "bg-orange-500/10 text-orange-500",
      discovery_deadline: "bg-yellow-500/10 text-yellow-500",
      mediation: "bg-green-500/10 text-green-500",
      conference: "bg-cyan-500/10 text-cyan-500",
      other: "bg-gray-500/10 text-gray-500",
    };
    return <Badge className={styles[type] || styles.other}>{type.replace('_', ' ')}</Badge>;
  };

  const getUrgencyIndicator = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const daysUntil = differenceInDays(eventDate, new Date());
    
    if (isPast(eventDate) && !isToday(eventDate)) {
      return <Badge variant="destructive">Past Due</Badge>;
    }
    if (isToday(eventDate)) {
      return <Badge className="bg-red-500 text-white animate-pulse">Today</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge className="bg-red-500/10 text-red-500">{daysUntil} days</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge className="bg-amber-500/10 text-amber-500">{daysUntil} days</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-500">{daysUntil} days</Badge>;
  };

  const handleSubmit = () => {
    if (!formData.case_id || !formData.title || !formData.event_date) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-accent" />
            {showUpcoming ? "Upcoming Court Dates" : "Court Calendar"}
          </CardTitle>
          <CardDescription>
            {showUpcoming ? "Important dates in the next 60 days" : "Manage hearings, trials, and deadlines"}
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Court Date</DialogTitle>
              <DialogDescription>Schedule a hearing, trial, or deadline</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                <Label>Title *</Label>
                <Input
                  placeholder="Motion Hearing - Summary Judgment"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Event Type *</Label>
                <Select 
                  value={formData.event_type} 
                  onValueChange={(v) => setFormData({ ...formData, event_type: v as CourtDate['event_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.start_time || ""}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    disabled={formData.all_day}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>All Day Event</Label>
                <Switch
                  checked={formData.all_day}
                  onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="123 Main St, Courtroom 4B"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Courtroom</Label>
                  <Input
                    placeholder="4B"
                    value={formData.courtroom || ""}
                    onChange={(e) => setFormData({ ...formData, courtroom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Judge</Label>
                  <Input
                    placeholder="Hon. Smith"
                    value={formData.judge_name || ""}
                    onChange={(e) => setFormData({ ...formData, judge_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Preparation notes, documents to bring..."
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Reminder (days before)</Label>
                <Input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.reminder_days || 7}
                  onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) || 7 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Event
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
        ) : courtDates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No court dates scheduled</p>
            <p className="text-sm">Add hearings, trials, and deadlines</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courtDates.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{event.title}</h4>
                    {getEventBadge(event.event_type)}
                    {getUrgencyIndicator(event.event_date)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}
                    </span>
                    {event.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.start_time}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                  {event.judge_name && (
                    <p className="text-xs text-muted-foreground">Judge: {event.judge_name}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(event.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
