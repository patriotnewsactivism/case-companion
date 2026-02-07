import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, FileText, Scale, Gavel, Trash2, Edit, CheckCircle2, Clock, AlertCircle, Calendar } from "lucide-react";
import {
  getOrCreateChecklist,
  updateChecklist,
  getWitnesses,
  createWitness,
  updateWitness,
  deleteWitness,
  getExhibits,
  createExhibit,
  updateExhibit,
  deleteExhibit,
  getJuryInstructions,
  createJuryInstruction,
  updateJuryInstruction,
  deleteJuryInstruction,
  getMotionsInLimine,
  createMotionInLimine,
  updateMotionInLimine,
  deleteMotionInLimine,
  type TrialPrepChecklist as ChecklistType,
  type WitnessPrep,
  type ExhibitItem,
  type JuryInstruction,
  type MotionInLimine,
} from "@/lib/trial-prep-api";

interface TrialPrepChecklistProps {
  caseId: string;
}

export function TrialPrepChecklist({ caseId }: TrialPrepChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistType | null>(null);
  const [witnesses, setWitnesses] = useState<WitnessPrep[]>([]);
  const [exhibits, setExhibits] = useState<ExhibitItem[]>([]);
  const [instructions, setInstructions] = useState<JuryInstruction[]>([]);
  const [motions, setMotions] = useState<MotionInLimine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("witnesses");

  // Dialog states
  const [witnessDialogOpen, setWitnessDialogOpen] = useState(false);
  const [exhibitDialogOpen, setExhibitDialogOpen] = useState(false);
  const [instructionDialogOpen, setInstructionDialogOpen] = useState(false);
  const [motionDialogOpen, setMotionDialogOpen] = useState(false);
  
  // Edit states
  const [editingWitness, setEditingWitness] = useState<WitnessPrep | null>(null);
  const [editingExhibit, setEditingExhibit] = useState<ExhibitItem | null>(null);
  const [editingInstruction, setEditingInstruction] = useState<JuryInstruction | null>(null);
  const [editingMotion, setEditingMotion] = useState<MotionInLimine | null>(null);

  useEffect(() => {
    loadData();
  }, [caseId]);

  async function loadData() {
    setLoading(true);
    const checklistData = await getOrCreateChecklist(caseId);
    if (checklistData) {
      setChecklist(checklistData);
      const [witnessData, exhibitData, instructionData, motionData] = await Promise.all([
        getWitnesses(checklistData.id),
        getExhibits(checklistData.id),
        getJuryInstructions(checklistData.id),
        getMotionsInLimine(checklistData.id),
      ]);
      setWitnesses(witnessData);
      setExhibits(exhibitData);
      setInstructions(instructionData);
      setMotions(motionData);
    }
    setLoading(false);
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      not_started: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
      scheduled: { variant: "secondary", icon: <Calendar className="h-3 w-3" /> },
      in_progress: { variant: "default", icon: <AlertCircle className="h-3 w-3" /> },
      completed: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      pending: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
      filed: { variant: "secondary", icon: <FileText className="h-3 w-3" /> },
      granted: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      denied: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
      proposed: { variant: "outline", icon: <Clock className="h-3 w-3" /> },
      agreed: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      contested: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
      admitted: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      excluded: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || { variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  // Calculate readiness stats
  const witnessReadiness = witnesses.length > 0 
    ? Math.round((witnesses.filter(w => w.prep_status === 'completed').length / witnesses.length) * 100)
    : 0;
  const exhibitReadiness = exhibits.length > 0
    ? Math.round((exhibits.filter(e => e.status === 'admitted' || e.status === 'marked').length / exhibits.length) * 100)
    : 0;
  const instructionReadiness = instructions.length > 0
    ? Math.round((instructions.filter(i => i.status === 'agreed' || i.status === 'given').length / instructions.length) * 100)
    : 0;
  const motionReadiness = motions.length > 0
    ? Math.round((motions.filter(m => m.status === 'granted' || m.status === 'denied').length / motions.length) * 100)
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading trial prep checklist...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Readiness Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Witnesses</span>
            </div>
            <div className="text-2xl font-bold">{witnessReadiness}%</div>
            <div className="text-xs text-muted-foreground">{witnesses.filter(w => w.prep_status === 'completed').length}/{witnesses.length} prepared</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Exhibits</span>
            </div>
            <div className="text-2xl font-bold">{exhibitReadiness}%</div>
            <div className="text-xs text-muted-foreground">{exhibits.filter(e => e.status === 'admitted' || e.status === 'marked').length}/{exhibits.length} ready</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Jury Instructions</span>
            </div>
            <div className="text-2xl font-bold">{instructionReadiness}%</div>
            <div className="text-xs text-muted-foreground">{instructions.filter(i => i.status === 'agreed' || i.status === 'given').length}/{instructions.length} settled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Motions in Limine</span>
            </div>
            <div className="text-2xl font-bold">{motionReadiness}%</div>
            <div className="text-xs text-muted-foreground">{motions.filter(m => m.status === 'granted' || m.status === 'denied').length}/{motions.length} decided</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Preparation Checklist</CardTitle>
          <CardDescription>Track all elements needed for trial readiness</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="witnesses" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Witnesses</span>
              </TabsTrigger>
              <TabsTrigger value="exhibits" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Exhibits</span>
              </TabsTrigger>
              <TabsTrigger value="instructions" className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                <span className="hidden sm:inline">Jury Instructions</span>
              </TabsTrigger>
              <TabsTrigger value="motions" className="flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                <span className="hidden sm:inline">Motions</span>
              </TabsTrigger>
            </TabsList>

            {/* Witnesses Tab */}
            <TabsContent value="witnesses" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Witness Preparation</h3>
                <WitnessDialog
                  open={witnessDialogOpen}
                  onOpenChange={setWitnessDialogOpen}
                  witness={editingWitness}
                  checklistId={checklist?.id || ""}
                  onSave={async (data) => {
                    if (editingWitness) {
                      await updateWitness(editingWitness.id, data);
                      toast.success("Witness updated");
                    } else {
                      await createWitness(checklist?.id || "", data);
                      toast.success("Witness added");
                    }
                    setEditingWitness(null);
                    loadData();
                  }}
                  onClose={() => setEditingWitness(null)}
                />
              </div>
              <div className="space-y-3">
                {witnesses.map((witness) => (
                  <Card key={witness.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{witness.witness_name}</span>
                            <Badge variant="outline">{witness.witness_type}</Badge>
                            {getStatusBadge(witness.prep_status)}
                          </div>
                          {witness.testimony_summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{witness.testimony_summary}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {witness.prep_date && <span>Prep date: {new Date(witness.prep_date).toLocaleDateString()}</span>}
                            {witness.order_of_appearance && <span>Order: #{witness.order_of_appearance}</span>}
                            {witness.subpoena_served && <Badge variant="secondary" className="text-xs">Subpoena Served</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingWitness(witness);
                              setWitnessDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await deleteWitness(witness.id);
                              toast.success("Witness removed");
                              loadData();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {witnesses.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No witnesses added yet. Click "Add Witness" to get started.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Exhibits Tab */}
            <TabsContent value="exhibits" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Exhibit List</h3>
                <ExhibitDialog
                  open={exhibitDialogOpen}
                  onOpenChange={setExhibitDialogOpen}
                  exhibit={editingExhibit}
                  checklistId={checklist?.id || ""}
                  onSave={async (data) => {
                    if (editingExhibit) {
                      await updateExhibit(editingExhibit.id, data);
                      toast.success("Exhibit updated");
                    } else {
                      await createExhibit(checklist?.id || "", data);
                      toast.success("Exhibit added");
                    }
                    setEditingExhibit(null);
                    loadData();
                  }}
                  onClose={() => setEditingExhibit(null)}
                />
              </div>
              <div className="space-y-3">
                {exhibits.map((exhibit) => (
                  <Card key={exhibit.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Exhibit {exhibit.exhibit_number}</span>
                            <Badge variant="outline">{exhibit.exhibit_type}</Badge>
                            {getStatusBadge(exhibit.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{exhibit.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {exhibit.foundation_witness && <span>Foundation: {exhibit.foundation_witness}</span>}
                            {exhibit.objection_anticipated && (
                              <Badge variant="destructive" className="text-xs">Objection Expected</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingExhibit(exhibit);
                              setExhibitDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await deleteExhibit(exhibit.id);
                              toast.success("Exhibit removed");
                              loadData();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {exhibits.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No exhibits added yet. Click "Add Exhibit" to get started.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Jury Instructions Tab */}
            <TabsContent value="instructions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Jury Instructions</h3>
                <JuryInstructionDialog
                  open={instructionDialogOpen}
                  onOpenChange={setInstructionDialogOpen}
                  instruction={editingInstruction}
                  checklistId={checklist?.id || ""}
                  onSave={async (data) => {
                    if (editingInstruction) {
                      await updateJuryInstruction(editingInstruction.id, data);
                      toast.success("Instruction updated");
                    } else {
                      await createJuryInstruction(checklist?.id || "", data);
                      toast.success("Instruction added");
                    }
                    setEditingInstruction(null);
                    loadData();
                  }}
                  onClose={() => setEditingInstruction(null)}
                />
              </div>
              <div className="space-y-3">
                {instructions.map((instruction) => (
                  <Card key={instruction.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {instruction.instruction_number && (
                              <span className="font-medium">#{instruction.instruction_number}</span>
                            )}
                            <Badge variant="outline">{instruction.instruction_type}</Badge>
                            {getStatusBadge(instruction.status)}
                          </div>
                          <p className="text-sm line-clamp-3">{instruction.instruction_text}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {instruction.source && <span>Source: {instruction.source}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingInstruction(instruction);
                              setInstructionDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await deleteJuryInstruction(instruction.id);
                              toast.success("Instruction removed");
                              loadData();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {instructions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No jury instructions added yet. Click "Add Instruction" to get started.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Motions in Limine Tab */}
            <TabsContent value="motions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Motions in Limine</h3>
                <MotionDialog
                  open={motionDialogOpen}
                  onOpenChange={setMotionDialogOpen}
                  motion={editingMotion}
                  checklistId={checklist?.id || ""}
                  onSave={async (data) => {
                    if (editingMotion) {
                      await updateMotionInLimine(editingMotion.id, data);
                      toast.success("Motion updated");
                    } else {
                      await createMotionInLimine(checklist?.id || "", data);
                      toast.success("Motion added");
                    }
                    setEditingMotion(null);
                    loadData();
                  }}
                  onClose={() => setEditingMotion(null)}
                />
              </div>
              <div className="space-y-3">
                {motions.map((motion) => (
                  <Card key={motion.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{motion.motion_title}</span>
                            <Badge variant="outline">{motion.motion_type}</Badge>
                            <Badge variant={motion.filed_by === 'us' ? 'default' : 'secondary'}>
                              {motion.filed_by === 'us' ? 'Our Motion' : 'Opposing'}
                            </Badge>
                            {getStatusBadge(motion.status)}
                          </div>
                          {motion.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{motion.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {motion.filing_date && <span>Filed: {new Date(motion.filing_date).toLocaleDateString()}</span>}
                            {motion.hearing_date && <span>Hearing: {new Date(motion.hearing_date).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingMotion(motion);
                              setMotionDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await deleteMotionInLimine(motion.id);
                              toast.success("Motion removed");
                              loadData();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {motions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No motions in limine added yet. Click "Add Motion" to get started.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Dialog Components
function WitnessDialog({
  open,
  onOpenChange,
  witness,
  checklistId,
  onSave,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  witness: WitnessPrep | null;
  checklistId: string;
  onSave: (data: Partial<WitnessPrep>) => Promise<void>;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    witness_name: "",
    witness_type: "fact",
    contact_info: "",
    prep_status: "not_started",
    prep_date: "",
    testimony_summary: "",
    anticipated_cross: "",
    prep_notes: "",
    order_of_appearance: "",
    subpoena_served: false,
  });

  useEffect(() => {
    if (witness) {
      setFormData({
        witness_name: witness.witness_name,
        witness_type: witness.witness_type,
        contact_info: witness.contact_info || "",
        prep_status: witness.prep_status,
        prep_date: witness.prep_date || "",
        testimony_summary: witness.testimony_summary || "",
        anticipated_cross: witness.anticipated_cross || "",
        prep_notes: witness.prep_notes || "",
        order_of_appearance: witness.order_of_appearance?.toString() || "",
        subpoena_served: witness.subpoena_served,
      });
    } else {
      setFormData({
        witness_name: "",
        witness_type: "fact",
        contact_info: "",
        prep_status: "not_started",
        prep_date: "",
        testimony_summary: "",
        anticipated_cross: "",
        prep_notes: "",
        order_of_appearance: "",
        subpoena_served: false,
      });
    }
  }, [witness, open]);

  const handleSubmit = async () => {
    if (!formData.witness_name) {
      toast.error("Witness name is required");
      return;
    }
    await onSave({
      ...formData,
      order_of_appearance: formData.order_of_appearance ? parseInt(formData.order_of_appearance) : null,
      prep_date: formData.prep_date || null,
    });
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Witness</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{witness ? "Edit Witness" : "Add Witness"}</DialogTitle>
          <DialogDescription>Enter witness details and preparation status</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Witness Name *</Label>
              <Input value={formData.witness_name} onChange={(e) => setFormData({ ...formData, witness_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Witness Type</Label>
              <Select value={formData.witness_type} onValueChange={(v) => setFormData({ ...formData, witness_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fact">Fact Witness</SelectItem>
                  <SelectItem value="expert">Expert Witness</SelectItem>
                  <SelectItem value="character">Character Witness</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prep Status</Label>
              <Select value={formData.prep_status} onValueChange={(v) => setFormData({ ...formData, prep_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prep Date</Label>
              <Input type="date" value={formData.prep_date} onChange={(e) => setFormData({ ...formData, prep_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Info</Label>
              <Input value={formData.contact_info} onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Order of Appearance</Label>
              <Input type="number" value={formData.order_of_appearance} onChange={(e) => setFormData({ ...formData, order_of_appearance: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Testimony Summary</Label>
            <Textarea value={formData.testimony_summary} onChange={(e) => setFormData({ ...formData, testimony_summary: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Anticipated Cross-Examination</Label>
            <Textarea value={formData.anticipated_cross} onChange={(e) => setFormData({ ...formData, anticipated_cross: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Prep Notes</Label>
            <Textarea value={formData.prep_notes} onChange={(e) => setFormData({ ...formData, prep_notes: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={formData.subpoena_served} onCheckedChange={(c) => setFormData({ ...formData, subpoena_served: !!c })} />
            <Label>Subpoena Served</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Witness</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExhibitDialog({
  open,
  onOpenChange,
  exhibit,
  checklistId,
  onSave,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibit: ExhibitItem | null;
  checklistId: string;
  onSave: (data: Partial<ExhibitItem>) => Promise<void>;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    exhibit_number: "",
    description: "",
    exhibit_type: "document",
    foundation_witness: "",
    status: "pending",
    objection_anticipated: false,
    objection_response: "",
  });

  useEffect(() => {
    if (exhibit) {
      setFormData({
        exhibit_number: exhibit.exhibit_number,
        description: exhibit.description,
        exhibit_type: exhibit.exhibit_type,
        foundation_witness: exhibit.foundation_witness || "",
        status: exhibit.status,
        objection_anticipated: exhibit.objection_anticipated,
        objection_response: exhibit.objection_response || "",
      });
    } else {
      setFormData({
        exhibit_number: "",
        description: "",
        exhibit_type: "document",
        foundation_witness: "",
        status: "pending",
        objection_anticipated: false,
        objection_response: "",
      });
    }
  }, [exhibit, open]);

  const handleSubmit = async () => {
    if (!formData.exhibit_number || !formData.description) {
      toast.error("Exhibit number and description are required");
      return;
    }
    await onSave(formData);
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Exhibit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exhibit ? "Edit Exhibit" : "Add Exhibit"}</DialogTitle>
          <DialogDescription>Enter exhibit details and admission status</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Exhibit Number *</Label>
              <Input value={formData.exhibit_number} onChange={(e) => setFormData({ ...formData, exhibit_number: e.target.value })} placeholder="e.g., A-1" />
            </div>
            <div className="space-y-2">
              <Label>Exhibit Type</Label>
              <Select value={formData.exhibit_type} onValueChange={(v) => setFormData({ ...formData, exhibit_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Foundation Witness</Label>
              <Input value={formData.foundation_witness} onChange={(e) => setFormData({ ...formData, foundation_witness: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="marked">Marked for ID</SelectItem>
                  <SelectItem value="admitted">Admitted</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={formData.objection_anticipated} onCheckedChange={(c) => setFormData({ ...formData, objection_anticipated: !!c })} />
            <Label>Objection Anticipated</Label>
          </div>
          {formData.objection_anticipated && (
            <div className="space-y-2">
              <Label>Response to Anticipated Objection</Label>
              <Textarea value={formData.objection_response} onChange={(e) => setFormData({ ...formData, objection_response: e.target.value })} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Exhibit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JuryInstructionDialog({
  open,
  onOpenChange,
  instruction,
  checklistId,
  onSave,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruction: JuryInstruction | null;
  checklistId: string;
  onSave: (data: Partial<JuryInstruction>) => Promise<void>;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    instruction_number: "",
    instruction_type: "standard",
    instruction_text: "",
    source: "",
    status: "proposed",
    opposition_position: "",
    argument_notes: "",
  });

  useEffect(() => {
    if (instruction) {
      setFormData({
        instruction_number: instruction.instruction_number || "",
        instruction_type: instruction.instruction_type,
        instruction_text: instruction.instruction_text,
        source: instruction.source || "",
        status: instruction.status,
        opposition_position: instruction.opposition_position || "",
        argument_notes: instruction.argument_notes || "",
      });
    } else {
      setFormData({
        instruction_number: "",
        instruction_type: "standard",
        instruction_text: "",
        source: "",
        status: "proposed",
        opposition_position: "",
        argument_notes: "",
      });
    }
  }, [instruction, open]);

  const handleSubmit = async () => {
    if (!formData.instruction_text) {
      toast.error("Instruction text is required");
      return;
    }
    await onSave(formData);
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Instruction</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{instruction ? "Edit Jury Instruction" : "Add Jury Instruction"}</DialogTitle>
          <DialogDescription>Enter jury instruction details and status</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Instruction Number</Label>
              <Input value={formData.instruction_number} onChange={(e) => setFormData({ ...formData, instruction_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.instruction_type} onValueChange={(v) => setFormData({ ...formData, instruction_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="special">Special</SelectItem>
                  <SelectItem value="contested">Contested</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="agreed">Agreed</SelectItem>
                  <SelectItem value="contested">Contested</SelectItem>
                  <SelectItem value="given">Given</SelectItem>
                  <SelectItem value="refused">Refused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Instruction Text *</Label>
            <Textarea value={formData.instruction_text} onChange={(e) => setFormData({ ...formData, instruction_text: e.target.value })} rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Source (e.g., CACI 100)</Label>
            <Input value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Opposition Position</Label>
            <Textarea value={formData.opposition_position} onChange={(e) => setFormData({ ...formData, opposition_position: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Argument Notes</Label>
            <Textarea value={formData.argument_notes} onChange={(e) => setFormData({ ...formData, argument_notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Instruction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MotionDialog({
  open,
  onOpenChange,
  motion,
  checklistId,
  onSave,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motion: MotionInLimine | null;
  checklistId: string;
  onSave: (data: Partial<MotionInLimine>) => Promise<void>;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    motion_title: "",
    motion_type: "exclude",
    filed_by: "us",
    description: "",
    legal_basis: "",
    status: "pending",
    filing_date: "",
    hearing_date: "",
    ruling_notes: "",
  });

  useEffect(() => {
    if (motion) {
      setFormData({
        motion_title: motion.motion_title,
        motion_type: motion.motion_type,
        filed_by: motion.filed_by,
        description: motion.description || "",
        legal_basis: motion.legal_basis || "",
        status: motion.status,
        filing_date: motion.filing_date || "",
        hearing_date: motion.hearing_date || "",
        ruling_notes: motion.ruling_notes || "",
      });
    } else {
      setFormData({
        motion_title: "",
        motion_type: "exclude",
        filed_by: "us",
        description: "",
        legal_basis: "",
        status: "pending",
        filing_date: "",
        hearing_date: "",
        ruling_notes: "",
      });
    }
  }, [motion, open]);

  const handleSubmit = async () => {
    if (!formData.motion_title) {
      toast.error("Motion title is required");
      return;
    }
    await onSave({
      ...formData,
      filing_date: formData.filing_date || null,
      hearing_date: formData.hearing_date || null,
    });
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) onClose(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Motion</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{motion ? "Edit Motion in Limine" : "Add Motion in Limine"}</DialogTitle>
          <DialogDescription>Enter motion details and ruling status</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Motion Title *</Label>
            <Input value={formData.motion_title} onChange={(e) => setFormData({ ...formData, motion_title: e.target.value })} placeholder="e.g., Exclude Prior Bad Acts Evidence" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Motion Type</Label>
              <Select value={formData.motion_type} onValueChange={(v) => setFormData({ ...formData, motion_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exclude">Exclude Evidence</SelectItem>
                  <SelectItem value="admit">Admit Evidence</SelectItem>
                  <SelectItem value="limit">Limit Testimony</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filed By</Label>
              <Select value={formData.filed_by} onValueChange={(v) => setFormData({ ...formData, filed_by: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">Our Side</SelectItem>
                  <SelectItem value="opposing">Opposing Counsel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                  <SelectItem value="briefed">Briefed</SelectItem>
                  <SelectItem value="argued">Argued</SelectItem>
                  <SelectItem value="granted">Granted</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Filing Date</Label>
              <Input type="date" value={formData.filing_date} onChange={(e) => setFormData({ ...formData, filing_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Hearing Date</Label>
              <Input type="date" value={formData.hearing_date} onChange={(e) => setFormData({ ...formData, hearing_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Legal Basis</Label>
            <Textarea value={formData.legal_basis} onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value })} rows={2} placeholder="e.g., FRE 404(b), relevance, unfair prejudice" />
          </div>
          <div className="space-y-2">
            <Label>Ruling Notes</Label>
            <Textarea value={formData.ruling_notes} onChange={(e) => setFormData({ ...formData, ruling_notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Motion</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
