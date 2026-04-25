import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
} from "../_shared/errorHandler.ts";
import { verifyAuth } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"),
        401,
        "settlement-analysis",
        corsHeaders
      );
    }

    const { caseId, analysisId } = await req.json();
    if (!caseId || !analysisId) {
      return new Response(
        JSON.stringify({ error: "caseId and analysisId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Fetch case and analysis data
    const [{ data: caseData, error: caseError }, { data: analysis, error: analysisError }] =
      await Promise.all([
        supabase.from("cases").select("*").eq("id", caseId).single(),
        supabase.from("settlement_analyses").select("*").eq("id", analysisId).single(),
      ]);

    if (caseError || !caseData) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (analysisError || !analysis) {
      return new Response(JSON.stringify({ error: "Analysis not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (GOOGLE_AI_API_KEY) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = GOOGLE_AI_API_KEY;
      model = "gemini-2.0-flash";
    } else if (OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = OPENAI_API_KEY;
      model = "gpt-4o-mini";
    } else {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a legal settlement analysis expert. Analyze the following case and provide settlement recommendations.

Case Name: ${caseData.name}
Case Type: ${caseData.case_type}
Case Theory: ${caseData.case_theory || "Not specified"}
Key Issues: ${(caseData.key_issues || []).join(", ") || "Not specified"}
Winning Factors: ${(caseData.winning_factors || []).join(", ") || "Not specified"}

Current Analysis Data:
${JSON.stringify(analysis, null, 2)}

Please provide:
1. Settlement range recommendation (minimum, maximum, recommended amounts)
2. Key factors affecting settlement value
3. Negotiation strategy recommendations
4. Risk factors that could affect settlement
5. Recommended next steps

Format your response as JSON with these fields:
{
  "settlement_range": { "min": number, "max": number, "recommended": number },
  "key_factors": ["factor1", "factor2"],
  "negotiation_strategy": "strategy description",
  "risk_factors": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "ai_notes": "overall analysis summary"
}`;

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiResult = JSON.parse(aiData.choices[0].message.content);

    // Update the settlement analysis record
    const { data: updated, error: updateError } = await supabase
      .from("settlement_analyses")
      .update({
        ai_notes: aiResult.ai_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, analysis: aiResult, record: updated || analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("settlement-analysis error:", e);
    return createErrorResponse(e, 500, "settlement-analysis", corsHeaders);
  }
});
