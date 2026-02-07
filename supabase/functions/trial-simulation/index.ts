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
  mode: 'cross-examination' | 'direct-examination' | 'opening-statement' | 'closing-argument' | 'deposition' | 'motion-hearing' | 'objections-practice' | 'voir-dire' | 'evidence-foundation';
  messages: Message[];
  objectionContext?: {
    lastQuestion?: string;
    objectionType?: string;
  };
}

const OBJECTION_TYPES = [
  'Hearsay',
  'Leading the witness',
  'Relevance',
  'Speculation',
  'Compound question',
  'Asked and answered',
  'Assumes facts not in evidence',
  'Argumentative',
  'Calls for a narrative',
  'Beyond the scope',
  'Lack of foundation',
  'Best evidence rule',
  'Improper character evidence',
  'Calls for expert opinion',
  'Vague and ambiguous',
];

const SIMULATION_PROMPTS: Record<string, { role: string; instruction: string }> = {
  'cross-examination': {
    role: 'opposing counsel\'s witness',
    instruction: `You are an experienced witness being cross-examined. Be defensive, evasive when appropriate, and protective of harmful facts. 
    
BEHAVIOR GUIDELINES:
- Answer truthfully but minimize damaging admissions
- Use phrases like "I don't recall specifically" when appropriate
- Be more forthcoming on neutral facts
- Show some discomfort or defensiveness on sensitive topics
- Occasionally ask for clarification on compound or unclear questions
- If the attorney makes a mistake (leading question on direct, hearsay), note it but continue

Stay in character. Keep responses realistic and courtroom-appropriate. Respond in 1-3 sentences unless a longer explanation is needed.`,
  },
  'direct-examination': {
    role: 'your own witness',
    instruction: `You are a cooperative witness being examined by the attorney who called you. Provide helpful, clear testimony that supports the case.

BEHAVIOR GUIDELINES:
- Be forthcoming and helpful
- Elaborate when given open-ended questions
- Use clear, simple language a jury would understand
- Show appropriate emotion when discussing difficult topics
- If the attorney asks a leading question (they shouldn't on direct), gently indicate this is problematic
- Reference specific documents or facts when relevant

Stay in character. Keep responses realistic and courtroom-appropriate.`,
  },
  'opening-statement': {
    role: 'judge evaluating your opening',
    instruction: `You are an experienced trial judge evaluating an opening statement. Provide specific, actionable feedback.

EVALUATION CRITERIA:
- Clarity of case theory
- Persuasive storytelling vs. argumentative content
- Preview of evidence without arguing facts
- Appropriate length and pacing
- Emotional connection without being manipulative
- Roadmap for the jury

After each section, provide feedback on: what worked, what could improve, and specific suggestions. Rate overall effectiveness 1-10.`,
  },
  'closing-argument': {
    role: 'judge and jury evaluating your closing',
    instruction: `You are simulating a judge and jury evaluating a closing argument. Provide detailed feedback.

EVALUATION CRITERIA:
- Summary of key evidence
- Connection of facts to legal elements
- Addressing weaknesses in the case
- Emotional appeal balanced with logic
- Call to action for the verdict
- Handling of burden of proof

Provide constructive feedback on persuasiveness, organization, and delivery. Note any improper arguments (misstating evidence, personal opinion, golden rule violations).`,
  },
  'deposition': {
    role: 'deponent',
    instruction: `You are a witness being deposed. Answer questions under oath but be naturally cautious and protective of your interests.

BEHAVIOR GUIDELINES:
- Wait for complete questions before answering
- Don't volunteer information beyond what's asked
- Say "I don't know" or "I don't recall" when genuinely uncertain
- Ask for clarification on confusing questions
- Occasionally be evasive on damaging topics
- Show realistic fatigue if the deposition runs long
- Reference documents carefully ("That appears to be my signature...")

Stay in character as a real deponent would behave.`,
  },
  'motion-hearing': {
    role: 'skeptical judge',
    instruction: `You are a trial court judge hearing a motion. Challenge the attorney's arguments and probe weaknesses.

BEHAVIOR GUIDELINES:
- Ask about controlling precedent
- Challenge logical leaps
- Question the application of law to facts
- Play devil's advocate
- Ask "what if" hypotheticals
- Demand clear, direct answers
- Reference procedural requirements
- Ask about the remedy being sought

Be tough but fair. Push the attorney to strengthen their argument.`,
  },
  'objections-practice': {
    role: 'opposing counsel and judge',
    instruction: `You are simulating a courtroom objection exercise. You will:
1. Present a question that an opposing attorney might ask (some objectionable, some proper)
2. Wait for the user to either object (and state grounds) or allow the question
3. Rule on the objection as the judge would
4. Explain why the ruling was made

OBJECTION TYPES TO TEST:
- Hearsay (and exceptions)
- Leading questions on direct
- Relevance and prejudice (403)
- Speculation and lack of foundation
- Compound questions
- Asked and answered
- Assumes facts not in evidence
- Calls for narrative
- Beyond the scope
- Best evidence rule

After each round, provide teaching feedback on:
- Whether objection was correct
- Proper phrasing of objection
- Strategic considerations (when to object vs. let it go)

Start by presenting a scenario and question for the user to evaluate.`,
  },
  'voir-dire': {
    role: 'potential juror',
    instruction: `You are a potential juror being questioned during voir dire. Have a realistic background and some potential biases.

YOUR PROFILE (vary this each session):
- Occupation and work history
- Family situation
- Prior jury experience
- Relevant life experiences
- Possible biases (subtle, realistic)
- Attitude toward lawsuits/criminal justice

BEHAVIOR GUIDELINES:
- Answer honestly but with varying levels of openness
- Some jurors are chatty, others give short answers
- Have opinions but try to appear fair
- React realistically to sensitive topics
- If asked about hardship, give realistic concerns

Help the attorney practice identifying favorable/unfavorable jurors.`,
  },
  'evidence-foundation': {
    role: 'witness and judge',
    instruction: `You are simulating foundation-laying for evidence admission. Play both the witness and judge roles.

EVIDENCE TYPES TO PRACTICE:
- Documents (authentication, business records)
- Photographs and video
- Physical evidence
- Expert testimony foundation
- Demonstrative exhibits
- Digital evidence and metadata
- Hearsay exceptions (present sense impression, excited utterance, business records, etc.)

PROCESS:
1. Present an exhibit the attorney needs to introduce
2. As witness, respond to foundation questions
3. When opposing counsel might object, note this
4. As judge, rule on admissibility
5. Explain what foundation elements were met or missing

Teach proper foundation with specific feedback on each attempt.`,
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
      .select('name, summary, key_facts, favorable_findings, adverse_findings, action_items, ocr_text')
      .eq('case_id', caseId)
      .eq('ai_analyzed', true)
      .limit(20);

    // Get depositions for context
    const { data: depositions } = await supabase
      .from('depositions')
      .select('deponent_name, deponent_type, summary, key_testimony')
      .eq('case_id', caseId)
      .limit(10);

    // Get timeline events for chronology
    const { data: timelineEvents } = await supabase
      .from('timeline_events')
      .select('title, description, event_date, event_type')
      .eq('case_id', caseId)
      .order('event_date', { ascending: true })
      .limit(20);

    // Build rich context from case data
    const caseContext = {
      caseName: caseData.name,
      caseType: caseData.case_type,
      clientName: caseData.client_name,
      representation: caseData.representation,
      caseTheory: caseData.case_theory,
      keyIssues: caseData.key_issues || [],
      winningFactors: caseData.winning_factors || [],
      notes: caseData.notes,
      status: caseData.status,
    };

    const documentContext = documents?.map(doc => ({
      name: doc.name,
      summary: doc.summary,
      keyFacts: doc.key_facts || [],
      favorable: doc.favorable_findings || [],
      adverse: doc.adverse_findings || [],
      ocrPreview: doc.ocr_text?.substring(0, 500),
    })) || [];

    const depositionContext = depositions?.map(dep => ({
      deponent: dep.deponent_name,
      type: dep.deponent_type,
      summary: dep.summary,
      keyTestimony: dep.key_testimony || [],
    })) || [];

    const timelineContext = timelineEvents?.map(event => ({
      date: event.event_date,
      title: event.title,
      description: event.description,
      type: event.event_type,
    })) || [];

    // Build comprehensive system prompt
    const simulationConfig = SIMULATION_PROMPTS[mode] || SIMULATION_PROMPTS['cross-examination'];
    
    const systemPrompt = `${simulationConfig.instruction}

=== CASE INFORMATION ===
Case: ${caseContext.caseName}
Type: ${caseContext.caseType}
Client: ${caseContext.clientName}
Representation: ${caseContext.representation}
Case Theory: ${caseContext.caseTheory || 'Not specified'}
Key Issues: ${caseContext.keyIssues.join('; ') || 'None specified'}
Winning Factors: ${caseContext.winningFactors.join('; ') || 'None specified'}
${caseContext.notes ? `Case Notes: ${caseContext.notes}` : ''}

=== KEY DOCUMENTS (${documentContext.length} analyzed) ===
${documentContext.slice(0, 5).map((doc, i) => `
Document ${i + 1}: ${doc.name}
- Summary: ${doc.summary || 'N/A'}
- Key Facts: ${doc.keyFacts.slice(0, 3).join('; ') || 'N/A'}
- Favorable Points: ${doc.favorable.slice(0, 2).join('; ') || 'N/A'}
- Adverse Points: ${doc.adverse.slice(0, 2).join('; ') || 'N/A'}
`).join('\n')}

${depositionContext.length > 0 ? `=== DEPOSITION TESTIMONY ===
${depositionContext.map(dep => `
${dep.deponent} (${dep.type || 'Witness'}):
- Summary: ${dep.summary || 'N/A'}
- Key Testimony: ${dep.keyTestimony.slice(0, 3).join('; ') || 'N/A'}
`).join('\n')}` : ''}

${timelineContext.length > 0 ? `=== CASE TIMELINE ===
${timelineContext.slice(0, 10).map(event => 
  `${event.date}: ${event.title}${event.description ? ` - ${event.description}` : ''}`
).join('\n')}` : ''}

=== INSTRUCTIONS ===
Stay in character as ${simulationConfig.role}. Be realistic and challenging.
${mode === 'objections-practice' ? `
When presenting questions, vary between:
- Clearly objectionable questions
- Questions that might seem objectionable but are proper
- Questions where objection timing matters strategically

After each exchange, score performance and teach proper objection technique.` : ''}
Keep responses concise (under 150 words) unless the mode requires longer feedback.`;

    // Call OpenAI Chat API with GPT-4
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
        max_tokens: 500,
        temperature: 0.85,
        presence_penalty: 0.2,
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

    // Generate coaching feedback periodically
    let coaching = null;
    const shouldProvideCoaching = messages.length > 0 && (
      messages.length % 4 === 0 || // Every 4 exchanges
      mode === 'objections-practice' || // Always for objection practice
      mode === 'opening-statement' ||
      mode === 'closing-argument'
    );

    if (shouldProvideCoaching) {
      const coachingPrompt = `You are an elite trial advocacy coach who has trained top litigators. Review this ${mode.replace(/-/g, ' ')} practice and provide specific, actionable coaching.

Recent exchange:
${messages.slice(-4).map(m => `${m.role === 'user' ? 'Attorney' : 'Opponent/Witness'}: ${m.content}`).join('\n\n')}

AI Response: ${aiMessage}

Provide coaching in these areas (2-4 bullet points total):
1. TECHNIQUE: What worked well and what needs improvement
2. STRATEGY: Tactical observations and opportunities missed
3. ${mode === 'objections-practice' ? 'OBJECTION TIMING: When to object and when to let it go' : 'DELIVERY: Voice, pacing, and presence suggestions'}
4. NEXT STEP: One specific thing to try in the next exchange

Be encouraging but direct. Give specific examples from the exchange.`;

      const coachingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: coachingPrompt }],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (coachingResponse.ok) {
        const coachingData = await coachingResponse.json();
        coaching = coachingData.choices[0]?.message?.content;
      }
    }

    // Track performance metrics (could be stored for progress tracking)
    const performanceHints: string[] = [];
    
    // Analyze the latest exchange for common issues
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    
    if (mode === 'cross-examination') {
      if (!lastUserMessage.includes('?')) {
        performanceHints.push('Use questions, not statements, on cross-examination');
      }
      if (lastUserMessage.split('?').length > 2) {
        performanceHints.push('Ask one question at a time for maximum impact');
      }
    }
    
    if (mode === 'direct-examination') {
      const leadingPhrases = ['isn\'t it true', 'wouldn\'t you agree', 'you would agree'];
      if (leadingPhrases.some(phrase => lastUserMessage.toLowerCase().includes(phrase))) {
        performanceHints.push('Avoid leading questions on direct examination');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: aiMessage,
        coaching,
        role: simulationConfig.role,
        performanceHints: performanceHints.length > 0 ? performanceHints : undefined,
        objectionTypes: mode === 'objections-practice' ? OBJECTION_TYPES : undefined,
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
