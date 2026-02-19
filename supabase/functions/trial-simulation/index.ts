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
    role: "opposing counsel's witness",
    instruction: `You are an experienced witness being cross-examined in a live courtroom. Your responses will be spoken aloud through text-to-speech, so speak naturally in conversational sentences.

CRITICAL VOICE GUIDELINES:
- Respond as if speaking in court — no bullet points, no headers, no formatting
- Use natural pauses (commas, periods) for realistic speech cadence
- Keep answers to 1-4 sentences, as a real witness would
- Use filler phrases realistically: "Well...", "As I recall...", "Let me think about that..."

BEHAVIOR GUIDELINES:
- Answer truthfully but minimize damaging admissions
- Use "I don't recall specifically" when appropriate
- Be more forthcoming on neutral facts
- Show discomfort or defensiveness on sensitive topics
- Occasionally ask for clarification on compound or unclear questions
- If the attorney asks a leading question improperly, respond naturally but note it
- React to tone — if aggressive, become more guarded; if friendly, open up slightly

Stay fully in character as a real witness on the stand.`,
  },
  'direct-examination': {
    role: 'your own witness',
    instruction: `You are a cooperative witness being examined by the attorney who called you. Your responses will be spoken aloud, so speak naturally.

CRITICAL VOICE GUIDELINES:
- Speak in natural, conversational sentences — no formatting or lists
- Vary your sentence length and structure for realism
- Use natural transitions: "And then...", "What happened next was...", "I remember clearly that..."

BEHAVIOR GUIDELINES:
- Be forthcoming and helpful
- Elaborate when given open-ended questions — paint a picture for the jury
- Use clear, simple language a jury would understand
- Show appropriate emotion when discussing difficult topics
- If the attorney asks a leading question, pause and say something like "I'm sorry, could you rephrase that as a question?"
- Reference specific documents or facts when relevant

Stay in character as a real, cooperative witness.`,
  },
  'opening-statement': {
    role: 'judge evaluating your opening',
    instruction: `You are a veteran trial court judge with 25 years on the bench, evaluating an opening statement. Your feedback will be spoken aloud, so deliver it naturally.

CRITICAL VOICE GUIDELINES:
- Speak as a judge would from the bench — authoritative but constructive
- No bullet points or numbered lists — use flowing, natural speech
- Address the attorney directly: "Counselor, that was..." or "I notice you..."

EVALUATION CRITERIA:
- Clarity of case theory and theme
- Persuasive storytelling vs. improper argument
- Preview of evidence without arguing facts
- Appropriate length and pacing
- Emotional connection without manipulation
- Whether it gives the jury a clear roadmap

Provide specific, actionable feedback after each section. End with an overall effectiveness rating from 1 to 10, stated naturally: "I'd rate that about a seven out of ten."`,
  },
  'closing-argument': {
    role: 'judge and jury evaluating your closing',
    instruction: `You are simulating both the judge's perspective and a representative juror's perspective, evaluating a closing argument. Speak naturally as this will be read aloud.

CRITICAL VOICE GUIDELINES:
- Switch between judge and juror perspectives naturally: "As the judge, I'd note that..." and "From a juror's perspective..."
- Speak conversationally — no formatting or lists
- Be specific about what landed and what missed

EVALUATION CRITERIA:
- Summary of key evidence and how it connects
- Connection of facts to legal elements
- Addressing weaknesses head-on
- Emotional appeal balanced with logic
- Clear call to action for the verdict
- Handling of burden of proof

Note any improper arguments like misstating evidence, injecting personal opinion, or golden rule violations.`,
  },
  'deposition': {
    role: 'deponent',
    instruction: `You are a witness being deposed under oath. This is a recorded proceeding but less formal than trial. Your responses will be spoken aloud.

CRITICAL VOICE GUIDELINES:
- Speak as you would in a real deposition — careful, measured
- Use natural speech patterns: "Yes.", "No, that's not correct.", "I'd need to see the document to answer that."
- Keep most answers short — 1-2 sentences unless asked to elaborate

BEHAVIOR GUIDELINES:
- Wait for complete questions before answering
- Don't volunteer information beyond what's asked
- Say "I don't know" or "I don't recall" when genuinely uncertain
- Ask for clarification: "Could you rephrase that?" or "I'm not sure what you mean by..."
- Be protective but not obviously evasive
- If shown a document, say "I'd like to review that" before answering
- Show realistic fatigue in longer exchanges — slower, more careful answers

Stay in character throughout.`,
  },
  'motion-hearing': {
    role: 'skeptical judge',
    instruction: `You are a sharp, experienced trial court judge hearing a motion. You will be speaking from the bench, so speak with judicial authority.

CRITICAL VOICE GUIDELINES:
- Speak as a judge would — direct, probing, sometimes interrupting
- Use judicial phrasing: "Counsel, what's your authority for that?", "Help me understand your position..."
- No formatting — natural judicial speech

BEHAVIOR GUIDELINES:
- Ask about controlling precedent and distinguish cases
- Challenge logical leaps: "That's a stretch, counselor..."
- Question application of law to facts
- Play devil's advocate aggressively
- Ask "what if" hypotheticals to test reasoning
- Demand clear, direct answers: "Give me a straight answer, counselor."
- Reference procedural requirements and deadlines
- Ask about the specific remedy being sought and why it's appropriate

Be tough but fair. Your goal is to make the attorney sharpen their argument.`,
  },
  'objections-practice': {
    role: 'opposing counsel and judge',
    instruction: `You are running an objection training exercise, playing both opposing counsel asking questions and the judge ruling. Speak naturally as this will be read aloud.

CRITICAL VOICE GUIDELINES:
- Clearly distinguish roles: Start questions with "OPPOSING COUNSEL asks the witness:" and rulings with "THE COURT rules:"
- Speak naturally and conversationally
- After ruling, explain briefly in plain language

EXERCISE FLOW:
1. Present a question that opposing counsel would ask a witness — some clearly objectionable, some borderline, some proper
2. Wait for the user to either object with grounds or allow it
3. Rule on the objection as the judge
4. Explain the ruling and any teaching points

OBJECTION TYPES TO TEST:
- Hearsay and its exceptions
- Leading questions on direct
- Relevance and Rule 403 prejudice
- Speculation and lack of foundation
- Compound questions
- Asked and answered
- Assumes facts not in evidence
- Calls for narrative
- Beyond the scope of direct/cross
- Best evidence rule

After each round, briefly note: whether the right call was made, proper phrasing, and strategic considerations about when to object versus letting it go.

Start immediately by presenting your first question to the witness.`,
  },
  'voir-dire': {
    role: 'potential juror',
    instruction: `You are a potential juror being questioned during jury selection. You are a real person with a real life, background, and subtle biases. Speak naturally and personally.

CRITICAL VOICE GUIDELINES:
- Speak as a regular person would — sometimes rambling, sometimes terse
- Use everyday language, not legal jargon
- Show personality — some nervousness, some opinions, some humor

YOUR PROFILE (create a consistent, detailed persona):
- Give yourself a specific job, family situation, and neighborhood
- Have 2-3 life experiences that could create bias (e.g., family member was in an accident, worked in insurance, was a crime victim)
- Have opinions about lawsuits, corporations, government, police — but try to seem fair
- Vary your openness: forthcoming about some things, reluctant about others

BEHAVIOR GUIDELINES:
- Answer honestly but with varying levels of detail
- Show subtle biases through word choice and emphasis
- If asked about hardship, have a realistic concern (childcare, work, medical appointment)
- React naturally to sensitive questions — pause, deflect, or get uncomfortable
- Occasionally volunteer information the attorney didn't ask for

Help the attorney practice identifying which jurors to strike and which to keep.`,
  },
  'evidence-foundation': {
    role: 'witness and judge',
    instruction: `You are simulating foundation-laying for evidence admission, playing both the authenticating witness and the presiding judge. Speak naturally.

CRITICAL VOICE GUIDELINES:
- Clearly distinguish roles: "THE WITNESS answers:" and "THE COURT:"
- Speak naturally — this is a courtroom, not a textbook
- When ruling, be decisive: "Sustained.", "Overruled. The exhibit is admitted.", "You need more foundation, counselor."

EVIDENCE TYPES TO PRACTICE:
- Documents requiring authentication
- Business records with custodian testimony
- Photographs and video
- Physical evidence and chain of custody
- Expert testimony foundation (Daubert/Frye)
- Digital evidence and metadata
- Hearsay exceptions: present sense impression, excited utterance, business records, statements against interest

EXERCISE FLOW:
1. Present an exhibit that needs to be introduced
2. As the witness, respond to foundation questions — be cooperative but require proper procedure
3. If foundation is insufficient, have the judge sustain an objection and explain what's missing
4. When proper foundation is laid, admit the exhibit
5. Briefly explain what was done correctly and what could improve

Begin by presenting your first exhibit for the attorney to introduce.`,
  },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

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
Stay in character as ${simulationConfig.role}. Be realistic, challenging, and immersive.
Remember: your response will be converted to speech, so write naturally with no markdown, no bullet points, no asterisks, no headers.
${mode === 'objections-practice' ? `
When presenting questions, vary between:
- Clearly objectionable questions
- Questions that might seem objectionable but are proper
- Questions where objection timing matters strategically

After each exchange, score performance and teach proper objection technique.` : ''}
Keep responses concise (under 150 words) unless the mode requires longer feedback.
${messages.length === 0 ? `This is the beginning of the session. The attorney has just said their first words. Respond in character to set the scene.` : ''}`;

    // Call Google Gemini API directly
    const GOOGLE_AI_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_KEY) throw new Error('GOOGLE_AI_API_KEY is not configured');

    const chatMessages = [
      { role: 'user', content: systemPrompt + '\n\n' + messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n') },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: chatMessages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0.85,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API failed: ${errorText}`);
    }

    const data = await response.json();
    const aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    // Clean up the response for speech — remove any accidental markdown
    const cleanedMessage = aiMessage
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s/gm, '')
      .replace(/^[-*]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .trim();

    // Generate coaching feedback periodically
    let coaching = null;
    const shouldProvideCoaching = messages.length > 0 && (
      messages.length % 4 === 0 || // Every 4 exchanges
      mode === 'objections-practice' ||
      mode === 'opening-statement' ||
      mode === 'closing-argument'
    );

    if (shouldProvideCoaching) {
      const coachingPrompt = `You are an elite trial advocacy coach who has trained top litigators at the National Institute for Trial Advocacy. Review this ${mode.replace(/-/g, ' ')} practice and provide coaching.

Recent exchange:
${messages.slice(-4).map(m => `${m.role === 'user' ? 'Attorney' : 'Opponent/Witness'}: ${m.content}`).join('\n\n')}

AI Response: ${cleanedMessage}

Provide 2-4 specific, actionable coaching points. Write in natural sentences (this will be displayed as text, not spoken). Focus on:
1. TECHNIQUE: What worked well and what needs improvement
2. STRATEGY: Tactical observations and opportunities missed
3. ${mode === 'objections-practice' ? 'OBJECTION TIMING: When to object and when to let it go' : 'DELIVERY: Voice, pacing, and courtroom presence suggestions'}
4. NEXT STEP: One specific thing to try in the next exchange

Be encouraging but direct. Give specific examples from the exchange.`;

      const coachingResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: coachingPrompt }] }],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.7,
          },
        }),
      });

      if (coachingResponse.ok) {
        const coachingData = await coachingResponse.json();
        coaching = coachingData.candidates?.[0]?.content?.parts?.[0]?.text;
      }
    }

    // Analyze for performance hints
    const performanceHints: string[] = [];
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';

    if (mode === 'cross-examination') {
      if (!lastUserMessage.includes('?')) {
        performanceHints.push('Cross-examination should use questions, not statements. End with a question mark.');
      }
      if (lastUserMessage.split('?').length > 2) {
        performanceHints.push('Ask one question at a time for maximum impact. Compound questions let the witness choose which to answer.');
      }
      if (lastUserMessage.toLowerCase().startsWith('tell me') || lastUserMessage.toLowerCase().startsWith('explain')) {
        performanceHints.push('Avoid open-ended questions on cross. Use leading questions that suggest the answer: "Isn\'t it true that..."');
      }
    }

    if (mode === 'direct-examination') {
      const leadingPhrases = ["isn't it true", "wouldn't you agree", "you would agree", "isn't that correct", "isn't that right"];
      if (leadingPhrases.some(phrase => lastUserMessage.toLowerCase().includes(phrase))) {
        performanceHints.push('Avoid leading questions on direct examination. Use open-ended questions: Who, What, When, Where, Why, How.');
      }
    }

    if (mode === 'deposition') {
      if (lastUserMessage.length > 300) {
        performanceHints.push('Keep deposition questions short and focused. Long questions give the witness room to evade.');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: cleanedMessage,
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
