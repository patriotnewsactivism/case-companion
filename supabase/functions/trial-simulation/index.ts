import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SimulationRequest {
  caseId: string;
  mode: 'cross-examination' | 'direct-examination' | 'opening-statement' | 'closing-argument' | 'deposition' | 'motion-hearing';
  messages: Message[];
}

const SIMULATION_PROMPTS = {
  'cross-examination': {
    role: 'opposing counsel',
    instruction: 'You are an experienced opposing counsel conducting cross-examination. Be strategic, challenging, and look for inconsistencies. Use leading questions. Stay in character and be adversarial but professional. Keep responses concise and courtroom-appropriate.',
  },
  'direct-examination': {
    role: 'friendly witness',
    instruction: 'You are a cooperative witness being examined by the attorney. Provide clear, honest answers that support the case. Be helpful but realistic. Stay in character as a witness.',
  },
  'opening-statement': {
    role: 'judge and jury',
    instruction: 'You are simulating a judge and jury listening to an opening statement. Provide feedback on persuasiveness, clarity, legal arguments, and courtroom presence. Point out what works and what could be improved.',
  },
  'closing-argument': {
    role: 'judge and jury',
    instruction: 'You are simulating a judge and jury listening to a closing argument. Evaluate the summary of evidence, legal reasoning, emotional appeal, and overall persuasiveness. Provide constructive feedback.',
  },
  'deposition': {
    role: 'deponent',
    instruction: 'You are a witness being deposed. Answer questions truthfully but cautiously. You may be evasive or defensive at times, as real deponents often are. Stay in character.',
  },
  'motion-hearing': {
    role: 'judge',
    instruction: 'You are a judge presiding over a motion hearing. Challenge the attorney\'s legal arguments, ask clarifying questions about precedent and statutes, and probe weaknesses in their position. Be analytical and skeptical.',
  },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'trial-simulation',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<SimulationRequest>(requestBody, ['caseId', 'mode', 'messages']);

    const caseId = validateUUID(requestBody.caseId, 'caseId');
    const mode = requestBody.mode as SimulationRequest['mode'];
    const messages = requestBody.messages as Message[];

    // Verify case ownership
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single();

    if (caseError || !caseData) {
      return createErrorResponse(
        new Error('Case not found or access denied'),
        404,
        'trial-simulation',
        corsHeaders
      );
    }

    // Get case documents and their analysis
    const { data: documents } = await supabase
      .from('documents')
      .select('name, summary, key_facts, favorable_findings, adverse_findings, action_items')
      .eq('case_id', caseId)
      .eq('ai_analyzed', true)
      .limit(20);

    // Build context from case data
    const caseContext = {
      caseName: caseData.name,
      description: caseData.description,
      caseTheory: caseData.case_theory,
      keyIssues: caseData.key_issues || [],
      status: caseData.status,
    };

    const documentContext = documents?.map(doc => ({
      name: doc.name,
      summary: doc.summary,
      keyFacts: doc.key_facts || [],
      favorable: doc.favorable_findings || [],
      adverse: doc.adverse_findings || [],
    })) || [];

    // Build system prompt
    const simulationConfig = SIMULATION_PROMPTS[mode];
    const systemPrompt = `${simulationConfig.instruction}

CASE CONTEXT:
- Case: ${caseContext.caseName}
- Description: ${caseContext.description || 'No description'}
- Case Theory: ${caseContext.caseTheory || 'Not specified'}
- Key Issues: ${caseContext.keyIssues.join('; ') || 'None specified'}

DOCUMENT ANALYSIS:
${documentContext.slice(0, 5).map((doc, i) => `
Document ${i + 1}: ${doc.name}
- Summary: ${doc.summary || 'N/A'}
- Key Facts: ${doc.keyFacts.slice(0, 3).join('; ') || 'N/A'}
- Favorable Points: ${doc.favorable.slice(0, 2).join('; ') || 'N/A'}
- Adverse Points: ${doc.adverse.slice(0, 2).join('; ') || 'N/A'}
`).join('\n')}

Stay in character as ${simulationConfig.role}. Keep responses under 150 words. Be realistic and challenging.`;

    // Call OpenAI Chat API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API failed: ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    // Generate coaching feedback every 3-4 exchanges
    let coaching = null;
    if (messages.length > 0 && messages.length % 6 === 0) {
      const coachingPrompt = `You are a trial advocacy coach. Review the last few exchanges in this ${mode} simulation and provide 2-3 brief, actionable coaching tips to improve the attorney's performance. Focus on technique, strategy, and presentation. Be encouraging but honest.

Recent exchange:
${messages.slice(-4).map(m => `${m.role === 'user' ? 'Attorney' : 'Opponent'}: ${m.content}`).join('\n\n')}

Provide coaching in 2-3 bullet points.`;

      const coachingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: coachingPrompt }],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (coachingResponse.ok) {
        const coachingData = await coachingResponse.json();
        coaching = coachingData.choices[0]?.message?.content;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: aiMessage,
        coaching,
        role: simulationConfig.role,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in trial-simulation function:', error);
    return createErrorResponse(error, 500, 'trial-simulation', corsHeaders);
  }
});
