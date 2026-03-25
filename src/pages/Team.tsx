import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Users,
  UserPlus,
  Settings,
  Trash2,
  Loader2,
  Shield,
  Mail,
  Calendar,
  Crown,
  Edit2,
} from "lucide-react";

type OrgRole = "owner" | "admin" | "member" | "viewer";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_id: string;
}

interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  profile?: {
    full_name: string | null;
  };
  email?: string;
}

const orgRoleBadgeConfig: Record<OrgRole, { label: string; className: string }> =
  {
    owner: {
      label: "Owner",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    },
    admin: {
      label: "Admin",
      className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    },
    member: {
      label: "Member",
      className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    },
    viewer: {
      label: "Viewer",
      className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    },
  };

function Team() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create org form state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");

  // Remove member state
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  // Fetch organization
  const {
    data: organization,
    isLoading: orgLoading,
  } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("organizations")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Organization | null;
    },
  });

  // Fetch org members
  const {
    data: members = [],
    isLoading: membersLoading,
  } = useQuery({
    queryKey: ["org-members", organization?.id],
    queryFn: async () => {
      if (!organization) return [];
      const { data, error } = await (supabase as any)
        .from("organization_members")
        .select(
          `
          id,
          organization_id,
          user_id,
          role,
          joined_at,
          profiles:user_id (
            full_name
          )
        `,
        )
        .eq("organization_id", organization.id)
        .order("joined_at", { ascending: true });

      if (error) throw error;
      return ((data as unknown as OrgMember[]) || []).map((m) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));
    },
    enabled: !!organization?.id,
  });

  // Create organization
  const createOrgMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!orgName.trim()) throw new Error("Organization name is required");

      const slug =
        orgSlug.trim() ||
        orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      const { data, error } = await (supabase as any)
        .from("organizations")
        .insert({
          name: orgName.trim(),
          slug,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as owner member
      const { error: memberError } = await (supabase as any)
        .from("organization_members")
        .insert({
          organization_id: data.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      setOrgName("");
      setOrgSlug("");
      toast.success("Organization created successfully.");
    },
    onError: (e: Error) => {
      toast.error(`Failed to create organization: ${e.message}`);
    },
  });

  // Invite member to org
  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      if (!organization) throw new Error("No organization found");
      const trimmedEmail = inviteEmail.trim().toLowerCase();

      if (!trimmedEmail) throw new Error("Email is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("Please enter a valid email address");
      }

      const { data, error } = await supabase.functions.invoke(
        "invite-member",
        {
          body: {
            organizationId: organization.id,
            email: trimmedEmail,
            role: inviteRole,
          },
        },
      );

      if (error) {
        // Fallback: insert directly as a pending invite
        const { error: insertError } = await (supabase as any)
          .from("organization_members")
          .insert({
            organization_id: organization.id,
            user_id: user?.id || "",
            role: inviteRole,
            invited_email: trimmedEmail,
            status: "pending",
          });

        if (insertError) throw insertError;
        return { pending: true };
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["org-members", organization?.id],
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      const message = data?.pending
        ? "Invitation sent. Pending acceptance."
        : "Member added to organization.";
      toast.success(message);
    },
    onError: (e: Error) => {
      toast.error(`Failed to invite: ${e.message}`);
    },
  });

  // Update member role
  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      newRole,
    }: {
      memberId: string;
      newRole: OrgRole;
    }) => {
      const { error } = await (supabase as any)
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["org-members", organization?.id],
      });
      toast.success("Role updated.");
    },
    onError: (e: Error) => {
      toast.error(`Failed to update role: ${e.message}`);
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await (supabase as any)
        .from("organization_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["org-members", organization?.id],
      });
      setRemoveMemberId(null);
      toast.success("Member removed.");
    },
    onError: (e: Error) => {
      toast.error(`Failed to remove member: ${e.message}`);
    },
  });

  const isOrgOwner = organization?.owner_id === user?.id;
  const currentMember = members.find((m) => m.user_id === user?.id);
  const canManage =
    isOrgOwner ||
    currentMember?.role === "owner" ||
    currentMember?.role === "admin";
  const memberToRemove = members.find((m) => m.id === removeMemberId);

  if (orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Team Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization and team members.
          </p>
        </div>

        {/* No organization -- show create form */}
        {!organization && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Create Your Organization
              </CardTitle>
              <CardDescription>
                Set up an organization to invite team members and collaborate on
                cases.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createOrgMutation.mutate();
                }}
                className="space-y-4 max-w-md"
              >
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    placeholder="Smith & Associates LLP"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">
                    URL Slug{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="org-slug"
                    placeholder="smith-associates"
                    value={orgSlug}
                    onChange={(e) =>
                      setOrgSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to auto-generate from the name.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={createOrgMutation.isPending || !orgName.trim()}
                >
                  {createOrgMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Organization"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Organization details */}
        {organization && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {organization.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Slug: {organization.slug} &middot; Created{" "}
                      {format(new Date(organization.created_at), "MMMM d, yyyy")}
                    </CardDescription>
                  </div>
                  {canManage && (
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Members section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members
                    {members.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {members.length}
                      </Badge>
                    )}
                  </CardTitle>
                  {canManage && (
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
                {membersLoading && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-sm">Loading members...</span>
                  </div>
                )}

                {!membersLoading && members.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">No members yet.</p>
                    <p className="text-xs mt-1">
                      Invite team members to start collaborating.
                    </p>
                  </div>
                )}

                {!membersLoading && members.length > 0 && (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-1">
                      {members.map((member, index) => {
                        const displayName =
                          member.profile?.full_name ||
                          member.email ||
                          member.user_id.substring(0, 8) + "...";
                        const badge =
                          orgRoleBadgeConfig[member.role as OrgRole] ||
                          orgRoleBadgeConfig.member;
                        const isOwner = member.role === "owner";
                        const isSelf = member.user_id === user?.id;

                        return (
                          <div key={member.id}>
                            {index > 0 && <Separator className="my-2" />}
                            <div className="flex items-center gap-3 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
                              {/* Avatar */}
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
                                  {isSelf && (
                                    <span className="text-xs text-muted-foreground">
                                      (you)
                                    </span>
                                  )}
                                  <Badge className={badge.className}>
                                    {badge.label}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="h-3 w-3" />
                                  Joined{" "}
                                  {format(
                                    new Date(member.joined_at),
                                    "MMM d, yyyy",
                                  )}
                                </span>
                              </div>

                              {/* Actions */}
                              {canManage && !isOwner && !isSelf && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <Select
                                    value={member.role}
                                    onValueChange={(value: string) =>
                                      updateRoleMutation.mutate({
                                        memberId: member.id,
                                        newRole: value as OrgRole,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[110px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">
                                        Admin
                                      </SelectItem>
                                      <SelectItem value="member">
                                        Member
                                      </SelectItem>
                                      <SelectItem value="viewer">
                                        Viewer
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setRemoveMemberId(member.id)
                                    }
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                                    title="Remove member"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              {isOwner && (
                                <Crown className="h-4 w-4 text-amber-500 shrink-0" />
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
          </>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInviteEmail("");
            setInviteRole("member");
          }
          setInviteOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite to Organization
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join{" "}
              <span className="font-medium">{organization?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMemberMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="org-invite-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email Address
              </Label>
              <Input
                id="org-invite-email"
                type="email"
                placeholder="colleague@firm.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Role
              </Label>
              <Select
                value={inviteRole}
                onValueChange={(v: string) => setInviteRole(v as OrgRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteMemberMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  inviteMemberMutation.isPending || !inviteEmail.trim()
                }
              >
                {inviteMemberMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Inviting...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation */}
      <AlertDialog
        open={!!removeMemberId}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">
                {memberToRemove?.profile?.full_name ||
                  memberToRemove?.email ||
                  "this member"}
              </span>{" "}
              from the organization? They will lose access to all shared cases
              and data.
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
    </Layout>
  );
}

export default Team;
