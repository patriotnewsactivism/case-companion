import { Layout } from "@/components/Layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCases, createCase, updateCase, deleteCase, Case, CaseStatus, RepresentationType, CreateCaseInput } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Plus,
  Search,
  FolderOpen,
  Clock,
  FileText,
  MoreVertical,
  Calendar,
  Users,
  Filter,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const caseTypes = [
  "Civil Litigation",
  "Contract Law",
  "Employment Law",
  "Personal Injury",
  "Intellectual Property",
  "Probate",
  "Family Law",
  "Criminal Defense",
  "Real Estate",
  "Corporate",
  "Other",
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "discovery":
      return "bg-accent/20 text-accent";
    case "pending":
      return "bg-muted text-muted-foreground";
    case "review":
      return "bg-blue-100 text-blue-700";
    case "closed":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

interface CaseFormData {
  name: string;
  case_type: string;
  client_name: string;
  status: CaseStatus;
  representation: RepresentationType;
  case_theory: string;
  next_deadline: string;
  notes: string;
}

const initialFormData: CaseFormData = {
  name: "",
  case_type: "",
  client_name: "",
  status: "active",
  representation: "plaintiff",
  case_theory: "",
  next_deadline: "",
  notes: "",
};

export default function Cases() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CaseFormData>(initialFormData);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const createMutation = useMutation({
    mutationFn: createCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setIsCreateOpen(false);
      setFormData(initialFormData);
      toast({
        title: "Case created",
        description: "Your new case has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setIsEditOpen(false);
      setEditingCase(null);
      setFormData(initialFormData);
      toast({
        title: "Case updated",
        description: "Your case has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setDeleteId(null);
      toast({
        title: "Case deleted",
        description: "The case has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredCases = cases.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.case_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateCaseInput = {
      name: formData.name,
      case_type: formData.case_type,
      client_name: formData.client_name,
      status: formData.status,
      representation: formData.representation,
      case_theory: formData.case_theory || undefined,
      next_deadline: formData.next_deadline || undefined,
      notes: formData.notes || undefined,
    };
    createMutation.mutate(input);
  };

  const handleEdit = (caseItem: Case) => {
    setEditingCase(caseItem);
    setFormData({
      name: caseItem.name,
      case_type: caseItem.case_type,
      client_name: caseItem.client_name,
      status: caseItem.status,
      representation: caseItem.representation,
      case_theory: caseItem.case_theory || "",
      next_deadline: caseItem.next_deadline ? caseItem.next_deadline.split("T")[0] : "",
      notes: caseItem.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    
    updateMutation.mutate({
      id: editingCase.id,
      name: formData.name,
      case_type: formData.case_type,
      client_name: formData.client_name,
      status: formData.status,
      representation: formData.representation,
      case_theory: formData.case_theory || undefined,
      next_deadline: formData.next_deadline || undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const activeCases = cases.filter((c) => c.status === "active").length;

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-6"
        >
          {/* Header */}
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">My Cases</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {cases.length} total cases • {activeCases} active
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Case
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Create New Case</DialogTitle>
                    <DialogDescription>
                      Add a new case to your portfolio. Fill in the details below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Case Name *</Label>
                      <Input
                        id="name"
                        placeholder="Smith v. Acme Corp"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="case_type">Case Type *</Label>
                        <Select
                          value={formData.case_type}
                          onValueChange={(value) => setFormData({ ...formData, case_type: value })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {caseTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="representation">Representation *</Label>
                        <Select
                          value={formData.representation}
                          onValueChange={(value) => setFormData({ ...formData, representation: value as RepresentationType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plaintiff">Plaintiff</SelectItem>
                            <SelectItem value="defendant">Defendant</SelectItem>
                            <SelectItem value="executor">Executor</SelectItem>
                            <SelectItem value="petitioner">Petitioner</SelectItem>
                            <SelectItem value="respondent">Respondent</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client_name">Client Name *</Label>
                      <Input
                        id="client_name"
                        placeholder="John Smith"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData({ ...formData, status: value as CaseStatus })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="discovery">Discovery</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="next_deadline">Next Deadline</Label>
                        <Input
                          id="next_deadline"
                          type="date"
                          value={formData.next_deadline}
                          onChange={(e) => setFormData({ ...formData, next_deadline: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="case_theory">Case Theory</Label>
                      <Textarea
                        id="case_theory"
                        placeholder="Brief description of your case theory..."
                        value={formData.case_theory}
                        onChange={(e) => setFormData({ ...formData, case_theory: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional notes..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Case"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </motion.div>

          {/* Search and Filters */}
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </motion.div>

          {/* Cases Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCases.length === 0 ? (
            <motion.div variants={item} className="text-center py-16">
              <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">
                {searchQuery ? "No cases found" : "No cases yet"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first case to get started"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Case
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCases.map((caseItem) => (
                <motion.div key={caseItem.id} variants={item}>
                  <Card className="glass-card h-full hover:shadow-lg transition-all cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-accent/20 transition-colors">
                            <FolderOpen className="h-5 w-5 text-primary group-hover:text-accent transition-colors" />
                          </div>
                          <div>
                            <CardTitle className="text-base line-clamp-1">{caseItem.name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{caseItem.case_type}</CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(caseItem)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Case
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(caseItem.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(caseItem.status)}`}>
                          {caseItem.status}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                          {caseItem.representation}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span className="truncate">{caseItem.client_name}</span>
                        </div>
                        {caseItem.next_deadline && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Deadline: {format(new Date(caseItem.next_deadline), "MMM d, yyyy")}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(caseItem.updated_at), "MMM d, yyyy")}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-accent" onClick={() => handleEdit(caseItem)}>
                          Open →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Case</DialogTitle>
              <DialogDescription>
                Update the case details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Case Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Case Type *</Label>
                  <Select
                    value={formData.case_type}
                    onValueChange={(value) => setFormData({ ...formData, case_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {caseTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Representation *</Label>
                  <Select
                    value={formData.representation}
                    onValueChange={(value) => setFormData({ ...formData, representation: value as RepresentationType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plaintiff">Plaintiff</SelectItem>
                      <SelectItem value="defendant">Defendant</SelectItem>
                      <SelectItem value="executor">Executor</SelectItem>
                      <SelectItem value="petitioner">Petitioner</SelectItem>
                      <SelectItem value="respondent">Respondent</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Client Name *</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as CaseStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="discovery">Discovery</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Next Deadline</Label>
                  <Input
                    type="date"
                    value={formData.next_deadline}
                    onChange={(e) => setFormData({ ...formData, next_deadline: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Case Theory</Label>
                <Textarea
                  value={formData.case_theory}
                  onChange={(e) => setFormData({ ...formData, case_theory: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this case? This action cannot be undone.
              All documents and timeline events associated with this case will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}