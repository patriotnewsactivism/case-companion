/**
 * invite-member — adds a user to a case (case_members) or organization
 * (organization_members) by email.
 *
 * Called by InviteMemberDialog (caseId), Team.tsx (organizationId), and
 * lib/api.ts addCaseMember. Uses the service role to look up the target
 * user by email, but only after explicitly verifying the caller has
 * owner/partner authority over the case or organization.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createErrorResponse, validateEnvVars } from "../_shared/errorHandler.ts";
import { verifyAuth } from "../_shared/auth.ts";

const ALLOWED_ROLES = new Set(["partner", "associate", "paralegal", "viewer"]);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"), 401, "invite-member", corsHeaders,
      );
    }
    const { user } = authResult;

    const { caseId, organizationId, email, role } = await req.json();

    const trimmedEmail = String(email || "").trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return json({ error: "A valid email is required" }, 400);
    }
    if (!caseId && !organizationId) {
      return json({ error: "caseId or organizationId is required" }, 400);
    }
    const targetRole = String(role || "viewer").toLowerCase();
    if (!ALLOWED_ROLES.has(targetRole) && targetRole !== "member") {
      return json({ error: `Invalid role: ${targetRole}` }, 400);
    }
    // Team.tsx historically sends "member"; map it to the closest schema role
    const resolvedRole = targetRole === "member" ? "associate" : targetRole;

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the invitee by email
    const { data: targetUserId, error: lookupError } = await service.rpc(
      "get_user_id_by_email",
      { lookup_email: trimmedEmail },
    );
    if (lookupError) {
      console.error("Email lookup failed:", lookupError.message);
      return json({ error: "Failed to look up user" }, 500);
    }

    if (caseId) {
      // Caller must own the case or hold owner/partner membership
      const { data: caseRow } = await service
        .from("cases")
        .select("id, user_id")
        .eq("id", caseId)
        .maybeSingle();
      if (!caseRow) return json({ error: "Case not found" }, 404);

      let isAuthorized = caseRow.user_id === user.id;
      if (!isAuthorized) {
        const { data: membership } = await service
          .from("case_members")
          .select("role")
          .eq("case_id", caseId)
          .eq("user_id", user.id)
          .maybeSingle();
        isAuthorized = !!membership && ["owner", "partner"].includes(membership.role);
      }
      if (!isAuthorized) {
        return json({ error: "Only the case owner or a partner can invite members" }, 403);
      }

      if (!targetUserId) {
        return json({
          invited: false,
          pending: true,
          message: `No CaseBuddy account exists for ${trimmedEmail}. Ask them to sign up, then invite again.`,
        });
      }
      if (targetUserId === caseRow.user_id) {
        return json({ error: "That user already owns this case" }, 409);
      }

      const { data: member, error: insertError } = await service
        .from("case_members")
        .upsert(
          { case_id: caseId, user_id: targetUserId, role: resolvedRole, added_by: user.id },
          { onConflict: "case_id,user_id" },
        )
        .select()
        .single();
      if (insertError) {
        console.error("case_members upsert failed:", insertError.message);
        return json({ error: "Failed to add member to case" }, 500);
      }

      return json({ invited: true, pending: false, member });
    }

    // Organization invite
    const { data: orgRow } = await service
      .from("organizations")
      .select("id, owner_id")
      .eq("id", organizationId)
      .maybeSingle();
    if (!orgRow) return json({ error: "Organization not found" }, 404);

    let isOrgAuthorized = orgRow.owner_id === user.id;
    if (!isOrgAuthorized) {
      const { data: membership } = await service
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();
      isOrgAuthorized = !!membership && ["owner", "partner"].includes(membership.role);
    }
    if (!isOrgAuthorized) {
      return json({ error: "Only the organization owner or a partner can invite members" }, 403);
    }

    if (!targetUserId) {
      return json({
        invited: false,
        pending: true,
        message: `No CaseBuddy account exists for ${trimmedEmail}. Ask them to sign up, then invite again.`,
      });
    }

    const { data: orgMember, error: orgInsertError } = await service
      .from("organization_members")
      .upsert(
        { organization_id: organizationId, user_id: targetUserId, role: resolvedRole, invited_by: user.id },
        { onConflict: "organization_id,user_id" },
      )
      .select()
      .single();
    if (orgInsertError) {
      console.error("organization_members upsert failed:", orgInsertError.message);
      return json({ error: "Failed to add member to organization" }, 500);
    }

    return json({ invited: true, pending: false, member: orgMember });
  } catch (e) {
    console.error("invite-member error:", e);
    return createErrorResponse(e, 500, "invite-member", corsHeaders);
  }
});
