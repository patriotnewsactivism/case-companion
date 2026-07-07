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
import { MessageSquare, Plus, Loader2, Mail, Phone, Users, FileText, Clock, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { getCommunications, createCommunication, deleteCommunication, updateCommunication, type ClientCommunication, type CreateCommunicationInput } from "@/lib/premium-api";
import { format } from "date-fns";

interface ClientCommunicationsProps {
  caseId?: string;
}

const COMMUNICATION_TYPES = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'letter', label: 'Letter', icon: FileText },
  { value: 'portal_message', label: 'Portal Message', icon: MessageSquare },
  { value: 'text', label: 'Text Message', icon: MessageSquare },
] as const;

export function ClientCommunications({ caseId }: ClientCommunicationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<CreateCommunicationInput>({
    case_id: caseId || "",
    content: "",
    communication_type: 'email',
    direction: 'outgoing',
    billable: false,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
    enabled: !caseId,
  });

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["communications", caseId],
    queryFn: () => getCommunications(caseId),
  });

  const createMutation = useMutation({
    mutationFn: createCommunication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Communication Logged", description: "Client communication has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCommunication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      toast({ title: "Communication Deleted", description: "Record has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleFollowUpMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => 
      updateCommunication(id, { follow_up_completed: completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      toast({ title: "Follow-up Updated" });
    },
  });

  const resetForm = () => {
    setFormData({
      case_id: caseId || "",
      content: "",
      communication_type: 'email',
      direction: 'outgoing',
      billable: false,
    });
  };

  const getTypeIcon = (type: ClientCommunication['communication_type']) => {
    const found = COMMUNICATION_TYPES.find(t => t.value === type);
    const Icon = found?.icon || MessageSquare;
    return <Icon className="h-4 w-4" />;
  };

  const handleSubmit = () => {
    if (!formData.case_id || !formData.content) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const pendingFollowUps = communications.filter(c => c.follow_up_required && !c.follow_up_completed);

  return (
    <div className="space-y-4">
      {/* Follow-up Alert */}
      {pendingFollowUps.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{pendingFollowUps.length} Pending Follow-ups</span>
            </div>
            <div className="space-y-2">
              {pendingFollowUps.slice(0, 3).map((comm) => (
                <div key={comm.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{comm.subject || comm.content.slice(0, 50)}...</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleFollowUpMutation.mutate({ id: comm.id, completed: true })}
                  >
                    Complete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-accent" />
              Client Communications
            </CardTitle>
            <CardDescription>Track all client interactions and follow-ups</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Log Communication
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Log Communication</DialogTitle>
                <DialogDescription>Record a client interaction</DialogDescription>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={formData.communication_type || 'email'} 
                      onValueChange={(v) => setFormData({ ...formData, communication_type: v as ClientCommunication['communication_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select 
                      value={formData.direction || 'outgoing'} 
                      onValueChange={(v) => setFormData({ ...formData, direction: v as ClientCommunication['direction'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outgoing">Outgoing</SelectItem>
                        <SelectItem value="incoming">Incoming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    placeholder="Brief subject line"
                    value={formData.subject || ""}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Content *</Label>
                  <Textarea
                    placeholder="Summary of the communication..."
                    className="min-h-[100px]"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.duration_minutes || ""}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || undefined })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Follow-up Required</Label>
                  <Switch
                    checked={formData.follow_up_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, follow_up_required: checked })}
                  />
                </div>

                {formData.follow_up_required && (
                  <div className="space-y-2">
                    <Label>Follow-up Date</Label>
                    <Input
                      type="date"
                      value={formData.follow_up_date || ""}
                      onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label>Billable</Label>
                  <Switch
                    checked={formData.billable}
                    onCheckedChange={(checked) => setFormData({ ...formData, billable: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Log Communication
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
          ) : communications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No communications logged</p>
              <p className="text-sm">Track emails, calls, and meetings with clients</p>
            </div>
          ) : (
            <div className="space-y-3">
              {communications.map((comm) => (
                <div
                  key={comm.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-1">
                    {getTypeIcon(comm.communication_type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {comm.subject && <span className="font-medium">{comm.subject}</span>}
                      <Badge variant="outline" className="flex items-center gap-1">
                        {comm.direction === 'incoming' ? (
                          <ArrowDownLeft className="h-3 w-3" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        {comm.direction}
                      </Badge>
                      {comm.billable && <Badge variant="secondary">Billable</Badge>}
                      {comm.follow_up_required && !comm.follow_up_completed && (
                        <Badge className="bg-amber-500/10 text-amber-500">Follow-up</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{comm.content}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{format(new Date(comm.created_at), "MMM d, yyyy h:mm a")}</span>
                      {comm.duration_minutes && <span>{comm.duration_minutes} min</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(comm.id)}
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
    </div>
  );
}
