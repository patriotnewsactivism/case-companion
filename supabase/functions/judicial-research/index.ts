import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'judicial-research', corsHeaders);
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`judicial-research:${user.id}`, 10, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { judgeName, court, caseType } = await req.json();
    if (!judgeName) {
      return new Response(JSON.stringify({ error: 'judgeName required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache first
    const { data: cached } = await supabase
      .from('judicial_profiles')
      .select('*')
      .ilike('judge_name', `%${judgeName}%`)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Return cached result if less than 30 days old
    if (cached && cached.profile_data) {
      const age = Date.now() - new Date(cached.last_updated).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (age < thirtyDays) {
        return new Response(JSON.stringify({ success: true, profile: cached.profile_data, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const systemPrompt = `You are a legal intelligence analyst with deep knowledge of federal and state judiciary.
Provide a comprehensive intelligence profile for the judge: ${judgeName}
Court: ${court || 'Not specified'}
Case Type Context: ${caseType || 'General litigation'}

Generate a detailed judicial intelligence profile based on your training knowledge about this judge.
If you do not have specific information about this judge, provide best-practice guidance for appearing before judges in that court/jurisdiction.

Respond with ONLY valid JSON:
{
  "judgeName": "${judgeName}",
  "court": "${court || 'Unknown'}",
  "appointedBy": "President/Governor who appointed, year if known",
  "appointmentYear": "Year or 'Unknown'",
  "priorExperience": ["Prior legal experience items"],
  "lawSchool": "Law school if known",
  "dataConfidence": "high|medium|low",
  "knowledgeNote": "Note about confidence level in this data",
  "courtroom": {
    "demeanor": "Description of courtroom style",
    "oral_argument_preference": "Preference for oral argument",
    "writing_style_preference": "What this judge likes in briefs",
    "notable_rules": ["Local rules or preferences this judge is known for"],
    "pet_peeves": ["Things that annoy this judge in proceedings"]
  },
  "motionStatistics": {
    "note": "Estimated or general information",
    "msjGrantRate": "Estimated grant rate for motions for summary judgment",
    "mtdGrantRate": "Estimated grant rate for motions to dismiss",
    "motionInLimineApproach": "General approach to motions in limine",
    "settlementEncouragement": "Whether this judge actively encourages settlement"
  },
  "notableRulings": [
    {
      "topic": "Area of law",
      "tendency": "How this judge tends to rule",
      "note": "Any notable decisions or approach"
    }
  ],
  "appearanceTips": [
    "Specific, actionable tip for appearing before this judge"
  ],
  "briefWritingTips": [
    "Specific tip for writing briefs for this judge"
  ],
  "caseTypeNotes": {
    "criminal": "Approach to criminal cases if applicable",
    "civil": "Approach to civil cases",
    "summary": "General tendencies relevant to ${caseType || 'litigation'}"
  }
}`;

    // AI provider selection
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string, apiKey: string, model: string;

    if (AI_GATEWAY_URL) {
      apiUrl = AI_GATEWAY_URL; apiKey = OPENAI_API_KEY || GOOGLE_AI_API_KEY || ""; model = "gpt-4o-mini";
    } else if (GOOGLE_AI_API_KEY) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = GOOGLE_AI_API_KEY; model = "gemini-2.0-flash";
    } else if (OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions"; apiKey = OPENAI_API_KEY; model = "gpt-4o-mini";
    } else {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: systemPrompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "{}";

    let profile: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      profile = JSON.parse(jsonStr.trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache the profile
    const { error: saveError } = await supabase
      .from('judicial_profiles')
      .upsert({
        user_id: user.id,
        judge_name: judgeName,
        court: court || profile.court || 'Unknown',
        profile_data: profile,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'judge_name,court' });

    if (saveError) console.error("Failed to cache judicial profile:", saveError);

    return new Response(JSON.stringify({ success: true, profile, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("judicial-research error:", e);
    return createErrorResponse(e, 500, 'judicial-research', corsHeaders);
  }
});
