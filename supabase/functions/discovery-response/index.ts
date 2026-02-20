import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscoveryRequest {
  id: string;
  case_id: string;
  requestType: string;
  requestNumber: string;
  question: string;
  response: string | null;
  objections: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { requestId, question, requestType } = await req.json();

    let discoveryRequest: DiscoveryRequest | null = null;
    let actualQuestion = question;
    let actualType = requestType;

    if (requestId) {
      const { data, error } = await supabase
        .from("discovery_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (error) throw error;
      discoveryRequest = data;
      actualQuestion = discoveryRequest.question;
      actualType = discoveryRequest.requestType;
    }

    if (!actualQuestion) {
      throw new Error("No question provided");
    }

    const typeInstructions: Record<string, string> = {
      interrogatory: `This is an interrogatory question. Draft a formal, legally compliant response.
        - Provide a complete but concise answer
        - Include any applicable objections before the response
        - Format as: "Objection: [objection]. Without waiving said objection, [response]"
        - Be factually accurate and avoid speculation`,

      request_for_production: `This is a request for production of documents.
        - Indicate whether documents will be produced
        - List any objections to specific categories
        - Note any documents that may be withheld on privilege grounds
        - Suggest a reasonable production timeline`,

      request_for_admission: `This is a request for admission.
        - Provide a clear admission or denial
        - State "Admitted", "Denied", or "Admitted in part and denied in part"
        - Include explanations for partial admissions
        - Note any inability to admit or deny due to lack of knowledge`,

      deposition: `This is a deposition notice question/topic.
        - Suggest how the witness should prepare
        - Identify potential areas of inquiry
        - Note privilege considerations
        - Recommend document review before deposition`,
    };

    const systemPrompt = `You are an experienced litigation attorney drafting discovery responses.
Your task is to generate professional, legally sound responses to discovery requests.

${typeInstructions[actualType || "interrogatory"]}

Guidelines:
- Be precise and factual
- Avoid over-disclosing beyond what is asked
- Consider applicable privileges (attorney-client, work product)
- Note when information may not be within the responding party's knowledge
- Suggest potential objections when appropriate
- Keep responses professional and court-ready`;

    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";

    const aiResponse = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please draft a response to the following discovery request:\n\n${actualQuestion}` },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedResponse = aiData.choices?.[0]?.message?.content || "";

    const objectionsPrompt = `Based on the following discovery request, identify which objections might apply.
Return ONLY a JSON array of objection types from this list (maximum 5):
- "Relevance"
- "Privilege - Attorney-Client" 
- "Privilege - Work Product"
- "Overbroad"
- "Unduly Burdensome"
- "Vague and Ambiguous"
- "Calls for Legal Conclusion"
- "Compound Question"
- "Assumes Facts Not in Evidence"
- "Cumulative"
- "Harassment"
- "Confidential Information"
- "Trade Secret"
- "Privacy"
- "Protected Health Information (HIPAA)"

Request: ${actualQuestion}

Return only the JSON array, no other text.`;

    const objectionsResponse = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: objectionsPrompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    let suggestedObjections: string[] = [];
    if (objectionsResponse.ok) {
      const objectionsData = await objectionsResponse.json();
      const objectionsText = objectionsData.choices?.[0]?.message?.content || "[]";
      try {
        suggestedObjections = JSON.parse(objectionsText);
      } catch {
        suggestedObjections = [];
      }
    }

    const privilegeCheckPrompt = `Does this discovery request potentially involve privileged information (attorney-client communications, work product, or other protected materials)?
Return ONLY a JSON object: {"hasPrivilegeConcern": boolean, "reason": "brief explanation if true"}

Request: ${actualQuestion}`;

    let privilegeCheck = { hasPrivilegeConcern: false, reason: "" };
    const privilegeResponse = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: privilegeCheckPrompt },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (privilegeResponse.ok) {
      const privilegeData = await privilegeResponse.json();
      const privilegeText = privilegeData.choices?.[0]?.message?.content || '{"hasPrivilegeConcern": false}';
      try {
        privilegeCheck = JSON.parse(privilegeText);
      } catch {
        privilegeCheck = { hasPrivilegeConcern: false, reason: "" };
      }
    }

    return new Response(
      JSON.stringify({
        response: generatedResponse,
        suggestedObjections,
        privilegeCheck,
        requestId: discoveryRequest?.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Discovery response error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
