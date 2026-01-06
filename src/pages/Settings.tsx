import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Mail, Building } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    organization: "",
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, firm_name")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const profileData = data as any;
        setProfile({
          full_name: profileData.full_name || "",
          organization: profileData.firm_name || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          firm_name: profile.organization,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Manage your personal information and profile details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                type="text"
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Organization
              </Label>
              <Input
                id="organization"
                type="text"
                value={profile.organization}
                onChange={(e) =>
                  setProfile({ ...profile, organization: e.target.value })
                }
                placeholder="Enter your organization name"
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card>
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>
              Manage your password and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Password reset functionality coming soon");
              }}
            >
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting your account will permanently remove all your data,
              including cases, documents, and timeline events. This action
              cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => {
                toast.error(
                  "Account deletion must be requested through support"
                );
              }}
            >
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
