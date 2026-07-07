import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  case_id?: string;
  message_type?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: EmailPayload = await req.json();
    const { to, subject, html, text, case_id, message_type = "general" } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@casebuddy.app";

    if (!RESEND_API_KEY) {
      // No email provider configured — log the invite but skip actual send
      console.warn("RESEND_API_KEY not set — logging invite only");
      if (case_id) {
        await supabase.from("client_messages").insert({
          case_id,
          sender_id: user.id,
          sender_type: "attorney",
          message: text || html.replace(/<[^>]+>/g, ""),
          subject,
          message_type,
          recipient_email: to,
        });
      }
      return new Response(JSON.stringify({ success: true, sent: false, reason: "no_email_provider" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ""),
      }),
    });

    const emailResult = await emailRes.json();

    if (!emailRes.ok) {
      throw new Error(emailResult?.message || "Email send failed");
    }

    // Log to client_messages
    if (case_id) {
      await supabase.from("client_messages").insert({
        case_id,
        sender_id: user.id,
        sender_type: "attorney",
        message: text || html.replace(/<[^>]+>/g, ""),
        subject,
        message_type,
        recipient_email: to,
      });
    }

    return new Response(JSON.stringify({ success: true, sent: true, id: emailResult.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
