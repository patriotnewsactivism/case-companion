import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Users, Plus, Loader2, Calendar, MapPin, Video, Phone, User, Trash2, FileText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { getDepositions, createDeposition, deleteDeposition, updateDeposition, type Deposition, type CreateDepositionInput } from "@/lib/premium-api";
import { format } from "date-fns";

interface DepositionManagerProps {
  caseId?: string;
}

const DEPONENT_TYPES = [
  { value: 'party', label: 'Party' },
  { value: 'witness', label: 'Witness' },
  { value: 'expert', label: 'Expert Witness' },
  { value: 'corporate_representative', label: 'Corporate Representative' },
  { value: 'other', label: 'Other' },
] as const;

const LOCATION_TYPES = [
  { value: 'in_person', label: 'In Person', icon: MapPin },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'telephonic', label: 'Telephonic', icon: Phone },
] as const;

export function DepositionManager({ caseId }: DepositionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeposition, setSelectedDeposition] = useState<Deposition | null>(null);
  
  const [formData, setFormData] = useState<CreateDepositionInput>({
    case_id: caseId || "",
    deponent_name: "",
    deponent_type: 'witness',
    location_type: 'in_person',
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
    enabled: !caseId,
  });

  const { data: depositions = [], isLoading } = useQuery({
    queryKey: ["depositions", caseId],
    queryFn: () => getDepositions(caseId),
  });

  const createMutation = useMutation({
    mutationFn: createDeposition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depositions"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Deposition Scheduled", description: "The deposition has been added to your calendar." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeposition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depositions"] });
      toast({ title: "Deposition Deleted", description: "The deposition has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateDeposition>[1] }) => 
      updateDeposition(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depositions"] });
      setSelectedDeposition(null);
      toast({ title: "Deposition Updated", description: "Changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      case_id: caseId || "",
      deponent_name: "",
      deponent_type: 'witness',
      location_type: 'in_person',
    });
  };

  const getStatusBadge = (status: Deposition['status']) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-500/10 text-blue-500",
      in_progress: "bg-amber-500/10 text-amber-500",
      completed: "bg-green-500/10 text-green-500",
      cancelled: "bg-red-500/10 text-red-500",
      postponed: "bg-gray-500/10 text-gray-500",
    };
    return <Badge className={styles[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const getLocationIcon = (type: Deposition['location_type']) => {
    if (type === 'video') return <Video className="h-3 w-3" />;
    if (type === 'telephonic') return <Phone className="h-3 w-3" />;
    return <MapPin className="h-3 w-3" />;
  };

  const handleSubmit = () => {
    if (!formData.case_id || !formData.deponent_name) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Depositions
            </CardTitle>
            <CardDescription>Schedule and manage witness depositions</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Schedule Deposition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Deposition</DialogTitle>
                <DialogDescription>Add a new deposition to your case</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
                  <Label>Deponent Name *</Label>
                  <Input
                    placeholder="John Smith"
                    value={formData.deponent_name}
                    onChange={(e) => setFormData({ ...formData, deponent_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deponent Type</Label>
                    <Select 
                      value={formData.deponent_type || 'witness'} 
                      onValueChange={(v) => setFormData({ ...formData, deponent_type: v as Deposition['deponent_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPONENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Location Type</Label>
                    <Select 
                      value={formData.location_type || 'in_person'} 
                      onValueChange={(v) => setFormData({ ...formData, location_type: v as Deposition['location_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contact Info</Label>
                  <Input
                    placeholder="Phone or address"
                    value={formData.deponent_contact || ""}
                    onChange={(e) => setFormData({ ...formData, deponent_contact: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="deponent@email.com"
                    value={formData.deponent_email || ""}
                    onChange={(e) => setFormData({ ...formData, deponent_email: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.scheduled_date || ""}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_time || ""}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Estimated Duration (hours)</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.duration_estimate_hours || ""}
                    onChange={(e) => setFormData({ ...formData, duration_estimate_hours: parseFloat(e.target.value) || undefined })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="Office address or video link"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Court Reporter</Label>
                    <Input
                      placeholder="Reporter name"
                      value={formData.court_reporter || ""}
                      onChange={(e) => setFormData({ ...formData, court_reporter: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Videographer</Label>
                    <Input
                      placeholder="Videographer name"
                      value={formData.videographer || ""}
                      onChange={(e) => setFormData({ ...formData, videographer: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Schedule
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
          ) : depositions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No depositions scheduled</p>
              <p className="text-sm">Schedule witness and party depositions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {depositions.map((depo) => (
                <div
                  key={depo.id}
                  className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {depo.deponent_name}
                        </h4>
                        {depo.deponent_type && (
                          <Badge variant="outline">{depo.deponent_type.replace('_', ' ')}</Badge>
                        )}
                        {getStatusBadge(depo.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        {depo.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(depo.scheduled_date), "MMM d, yyyy")}
                            {depo.scheduled_time && ` at ${depo.scheduled_time}`}
                          </span>
                        )}
                        {depo.location_type && (
                          <span className="flex items-center gap-1">
                            {getLocationIcon(depo.location_type)}
                            {depo.location_type.replace('_', ' ')}
                          </span>
                        )}
                        {depo.duration_estimate_hours && (
                          <span>Est. {depo.duration_estimate_hours}h</span>
                        )}
                      </div>
                      {depo.location && (
                        <p className="text-xs text-muted-foreground">{depo.location}</p>
                      )}
                      {depo.summary && (
                        <div className="mt-2 p-2 bg-muted/30 rounded text-sm">
                          <p className="font-medium text-xs mb-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Summary
                          </p>
                          <p className="text-muted-foreground">{depo.summary}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {depo.status === 'scheduled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: depo.id, updates: { status: 'completed' } })}
                        >
                          Complete
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(depo.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
