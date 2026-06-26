import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Shield,
  Mail,
  Calendar,
} from "lucide-react";

export type MemberRole =
  | "owner"
  | "partner"
  | "associate"
  | "paralegal"
  | "viewer";

interface CaseMember {
  id: string;
  case_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile?: {
    full_name: string | null;
    email?: string | null;
  };
  email?: string;
}

interface CaseMembersProps {
  caseId: string;
  userRole: string;
}

const roleBadgeConfig: Record<MemberRole, { label: string; className: string }> =
  {
    owner: {
      label: "Owner",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    },
    partner: {
      label: "Partner",
      className: "bg-navy-100 text-navy-800 hover:bg-navy-100 bg-slate-800 text-white hover:bg-slate-800",
    },
    associate: {
      label: "Associate",
      className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    },
    paralegal: {
      label: "Paralegal",
      className: "bg-green-100 text-green-800 hover:bg-green-100",
    },
    viewer: {
      label: "Viewer",
      className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    },
  };

const canManageMembers = (role: string) =>
  role === "owner" || role === "partner";

export function CaseMembers({ caseId, userRole }: CaseMembersProps) {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["case-members", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_members")
        .select(
          `
          id,
          case_id,
          user_id,
          role,
          joined_at,
          profiles:user_id (
            full_name
          )
        `,
        )
        .eq("case_id", caseId)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      return ((data as unknown as CaseMember[]) || []).map((member) => ({
        ...member,
        profile: Array.isArray(member.profile)
          ? member.profile[0]
          : member.profile,
      }));
    },
    enabled: !!caseId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      newRole,
    }: {
      memberId: string;
      newRole: MemberRole;
    }) => {
      const { error } = await supabase
        .from("case_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-members", caseId] });
      toast.success("Role updated successfully.");
    },
    onError: (e: Error) => {
      toast.error(`Failed to update role: ${e.message}`);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("case_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-members", caseId] });
      setRemoveMemberId(null);
      toast.success("Member removed from case.");
    },
    onError: (e: Error) => {
      toast.error(`Failed to remove member: ${e.message}`);
    },
  });

  const memberToRemove = members.find((m) => m.id === removeMemberId);
  const isManager = canManageMembers(userRole);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Case Team
            </CardTitle>
            {isManager && (
              <Button
                size="sm"
                onClick={() => setInviteOpen(true)}
                className="gap-1.5"
              >
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Loading team members...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Failed to load team members.</p>
            </div>
          )}

          {!isLoading && !error && members.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No team members yet.</p>
              <p className="text-xs mt-1">
                Invite your first team member to collaborate on this case.
              </p>
            </div>
          )}

          {!isLoading && !error && members.length > 0 && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1">
                {members.map((member, index) => {
                  const displayName =
                    member.profile?.full_name ||
                    member.email ||
                    member.user_id.substring(0, 8) + "...";
                  const badge =
                    roleBadgeConfig[member.role as MemberRole] ||
                    roleBadgeConfig.viewer;
                  const isOwner = member.role === "owner";

                  return (
                    <div key={member.id}>
                      {index > 0 && <Separator className="my-2" />}
                      <div className="flex items-center gap-3 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
                        {/* Avatar */}
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {displayName.substring(0, 2).toUpperCase()}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {displayName}
                            </span>
                            <Badge className={badge.className}>
                              {badge.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {member.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Joined{" "}
                              {format(new Date(member.joined_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {isManager && !isOwner && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Select
                              value={member.role}
                              onValueChange={(value: string) =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  newRole: value as MemberRole,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="partner">Partner</SelectItem>
                                <SelectItem value="associate">
                                  Associate
                                </SelectItem>
                                <SelectItem value="paralegal">
                                  Paralegal
                                </SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemoveMemberId(member.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {isOwner && (
                          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <InviteMemberDialog
        caseId={caseId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => {
          queryClient.invalidateQueries({
            queryKey: ["case-members", caseId],
          });
        }}
      />

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removeMemberId}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">
                {memberToRemove?.profile?.full_name ||
                  memberToRemove?.email ||
                  "this member"}
              </span>{" "}
              from this case? They will lose access to all case documents and
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMemberMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeMemberId) {
                  removeMemberMutation.mutate(removeMemberId);
                }
              }}
              disabled={removeMemberMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeMemberMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
