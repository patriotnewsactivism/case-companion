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
  mode: 'cross-examination' | 'direct-examination' | 'opening-statement' | 'closing-argument' | 'deposition' | 'motion-hearing' | 'objections-practice' | 'voir-dire' | 'evidence-foundation' | 'deposition-prep';
  messages: Message[];
  context?: string;
  scenario?: string;
  objectionContext?: {
    lastQuestion?: string;
    objectionType?: string;
  };
}

interface DepositionPrepQuestion {
  question: string;
  type: 'foundational' | 'trap' | 'clarifying' | 'impeachment';
  purpose: string;
  risk: 'low' | 'medium' | 'high';
  followUp: string;
  targetDocument?: string;
}

type AIProvider = 'gemini' | 'openai' | 'fallback';

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
  'deposition-prep': {
    role: 'senior litigation partner',
    instruction: `You are a senior litigation partner with 30 years of deposition experience, helping generate strategic deposition questions. Your response will be used to create a structured question list.

CRITICAL OUTPUT GUIDELINES:
- Generate 4-8 high-quality deposition questions
- For each question, provide: the question text, type (foundational/trap/clarifying/impeachment), purpose, risk level (low/medium/high), and suggested follow-up
- Format each question clearly with numbered sections
- Focus on questions that extract valuable testimony or create impeachment opportunities

QUESTION GENERATION APPROACH:
1. Review the case documents and identify key facts that need testimony
2. Look for contradictions between documents that can be exploited
3. Create foundational questions to establish facts
4. Design trap questions that expose credibility issues
5. Include clarifying questions to pin down vague areas
6. Develop impeachment questions using document evidence

OUTPUT FORMAT for each question:
QUESTION [number]: [the actual question text]
TYPE: [foundational/trap/clarifying/impeachment]
PURPOSE: [strategic purpose]
RISK: [low/medium/high]
FOLLOW-UP: [suggested follow-up question]
TARGET DOCUMENT: [relevant document name if applicable]

Be strategic and thorough. Focus on questions that will advance the case theory and expose weaknesses in the opposing side's position.`,
  },
};

function buildFallbackResponse(mode: SimulationRequest['mode'], lastUserMessage: string): string {
  const question = lastUserMessage.trim() || "Could you restate your question for the record?";

  switch (mode) {
    case 'cross-examination':
      return `Well, as I recall, ${question.toLowerCase().includes("date") ? "the dates are in that general timeframe, but I would need the document in front of me to be exact." : "that's not exactly how I would characterize it. I can answer directly, but I want to be precise about what I personally observed."}`;
    case 'direct-examination':
      return "Yes, counselor. From my perspective, the key point is that the sequence of events was consistent with what we documented at the time, and nothing about your question changes that account.";
    case 'opening-statement':
      return "Counselor, your structure is clear, but tighten your theme in the first thirty seconds and anchor it to two concrete facts the jury can remember. If you do that, your opening will land with more confidence and credibility.";
    case 'closing-argument':
      return "From the bench, I see a solid framework, but you need a sharper link between your strongest facts and each legal element. From a juror's perspective, the argument is persuasive when it stays specific and avoids broad conclusions.";
    case 'deposition':
      return "I understand the question. Based on what I remember right now, that's accurate in part, but I'd want to review the underlying record before giving a more detailed answer.";
    case 'motion-hearing':
      return "Counsel, I understand your position, but I need your best authority and a clearer explanation of how the facts satisfy that standard. Give me the narrowest rule that controls this issue.";
    case 'objections-practice':
      return "OPPOSING COUNSEL asks the witness: \"After speaking with your manager, you concluded the product was defective, correct?\"";
    case 'voir-dire':
      return "Sure. I work full-time and have two kids, so scheduling is a concern for me, but I can still be fair if selected. I do try to listen to evidence before making up my mind.";
    case 'evidence-foundation':
      return "THE WITNESS answers: I recognize this document and I have seen it in the ordinary course of business. THE COURT: Counsel, continue laying foundation with who created it and when it was maintained.";
    case 'deposition-prep':
      return "QUESTION 1: Please identify this document and explain when you first reviewed it.\nTYPE: foundational\nPURPOSE: Establish authentication and personal knowledge.\nRISK: low\nFOLLOW-UP: What specific portion did you rely on?\nTARGET DOCUMENT: Primary incident record";
    default:
      return "I understand your question. Let me answer carefully so the record is clear.";
  }
}

function buildFallbackCoaching(mode: SimulationRequest['mode'], lastUserMessage: string): string {
  const trimmed = lastUserMessage.trim();
  const concise = trimmed.length > 180 ? "shorter and more focused" : "specific and controlled";

  switch (mode) {
    case 'cross-examination':
      return `Your last question should be ${concise}. Use one fact per question, avoid compound phrasing, and end with a firm yes-or-no structure to control the witness.`;
    case 'direct-examination':
      return "Keep your questions open and chronological. Ask one clear fact question, then one follow-up that ties the answer to your case theme.";
    case 'objections-practice':
      return "State the objection first, then the narrowest legal ground. If the question is salvageable, ask the court to require rephrasing instead of over-objecting.";
    default:
      return "Your delivery is improving. Keep each question purposeful, tie it to a concrete fact, and use your next exchange to close any ambiguity left in the answer.";
  }
}

function normalizeDepositionQuestionType(value: unknown): DepositionPrepQuestion['type'] {
  const type = String(value || '').toLowerCase().trim();
  if (type === 'foundational' || type === 'trap' || type === 'clarifying' || type === 'impeachment') {
    return type;
  }
  return 'foundational';
}

function normalizeDepositionRisk(value: unknown): DepositionPrepQuestion['risk'] {
  const risk = String(value || '').toLowerCase().trim();
  if (risk === 'low' || risk === 'medium' || risk === 'high') {
    return risk;
  }
  return 'medium';
}

function parseDepositionQuestionsFromJson(rawText: string): DepositionPrepQuestion[] {
  const candidates: string[] = [rawText.trim()];
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const jsonObjectMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch?.[0]) {
    candidates.push(jsonObjectMatch[0].trim());
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const source = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).questions)
          ? (parsed as Record<string, unknown>).questions as unknown[]
          : [];

      const questions = source
        .map((item): DepositionPrepQuestion | null => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          const question = String(record.question || '').trim();
          if (!question) return null;

          return {
            question,
            type: normalizeDepositionQuestionType(record.type),
            purpose: String(record.purpose || 'Establish relevant testimony tied to case facts.').trim(),
            risk: normalizeDepositionRisk(record.risk ?? record.riskLevel),
            followUp: String(record.followUp ?? record.suggestedFollowUp ?? 'What specific fact supports that answer?').trim(),
            targetDocument: record.targetDocument ? String(record.targetDocument).trim() : undefined,
          };
        })
        .filter((item): item is DepositionPrepQuestion => !!item);

      if (questions.length > 0) {
        return questions.slice(0, 8);
      }
    } catch {
      // Keep trying other JSON candidates.
    }
  }

  return [];
}

function parseDepositionQuestionsFromText(rawText: string): DepositionPrepQuestion[] {
  const questions: DepositionPrepQuestion[] = [];
  const lines = rawText.split('\n');
  let current: Partial<DepositionPrepQuestion> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(QUESTION\s*\d*[:-]|\d+[.)]\s+)/i.test(trimmed)) {
      if (current?.question) {
        questions.push({
          question: current.question,
          type: normalizeDepositionQuestionType(current.type),
          purpose: String(current.purpose || 'Establish relevant testimony tied to case facts.'),
          risk: normalizeDepositionRisk(current.risk),
          followUp: String(current.followUp || 'What specific fact supports that answer?'),
          targetDocument: current.targetDocument,
        });
      }

      const questionText = trimmed
        .replace(/^(QUESTION\s*\d*[:-]|\d+[.)]\s+)/i, '')
        .trim();

      current = questionText ? { question: questionText } : null;
      continue;
    }

    if (!current) continue;

    const typeMatch = trimmed.match(/^TYPE:\s*(.+)$/i);
    const purposeMatch = trimmed.match(/^PURPOSE:\s*(.+)$/i);
    const riskMatch = trimmed.match(/^RISK:\s*(.+)$/i);
    const followUpMatch = trimmed.match(/^FOLLOW[- ]?UP:\s*(.+)$/i);
    const targetDocMatch = trimmed.match(/^TARGET DOCUMENT:\s*(.+)$/i);

    if (typeMatch) current.type = typeMatch[1].trim() as DepositionPrepQuestion['type'];
    if (purposeMatch) current.purpose = purposeMatch[1].trim();
    if (riskMatch) current.risk = riskMatch[1].trim() as DepositionPrepQuestion['risk'];
    if (followUpMatch) current.followUp = followUpMatch[1].trim();
    if (targetDocMatch) current.targetDocument = targetDocMatch[1].trim();
  }

  if (current?.question) {
    questions.push({
      question: current.question,
      type: normalizeDepositionQuestionType(current.type),
      purpose: String(current.purpose || 'Establish relevant testimony tied to case facts.'),
      risk: normalizeDepositionRisk(current.risk),
      followUp: String(current.followUp || 'What specific fact supports that answer?'),
      targetDocument: current.targetDocument,
    });
  }

  return questions.slice(0, 8);
}

function parseDepositionPrepQuestions(rawText: string): DepositionPrepQuestion[] {
  const fromJson = parseDepositionQuestionsFromJson(rawText);
  if (fromJson.length > 0) return fromJson;
  return parseDepositionQuestionsFromText(rawText);
}

function buildFallbackDepositionQuestions(documentNames: string[]): DepositionPrepQuestion[] {
  const docs = documentNames.filter(Boolean);

  const templates: DepositionPrepQuestion[] = [
    {
      question: 'Please identify this document and explain when you first reviewed it.',
      type: 'foundational',
      purpose: 'Establish authentication and personal knowledge before substantive questioning.',
      risk: 'low',
      followUp: 'Who gave you this document and what did you do after reading it?',
      targetDocument: docs[0],
    },
    {
      question: 'Your testimony today is that timeline was clear, but this document reflects a different date. Which is accurate?',
      type: 'impeachment',
      purpose: 'Create a direct credibility conflict between testimony and written record.',
      risk: 'high',
      followUp: 'What contemporaneous evidence supports your version over the document?',
      targetDocument: docs[1] || docs[0],
    },
    {
      question: 'What specific facts did you rely on before making that decision?',
      type: 'clarifying',
      purpose: 'Pin down vague conclusions and force concrete factual commitments.',
      risk: 'medium',
      followUp: 'Can you identify the exact line or exhibit that supports that point?',
      targetDocument: docs[2] || docs[0],
    },
    {
      question: 'You did not mention this fact in your prior statement, correct?',
      type: 'trap',
      purpose: 'Set up omission-based impeachment and expose selective memory.',
      risk: 'high',
      followUp: 'Why should the record now include this fact when your prior statement did not?',
      targetDocument: docs[3] || docs[0],
    },
  ];

  return templates.slice(0, 8);
}

function cleanModelMessage(rawMessage: string): string {
  return rawMessage
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/^[-*]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .trim();
}

async function callGemini(
  prompt: string,
  googleApiKey: string,
  maxOutputTokens: number,
  temperature: number
): Promise<string | null> {
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
    const content = (firstCandidate?.content || {}) as Record<string, unknown>;
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const text = parts
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        return String((part as Record<string, unknown>).text || '');
      })
      .join('')
      .trim();

    return text || null;
  } catch (error) {
    console.error('Gemini request failed:', error);
    return null;
  }
}

async function callOpenAICompatible(
  systemPrompt: string,
  messages: Message[],
  apiKey: string,
  gatewayUrl: string,
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
            .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
            .map((msg) => ({ role: msg.role, content: msg.content })),
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI-compatible API error:', errorText);
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = (firstChoice?.message || firstChoice?.delta || {}) as Record<string, unknown>;
    const content = message.content;

    if (typeof content === 'string' && content.trim().length > 0) {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          return String((item as Record<string, unknown>).text || '');
        })
        .join('')
        .trim();
      if (text) return text;
    }

    const outputText = data.output_text;
    if (typeof outputText === 'string' && outputText.trim().length > 0) {
      return outputText.trim();
    }

    return null;
  } catch (error) {
    console.error('OpenAI-compatible request failed:', error);
    return null;
  }
}

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
    const messages = (Array.isArray(requestBody.messages) ? requestBody.messages : [])
      .filter((message): message is Message => {
        if (!message || typeof message !== 'object') return false;
        const candidate = message as Record<string, unknown>;
        return (
          (candidate.role === 'user' || candidate.role === 'assistant' || candidate.role === 'system') &&
          typeof candidate.content === 'string'
        );
      })
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 4000),
      }));
    const scenarioContext = typeof requestBody.scenario === 'string'
      ? requestBody.scenario.trim().slice(0, 300)
      : '';
    const additionalContext = typeof requestBody.context === 'string'
      ? requestBody.context.trim().slice(0, 6000)
      : '';

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
      .select('name, summary, key_facts, favorable_findings, adverse_findings, action_items, ocr_text, ai_analyzed')
      .eq('case_id', caseId)
      .limit(20);

    // Get depositions for context
    const { data: depositions } = await supabase
      .from('depositions')
      .select('deponent_name, deponent_type, summary, key_testimony')
      .eq('case_id', caseId)
      .limit(10);

    // Get witness prep data for personalized simulations
    const { data: witnessPrep } = await supabase
      .from('witness_prep')
      .select('witness_name, witness_type, key_topics, preparation_notes, personality, simulation_notes')
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

    const prioritizedDocuments = (documents || []).filter((doc) =>
      doc.ai_analyzed || !!doc.summary || !!doc.ocr_text || (doc.key_facts || []).length > 0
    );
    const documentsForContext = prioritizedDocuments.length > 0 ? prioritizedDocuments : (documents || []);

    const documentContext = documentsForContext.map(doc => ({
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

    const witnessPrepContext = witnessPrep?.map(wp => ({
      name: wp.witness_name,
      type: wp.witness_type,
      keyTopics: wp.key_topics || [],
      notes: wp.preparation_notes,
      personality: wp.personality,
      simulationNotes: wp.simulation_notes,
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
${scenarioContext ? `Requested Scenario: ${scenarioContext}` : ''}

=== KEY DOCUMENTS (${documentContext.length} available) ===
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

${witnessPrepContext.length > 0 ? `=== WITNESS PROFILES ===
${witnessPrepContext.map(wp => `
${wp.name} (${wp.type || 'Witness'}):
- Personality: ${wp.personality || 'cooperative'}
- Key Topics: ${wp.keyTopics.slice(0, 3).join('; ') || 'N/A'}
- Preparation Notes: ${wp.notes || 'N/A'}
${wp.simulationNotes ? `- Simulation Notes: ${wp.simulationNotes}` : ''}
`).join('\n')}` : ''}

${timelineContext.length > 0 ? `=== CASE TIMELINE ===
${timelineContext.slice(0, 10).map(event =>
  `${event.date}: ${event.title}${event.description ? ` - ${event.description}` : ''}`
).join('\n')}` : ''}

${additionalContext ? `=== ADDITIONAL ATTORNEY CONTEXT ===
${additionalContext}` : ''}

=== INSTRUCTIONS ===
Stay in character as ${simulationConfig.role}. Be realistic, challenging, and immersive. 

TACTICAL INTELLIGENCE:
- If the attorney asks a compound question, the witness should look confused and ask for clarification.
- If the attorney is too aggressive on cross, the witness should become more guarded and terse.
- If the attorney asks a question that assumes a fact not in evidence (based on the CASE INFORMATION provided), point it out in character: "I never said that happened, counselor."
- The "Skeptical Judge" should interrupt if the attorney rambles or misstates the law.

VOICE CADENCE:
- Your response will be converted to speech. Write naturally. 
- Use short sentences for witnesses.
- Use authoritative, well-paced sentences for judges.
- No markdown, no bullet points, no asterisks, no headers.

${mode === 'deposition-prep'
  ? `Return ONLY valid JSON using this exact shape:
{"questions":[{"question":"...","type":"foundational|trap|clarifying|impeachment","purpose":"...","risk":"low|medium|high","followUp":"...","targetDocument":"..."}]}
No markdown, no code fences, and no text outside the JSON object.`
  : 'Response must be pure text for speech synthesis.'}
${mode === 'objections-practice' ? `
When presenting questions, vary between:
- Clearly objectionable questions
- Questions that might seem objectionable but are proper
- Questions where objection timing matters strategically

After each exchange, score performance and teach proper objection technique.` : ''}
${mode === 'deposition-prep'
  ? 'Generate 4-8 strategically varied questions and ensure each one includes purpose, risk, and follow-up.'
  : 'Keep responses concise (under 150 words) unless the mode requires longer feedback.'}
${messages.length === 0 && mode !== 'deposition-prep'
  ? 'This is the beginning of the session. The attorney has just said their first words. Respond in character to set the scene.'
  : ''}`;
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY')?.trim() || '';
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim() || '';
    const aiGatewayUrl = Deno.env.get('AI_GATEWAY_URL') || 'https://api.openai.com/v1/chat/completions';
    const aiGatewayModel = Deno.env.get('AI_GATEWAY_MODEL') || 'gpt-4o-mini';
    const maxOutputTokens = mode === 'deposition-prep' ? 1200 : 900;
    const modelTemperature = mode === 'deposition-prep' ? 0.6 : 0.85;
    const chatPrompt = systemPrompt + '\n\n' + messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    let aiMessage: string | null = null;
    let provider: AIProvider = 'fallback';

    if (googleApiKey) {
      aiMessage = await callGemini(chatPrompt, googleApiKey, maxOutputTokens, modelTemperature);
      if (aiMessage) provider = 'gemini';
    }

    if (!aiMessage && openAiApiKey) {
      aiMessage = await callOpenAICompatible(
        systemPrompt,
        messages,
        openAiApiKey,
        aiGatewayUrl,
        aiGatewayModel,
        maxOutputTokens,
        modelTemperature
      );
      if (aiMessage) provider = 'openai';
    }

    if (!aiMessage) {
      console.warn('No AI provider available. Using deterministic fallback response.');
      const fallbackLastUserMessage = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
      const fallbackMessage = buildFallbackResponse(mode, fallbackLastUserMessage);
      const fallbackCoaching = mode !== 'deposition-prep' && messages.length > 0
        ? buildFallbackCoaching(mode, fallbackLastUserMessage)
        : null;
      const fallbackQuestions = mode === 'deposition-prep'
        ? buildFallbackDepositionQuestions(documentContext.map((doc) => doc.name))
        : undefined;

      return new Response(
        JSON.stringify({
          success: true,
          message: fallbackMessage,
          coaching: fallbackCoaching,
          role: simulationConfig.role,
          performanceHints: undefined,
          objectionTypes: mode === 'objections-practice' ? OBJECTION_TYPES : undefined,
          questions: fallbackQuestions,
          provider,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanedMessage = cleanModelMessage(aiMessage);
    const parsedDepositionQuestions = mode === 'deposition-prep'
      ? parseDepositionPrepQuestions(aiMessage)
      : [];
    const depositionQuestions = mode === 'deposition-prep'
      ? (parsedDepositionQuestions.length > 0
          ? parsedDepositionQuestions
          : buildFallbackDepositionQuestions(documentContext.map((doc) => doc.name)))
      : undefined;

    // Generate coaching feedback periodically
    let coaching = null;
    const shouldProvideCoaching = mode !== 'deposition-prep' && messages.length > 0 && (
      messages.length % 3 === 0 ||
      mode === 'objections-practice' ||
      mode === 'opening-statement' ||
      mode === 'closing-argument'
    );

    if (shouldProvideCoaching) {
      const coachingPrompt = `Review this ${mode.replace(/-/g, ' ')} practice and provide coaching.\n\nRecent exchange:\n${messages.slice(-4).map((m) => `${m.role === 'user' ? 'Attorney' : 'Opponent/Witness'}: ${m.content}`).join('\n\n')}\n\nAI Response: ${cleanedMessage}\n\nProvide 2-4 specific, actionable coaching points. Write in natural sentences (this will be displayed as text, not spoken). Focus on:\n1. TECHNIQUE: What worked well and what needs improvement\n2. STRATEGY: Tactical observations and opportunities missed\n3. ${mode === 'objections-practice' ? 'OBJECTION TIMING: When to object and when to let it go' : 'DELIVERY: Voice, pacing, and courtroom presence suggestions'}\n4. NEXT STEP: One specific thing to try in the next exchange\n\nBe encouraging but direct. Give specific examples from the exchange.`;

      if (provider === 'gemini' && googleApiKey) {
        coaching = await callGemini(
          `You are an elite trial advocacy coach who has trained top litigators at the National Institute for Trial Advocacy.\n\n${coachingPrompt}`,
          googleApiKey,
          300,
          0.7
        );
      }

      if (!coaching && openAiApiKey) {
        coaching = await callOpenAICompatible(
          'You are an elite trial advocacy coach who has trained top litigators at the National Institute for Trial Advocacy.',
          [{ role: 'user', content: coachingPrompt }],
          openAiApiKey,
          aiGatewayUrl,
          aiGatewayModel,
          350,
          0.7
        );
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
        questions: depositionQuestions,
        provider,
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

