import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Mail, Shield } from "lucide-react";

type InviteRole = "partner" | "associate" | "paralegal" | "viewer";

interface InviteMemberDialogProps {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

const roleDescriptions: Record<InviteRole, string> = {
  partner: "Full access, can manage team and case settings",
  associate: "Can view and edit documents, timeline, and notes",
  paralegal: "Can view and edit documents, limited settings access",
  viewer: "Read-only access to case data",
};

export function InviteMemberDialog({
  caseId,
  open,
  onOpenChange,
  onInvited,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("associate");
  const [emailError, setEmailError] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) {
        throw new Error("Email is required");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("Please enter a valid email address");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "invite-member",
        {
          body: {
            caseId,
            email: trimmedEmail,
            role,
          },
        },
      );

      if (fnError) {
        // Surface the server's error message when available
        const context = (fnError as { context?: Response }).context;
        if (context) {
          const body = await context.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw new Error(fnError.message || "Failed to send invitation");
      }
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      const message =
        data?.pending
          ? data?.message || "That email has no account yet — ask them to sign up first."
          : "Team member added to case.";
      toast.success(message);
      setEmail("");
      setRole("associate");
      setEmailError(null);
      onOpenChange(false);
      onInvited();
    },
    onError: (e: Error) => {
      if (
        e.message.includes("email") ||
        e.message.includes("Email") ||
        e.message.includes("valid")
      ) {
        setEmailError(e.message);
      } else {
        toast.error(`Failed to invite member: ${e.message}`);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    inviteMutation.mutate();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEmail("");
      setRole("associate");
      setEmailError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to collaborate on this case. The member will
            receive access based on their assigned role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email Address
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@firm.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
              autoComplete="email"
              required
            />
            {emailError && (
              <p className="text-xs text-red-600">{emailError}</p>
            )}
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Role
            </Label>
            <Select
              value={role}
              onValueChange={(v: string) => setRole(v as InviteRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="associate">Associate</SelectItem>
                <SelectItem value="paralegal">Paralegal</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {roleDescriptions[role]}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={inviteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={inviteMutation.isPending || !email.trim()}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Inviting...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
