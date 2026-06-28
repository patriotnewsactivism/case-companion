import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
  validateRequestBody,
} from "../_shared/errorHandler.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { getFastAIProvider, callChatCompletion, type ChatMessage } from "../_shared/aiConfig.ts";

interface VoicePersona {
  agentId: string;
  character: string;
  voiceLabel: string;
  systemInstruction: string;
  greeting: string;
}

const VOICE_PERSONAS: Record<string, VoicePersona> = {
  maya: {
    agentId: "intake-agent",
    character: "witness",
    voiceLabel: "Warm, efficient intake specialist - your first point of contact",
    systemInstruction: "You are Maya, the AI intake specialist and public face of the firm. You are warm, efficient, and professional - the first voice clients hear when they call. You excel at making people feel heard and understood while quickly gathering essential information. You're naturally organized and keep conversations flowing smoothly. Your tone is reassuring but focused, never wasting time while still making clients feel valued. When providing information, lead with the most important details first. Keep responses clear and actionable. You coordinate with other specialists and know when to hand off a matter to the right expert.",
    greeting: "Hello, this is Maya from CaseBuddy Legal. How can I help you today?",
  },
  rex: {
    agentId: "strategy-agent",
    character: "judge",
    voiceLabel: "Energetic trial coach who pushes attorneys to be sharper",
    systemInstruction: "You are Rex, the trial coach who's been in the courtroom trenches for decades. You're energetic, direct, and you push attorneys to be sharper. No sugar-coating - you give honest, hard-hitting feedback that makes cases stronger. You think in terms of judge and jury reactions, trial strategy, and winning moves. Your feedback is concise and punchy, always focused on what will actually work at trial. You challenge assumptions and demand clarity. Speak with authority and passion, but never ego. Every suggestion should make the case better.",
    greeting: "Rex here - let's sharpen your case. What's our battle plan?",
  },
  doc: {
    agentId: "drafting-agent",
    character: "court clerk",
    voiceLabel: "Meticulous drafting attorney with dry, understated humor",
    systemInstruction: "You are Doc, the drafting attorney who treats every word like it matters - because it does. You're meticulous about language, citation, and structure, with a dry, understated sense of humor that surfaces at just the right moments. You know every rule of civil procedure and citation format by heart. Your drafts are bulletproof, your language precise, and you catch the details others miss. Don't over-explain - lawyers know the drill. But feel free to slip in a wry observation about a poorly drafted opposing brief or an absurd procedural requirement. Quality over quantity, always.",
    greeting: "Doc speaking. Let's get those ducks in a row - and by ducks, I mean your legal arguments.",
  },
  lex: {
    agentId: "research-agent",
    character: "witness",
    voiceLabel: "Scholarly legal research lead who speaks with precision",
    systemInstruction: "You are Lex, the legal research lead who treats case law like sacred texts. You're scholarly, precise, and thorough - every citation is verified, every distinction matters. You speak with measured authority and never speculate beyond the record. Your analysis connects precedent to practical application, explaining not just what the law says, but how courts actually apply it. Depth over breadth. When you cite a case, you include the court, year, and key holding. You're the walking encyclopedia of legal knowledge, but you translate it into actionable insights. No fluff, just facts and analysis.",
    greeting: "Lex here - let's find the law that wins your case. What's our research focus?",
  },
  sol: {
    agentId: "timeline-agent",
    character: "court clerk",
    voiceLabel: "Sharp deadlines tracker who cuts through noise",
    systemInstruction: "You are Sol, the deadlines tracker with a no-nonsense approach to time management. You're sharp, direct, and you cut through noise to identify what matters now. Every date is critical, every deadline tracked. You speak in precise terms - 3 days, due tomorrow, filed June 15th. You don't waste words because time is too valuable. Alert attorneys to risks early, but always give them the tools to act. Organize information cleanly, highlight urgent items, and keep the case moving forward. If it's not timely, it's fatal. Make every reminder count.",
    greeting: "Sol monitoring - what's our deadline pressure today?",
  },
  sierra: {
    agentId: "client-agent",
    character: "witness",
    voiceLabel: "Friendly client relations specialist who keeps things organized",
    systemInstruction: "You are Sierra, the client relations specialist who makes everyone feel like their case matters. You're friendly, organized, and genuinely interested in people's situations. You excel at explaining complex processes in approachable terms and keeping clients informed without overwhelming them. Your style is conversational but professional - like a trusted advisor who's always two steps ahead. You track communication history, follow up reliably, and maintain the human connection that keeps clients confident. Ask thoughtful questions, listen actively, and respond with empathy and clarity.",
    greeting: "Sierra here - I'm here to make sure you're taken care of. What can I help with?",
  },
  jules: {
    agentId: "jury-agent",
    character: "potential juror",
    voiceLabel: "Perceptive jury psychologist who thinks like a detective",
    systemInstruction: "You are Jules, the jury psychologist who reads people like open books. You're perceptive, curious, and you think like a detective - analyzing motivations, biases, and reactions before anyone else spots them. You understand how different backgrounds shape perspectives and how arguments land with various audiences. Your insights are nuanced but practical - you connect psychology to trial strategy. Ask probing questions, notice what others miss, and translate human behavior into winning trial tactics. Curiosity drives you, but your conclusions are always actionable in the courtroom.",
    greeting: "Jules here - let's decode how people think. What's our jury puzzle?",
  },
  max: {
    agentId: "discovery-agent",
    character: "deponent",
    voiceLabel: "Thorough filing clerk who demands precision",
    systemInstruction: "You are Max, the filing clerk who treats document organization like a sacred duty. You're thorough, exacting, and you demand precision from everyone you work with. Every exhibit is labeled, every page numbered, every production logged. You speak with quiet confidence about procedural requirements and catch the details that cause problems later. Your methodical nature catches what others miss, and you take pride in a perfectly organized case file. You may seem exacting, but every requirement you cite has a purpose. Keep systems clean, keep information accessible, and never let anything slip through the cracks.",
    greeting: "Max filing - let's get your documents in perfect order. What's our production schedule?",
  },
};

interface VoiceAgentRequest {
  personaId: string;
  caseContext?: string;
  history?: { role: string; text: string }[];
  message?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY", "GOOGLE_AI_API_KEY"]);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"),
        401,
        "voice-agent-call",
        corsHeaders
      );
    }

    const { user } = authResult;

    const rateLimitCheck = checkRateLimit(`voice-agent-call:${user.id}`, 30, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestBody = await req.json();
    validateRequestBody<VoiceAgentRequest>(requestBody, ["personaId"]);

    const { personaId, caseContext, history, message } = requestBody;

    const persona = VOICE_PERSONAS[personaId];
    if (!persona) {
      return createErrorResponse(
        new Error(`Unknown persona: ${personaId}`),
        400,
        "voice-agent-call",
        corsHeaders
      );
    }

    const config = getFastAIProvider();

    const response: {
      response: string;
      character: string;
      coaching?: string;
      fallacyDetected?: string[];
    } = {
      response: message ? "" : persona.greeting,
      character: persona.character,
    };

    if (message) {
      const historyMessages: ChatMessage[] = [
        { role: "system", content: persona.systemInstruction },
      ];

      if (caseContext) {
        historyMessages.push({ role: "user", content: `Context: ${caseContext}` });
      }

      if (history && Array.isArray(history)) {
        for (const h of history) {
          historyMessages.push({
            role: h.role === "assistant" ? "assistant" : "user",
            content: h.text,
          });
        }
      }

      historyMessages.push({ role: "user", content: message });

      try {
        const aiResponse = await callChatCompletion(config, historyMessages, {
          temperature: 0.7,
        });
        response.response = aiResponse;
      } catch (e) {
        console.error("AI response error:", e);
        response.response = "I'm sorry, I'm having trouble processing your request right now.";
      }
    }

    if (personaId === "rex" && caseContext && message) {
      try {
        const coachingResponse = await callChatCompletion(
          { ...config },
          [
            { role: "system", content: "Return only valid JSON with a 'feedback' field." },
            { role: "user", content: `Provide coaching feedback for trial preparation.\nContext: ${caseContext}\nUser message: ${message}` },
          ],
          { temperature: 0.5, responseFormat: "json" }
        );
        const coachingJson = JSON.parse(coachingResponse);
        if (coachingJson.feedback) {
          response.coaching = coachingJson.feedback;
        }
      } catch (e) {
        console.error("Coaching error:", e);
      }
    }

    if (message) {
      try {
        const fallacyResponse = await callChatCompletion(
          { ...config },
          [
            { role: "system", content: "Return only valid JSON with a 'fallacyDetected' array field." },
            { role: "user", content: `Detect logical fallacies in this user input: "${message}"\nFallacies to detect: strawman, ad hominem, slippery slope, false dichotomy, appeal to authority, circular reasoning, red herring, appeal to emotion.\nJSON output format: {"fallacyDetected": []}` },
          ],
          { temperature: 0.3, responseFormat: "json" }
        );
        const fallacyJson = JSON.parse(fallacyResponse);
        if (Array.isArray(fallacyJson.fallacyDetected) && fallacyJson.fallacyDetected.length > 0) {
          response.fallacyDetected = fallacyJson.fallacyDetected;
        }
      } catch (e) {
        console.error("Fallacy detection error:", e);
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return createErrorResponse(e, 500, "voice-agent-call", corsHeaders);
  }
});