import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { callAzureOpenAI } from '../_shared/azureOpenAI.ts';

interface Juror {
  id: string;
  name: string;
  age: number;
  occupation: string;
  education: string;
  background: string;
  biases: string[];
  leaningScore: number;
  avatar: string;
}

interface DeliberationStatement {
  jurorId: string;
  statement: string;
  timestamp: number;
}

interface JuryVerdict {
  verdict: 'guilty' | 'not_guilty' | 'hung';
  confidence: number;
  voteTally: { guilty: number; notGuilty: number };
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
}

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda',
  'David', 'Elizabeth', 'Richard', 'Barbara', 'Joseph', 'Susan', 'Thomas', 'Jessica',
  'Charles', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley',
  'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna', 'Kenneth', 'Michelle',
  'Kevin', 'Dorothy', 'Brian', 'Carol', 'George', 'Amanda', 'Edward', 'Melissa',
  'Ronald', 'Deborah', 'Timothy', 'Stephanie', 'Jason', 'Rebecca', 'Jeffrey', 'Sharon',
  'Ryan', 'Laura', 'Jacob', 'Cynthia', 'Gary', 'Kathleen', 'Nicholas', 'Amy',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
];

const OCCUPATIONS = [
  'Teacher', 'Nurse', 'Engineer', 'Accountant', 'Retail Manager', 'Truck Driver',
  'Office Administrator', 'Construction Worker', 'Sales Representative', 'IT Specialist',
  'Social Worker', 'Police Officer', 'Chef', 'Electrician', 'Realtor',
  'Bank Teller', 'Mechanic', 'Farmer', 'Doctor', 'Lawyer',
  'Small Business Owner', 'Postal Worker', 'Factory Supervisor', 'HR Manager',
  'Marketing Coordinator', 'Financial Analyst', 'Architect', 'Dentist', 'Veterinarian',
  'Flight Attendant', 'Security Guard', 'Plumber', 'Carpenter', 'Journalist',
];

const EDUCATION_LEVELS = [
  'High School Diploma',
  'Some College',
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  'Trade School Certificate',
  'GED',
  'Some Graduate Studies',
];

const BIAS_TEMPLATES = [
  'Skeptical of large corporations',
  'Trusts law enforcement',
  'Sympathetic to small business owners',
  'Concerned about government overreach',
  'Values personal responsibility',
  'Believes in second chances',
  'Suspicious of insurance companies',
  'Strong work ethic values',
  'Family-oriented perspective',
  'Community-focused mindset',
  'Skeptical of expert testimony',
  'Values documented evidence',
  'Concerned about false accusations',
  'Believes in system fairness',
  'Questioning of authority',
  'Supportive of victim rights',
  'Defense-leaning tendencies',
  'Prosecution-leaning tendencies',
  'Neutral analytical approach',
  'Emotional decision-maker',
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateJuror(index: number): Juror {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const name = `${firstName} ${lastName}`;
  
  const age = Math.floor(Math.random() * 50) + 25;
  const occupation = OCCUPATIONS[Math.floor(Math.random() * OCCUPATIONS.length)];
  const education = EDUCATION_LEVELS[Math.floor(Math.random() * EDUCATION_LEVELS.length)];
  
  const backgrounds = [
    `${name} is a ${age}-year-old ${occupation.toLowerCase()} who has lived in the area for over ${Math.floor(Math.random() * 20) + 5} years. They hold a ${education.toLowerCase()} and take their civic duties seriously.`,
    `A lifelong resident, ${firstName} has worked as a ${occupation.toLowerCase()} for ${Math.floor(Math.random() * 20) + 3} years. Their ${education.toLowerCase()} background has shaped their methodical approach to problem-solving.`,
    `${name} brings ${Math.floor(Math.random() * 30) + 10} years of experience as a ${occupation.toLowerCase()} to the jury. Educated with a ${education.toLowerCase()}, they value fairness and thorough examination of facts.`,
    `With a ${education.toLowerCase()} and a career in ${occupation.toLowerCase().replace(/^(a|an|the)\s/i, '')}, ${firstName} approaches jury duty with a sense of responsibility and careful consideration.`,
  ];
  
  const numBiases = Math.floor(Math.random() * 3) + 1;
  const shuffledBiases = [...BIAS_TEMPLATES].sort(() => Math.random() - 0.5);
  const biases = shuffledBiases.slice(0, numBiases);
  
  const leaningScore = Math.random() * 0.4 - 0.2;
  
  return {
    id: generateId(),
    name,
    age,
    occupation,
    education,
    background: backgrounds[Math.floor(Math.random() * backgrounds.length)],
    biases,
    leaningScore,
    avatar: `https://picsum.photos/seed/juror${index}${Date.now()}/200/200`,
  };
}

function generateJuryPool(): Juror[] {
  const jurors: Juror[] = [];
  for (let i = 0; i < 12; i++) {
    jurors.push(generateJuror(i));
  }
  return jurors;
}

interface MockJurySessionRecord {
  id: string;
  case_id: string;
  user_id: string;
  opening_statement: string;
  closing_argument: string;
  jurors: Juror[];
  deliberation: DeliberationStatement[];
  verdict: JuryVerdict | null;
  created_at: string;
}

async function simulateDeliberation(
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  caseId: string,
  jurors: Juror[],
  openingStatement: string,
  closingArgument: string
): Promise<{ deliberation: DeliberationStatement[]; verdict: JuryVerdict }> {
  const { data: caseData } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();

  const { data: documents } = await supabase
    .from('documents')
    .select('name, summary, key_facts, favorable_findings, adverse_findings')
    .eq('case_id', caseId)
    .eq('ai_analyzed', true)
    .limit(10);

  const { data: timelineEvents } = await supabase
    .from('timeline_events')
    .select('title, description, event_date')
    .eq('case_id', caseId)
    .order('event_date', { ascending: true })
    .limit(15);

  const caseContext = caseData ? {
    name: caseData.name,
    type: caseData.case_type,
    clientName: caseData.client_name,
    representation: caseData.representation,
    theory: caseData.case_theory,
    keyIssues: caseData.key_issues || [],
    notes: caseData.notes,
  } : null;

  const docContext = documents?.map(d => ({
    name: d.name,
    summary: d.summary,
    facts: d.key_facts || [],
    favorable: d.favorable_findings || [],
    adverse: d.adverse_findings || [],
  })) || [];

  const timelineContext = timelineEvents?.map(e => ({
    date: e.event_date,
    title: e.title,
    description: e.description,
  })) || [];

  const jurorProfiles = jurors.map(j => 
    `Juror ${j.id} (${j.name}): Age ${j.age}, ${j.occupation}, ${j.education}. Background: ${j.background} Biases: ${j.biases.join(', ')}. Leaning: ${j.leaningScore > 0.1 ? 'slightly prosecution' : j.leaningScore < -0.1 ? 'slightly defense' : 'neutral'}.`
  ).join('\n');

  const systemPrompt = `You are simulating a realistic jury deliberation for a legal case. You will roleplay as 12 diverse jurors discussing the case based on the evidence and arguments presented.

JUROR PROFILES:
${jurorProfiles}

CASE INFORMATION:
${caseContext ? `
Case: ${caseContext.name}
Type: ${caseContext.type}
Client: ${caseContext.clientName}
Representation: ${caseContext.representation}
Case Theory: ${caseContext.theory || 'Not specified'}
Key Issues: ${caseContext.keyIssues.join('; ') || 'None specified'}
${caseContext.notes ? `Notes: ${caseContext.notes}` : ''}
` : 'No case information available.'}

KEY DOCUMENTS:
${docContext.slice(0, 5).map((d, i) => `
${i + 1}. ${d.name}
   Summary: ${d.summary || 'N/A'}
   Key Facts: ${d.facts.slice(0, 2).join('; ') || 'N/A'}
   Favorable: ${d.favorable.slice(0, 2).join('; ') || 'N/A'}
   Adverse: ${d.adverse.slice(0, 2).join('; ') || 'N/A'}
`).join('\n')}

TIMELINE:
${timelineContext.slice(0, 10).map(e => `${e.date}: ${e.title}${e.description ? ` - ${e.description}` : ''}`).join('\n')}

ARGUMENTS PRESENTED:
Opening Statement (Plaintiff/Prosecution):
${openingStatement}

Closing Argument (Defense):
${closingArgument}

INSTRUCTIONS:
Generate a realistic deliberation with 8-12 exchanges where jurors discuss the case. Each juror should speak in character based on their profile, background, and biases. Opinions should evolve during the discussion. Some jurors should change their minds, others should be steadfast.

After the deliberation, provide a verdict with:
- Final verdict: "guilty", "not_guilty", or "hung" (for inability to reach consensus)
- Confidence level: 0-100
- Vote tally: how many jurors voted each way
- Reasoning: 2-3 sentences explaining the jury's decision
- Case strengths: 2-4 points the prosecution/plaintiff did well
- Case weaknesses: 2-4 points the defense exploited

Respond in JSON format:
{
  "deliberation": [
    {"jurorId": "id", "statement": "what they say", "timestamp": 1},
    ...
  ],
  "verdict": {
    "verdict": "guilty|not_guilty|hung",
    "confidence": 85,
    "voteTally": {"guilty": 10, "notGuilty": 2},
    "reasoning": "explanation",
    "strengths": ["point 1", "point 2"],
    "weaknesses": ["point 1", "point 2"]
  }
}`;

  const response = await callAzureOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Begin the jury deliberation simulation. Have the jurors discuss the case and reach a verdict.' },
  ], { temperature: 0.8, maxTokens: 3000, jsonMode: true });

  try {
    const result = JSON.parse(response);
    return {
      deliberation: result.deliberation || [],
      verdict: result.verdict,
    };
  } catch {
    throw new Error('Failed to parse deliberation response');
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
        'mock-jury',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;
    const requestBody = (await req.json()) as Record<string, unknown>;
    const action = requestBody.action as string;

    if (action === 'generatePool') {
      const jurors = generateJuryPool();
      return new Response(
        JSON.stringify({ success: true, jurors }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'startDeliberation') {
      validateRequestBody(requestBody, ['caseId', 'openingStatement', 'closingArgument']);
      const caseId = validateUUID(requestBody.caseId, 'caseId');
      const openingStatement = requestBody.openingStatement as string;
      const closingArgument = requestBody.closingArgument as string;

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
          'mock-jury',
          corsHeaders
        );
      }

      const jurors = generateJuryPool();
      
      const { deliberation, verdict } = await simulateDeliberation(
        supabase,
        caseId,
        jurors,
        openingStatement,
        closingArgument
      );

      const sessionId = generateId();
      const sessionRecord: MockJurySessionRecord = {
        id: sessionId,
        case_id: caseId,
        user_id: user.id,
        opening_statement: openingStatement,
        closing_argument: closingArgument,
        jurors,
        deliberation,
        verdict,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('mock_jury_sessions')
        .insert(sessionRecord);

      if (insertError) {
        console.error('Failed to save session:', insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          sessionId,
          deliberation,
          verdict,
          jurors,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return createErrorResponse(
      new Error('Invalid action. Use "generatePool" or "startDeliberation"'),
      400,
      'mock-jury',
      corsHeaders
    );
  } catch (error) {
    console.error('Error in mock-jury function:', error);
    return createErrorResponse(error, 500, 'mock-jury', corsHeaders);
  }
});
