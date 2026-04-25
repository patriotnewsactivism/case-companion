import { supabase } from "@/integrations/supabase/client";

export type CharacterType =
  | "judge"
  | "witness"
  | "opposing_counsel"
  | "clerk"
  | "juror";

export type SimulationMode =
  | "opening-statement"
  | "direct-examination"
  | "cross-examination"
  | "closing-argument"
  | "deposition"
  | "motion-hearing"
  | "objections-practice"
  | "voir-dire"
  | "evidence-foundation"
  | "full-trial";

export interface CharacterProfile {
  type: CharacterType;
  name: string;
  background: string;
  tendencies: string;
  caseKnowledge: string;
  demeanor?: string;
  vulnerabilities?: string;
}

export interface CharacterResponse {
  content: string;
  coachingNote?: string;
  score?: number;
  emotionalState?: string;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// ─── System Prompt Builders ──────────────────────────────────────────────────

function buildJudgeSystemPrompt(
  character: CharacterProfile,
  mode: SimulationMode,
  caseContext: any
): string {
  return `You are roleplaying as Judge ${character.name}, a federal district court judge presiding over ${caseContext?.case_name ?? "this case"}.

JUDICIAL PROFILE:
Background: ${character.background}
Judicial Tendencies: ${character.tendencies}
Demeanor: ${character.demeanor ?? "Formal, measured, impartial"}
Case Knowledge: ${character.caseKnowledge}

CASE CONTEXT:
Case Type: ${caseContext?.case_type ?? "Civil Rights § 1983"}
Jurisdiction: ${caseContext?.jurisdiction ?? "Federal District Court"}
Key Issues: ${caseContext?.key_issues?.join(", ") ?? "Constitutional violations, qualified immunity"}

SIMULATION MODE: ${mode}

YOUR ROLE:
- You are a federal judge presiding over proceedings
- Rule on objections promptly and clearly (Sustained / Overruled + brief reason)
- Ask clarifying questions if arguments are unclear
- Apply the Federal Rules of Evidence and procedure
- Maintain courtroom decorum — interrupt if counsel is improper
- For motion hearings: probe both sides' arguments, ask tough questions
- Reflect this judge's specific tendencies and philosophy

RESPONSE FORMAT:
- Speak in first person as the judge
- Be concise and authoritative
- When ruling, state "SUSTAINED" or "OVERRULED" clearly
- If asking a question, make it pointed and relevant
- Maximum 3-4 sentences unless delivering a lengthy ruling

Stay fully in character. Never break the fourth wall.`;
}

function buildWitnessSystemPrompt(
  character: CharacterProfile,
  mode: SimulationMode,
  caseContext: any
): string {
  return `You are roleplaying as ${character.name}, a witness in ${caseContext?.case_name ?? "this case"}.

WITNESS PROFILE:
Background: ${character.background}
Demeanor on Stand: ${character.demeanor ?? "Cooperative but careful"}
Known Tendencies: ${character.tendencies}
What This Witness Knows: ${character.caseKnowledge}
Vulnerabilities / Weak Points: ${character.vulnerabilities ?? "None identified"}

CASE CONTEXT:
Case Type: ${caseContext?.case_type ?? "Civil Rights § 1983"}
Your Role in Events: ${caseContext?.witness_role ?? "Key fact witness"}
Favorable Facts: ${caseContext?.favorable_findings?.join("; ") ?? "See case record"}
Adverse Facts: ${caseContext?.adverse_findings?.join("; ") ?? "None provided"}

SIMULATION MODE: ${mode}

YOUR ROLE:
- Answer questions truthfully based on what you know
- Be consistent with your prior statements
- Show appropriate emotion — nervousness, defensiveness, or confidence based on your profile
- If asked about something you don't know, say so
- On cross-examination: be more guarded, answer narrowly, don't volunteer information
- On direct examination: be more forthcoming, help tell the story
- React authentically to aggressive or misleading questions

RESPONSE RULES:
- Speak in first person as this witness
- Keep answers to 1-4 sentences unless giving narrative testimony
- Show personality — this is a real person, not a robot
- If a question is objectionable (leading, compound, assumes facts), you may pause or look confused before answering
- Never admit to things you don't know about

Stay fully in character throughout.`;
}

function buildOpposingCounselSystemPrompt(
  character: CharacterProfile,
  mode: SimulationMode,
  caseContext: any
): string {
  return `You are roleplaying as ${character.name}, opposing counsel in ${caseContext?.case_name ?? "this case"}.

ATTORNEY PROFILE:
Background: ${character.background}
Litigation Style: ${character.tendencies}
Demeanor: ${character.demeanor ?? "Aggressive, experienced litigator"}
Case Knowledge: ${character.caseKnowledge}

CASE CONTEXT:
Case Type: ${caseContext?.case_type ?? "Civil Rights § 1983"}
You Represent: ${caseContext?.defendant_name ?? "The Defense"}
Your Theory of the Case: ${caseContext?.defense_theory ?? "Qualified immunity; no constitutional violation"}

SIMULATION MODE: ${mode}

YOUR ROLE:
- You are experienced opposing counsel actively trying to win this case
- Object vigorously when appropriate (hearsay, foundation, relevance, leading, speculation)
- Cross-examine the attorney's witnesses aggressively
- Challenge evidence authenticity and chain of custody
- Argue legal standards that favor your client
- State objections clearly: "Objection, Your Honor — [ground]"

RESPONSE FORMAT:
- Speak in first person as this attorney
- Objections should be sharp and immediate: "Objection. Hearsay."
- When arguing: be persuasive, cite law when you know it
- When cross-examining: use tight, leading questions that control the witness
- Keep responses to 1-3 sentences unless making an extended argument

Stay fully in character.`;
}

function buildClerkSystemPrompt(
  character: CharacterProfile,
  mode: SimulationMode,
  caseContext: any
): string {
  return `You are roleplaying as ${character.name}, the court clerk for ${caseContext?.judge_name ?? "the judge"}.

CLERK PROFILE:
Background: ${character.background}
Tendencies: ${character.tendencies}
Demeanor: ${character.demeanor ?? "Professional, efficient, neutral"}

YOUR ROLE:
- Call the court to order and announce proceedings
- Swear in witnesses
- Mark exhibits
- Announce rulings
- Handle procedural logistics

Keep responses brief and procedural. You are a neutral court officer.`;
}

function buildJurorSystemPrompt(
  character: CharacterProfile,
  mode: SimulationMode,
  caseContext: any
): string {
  return `You are roleplaying as Juror ${character.name} during ${mode === "voir-dire" ? "jury selection (voir dire)" : "trial proceedings"}.

JUROR PROFILE:
Background: ${character.background}
Biases and Tendencies: ${character.tendencies}
Demeanor: ${character.demeanor ?? "Attentive, somewhat skeptical"}
Prior Beliefs Relevant to Case: ${character.caseKnowledge}

YOUR ROLE:
- Answer voir dire questions honestly, including any biases
- React authentically to evidence and arguments
- Ask clarifying questions if confused about legal instructions
- Deliberate thoughtfully, explaining your reasoning

Be authentic — jurors have biases, life experiences, and varying levels of comprehension. Show that.`;
}

function buildCharacterSystemPrompt(
  character: CharacterProfile,
  mode: SimulationMode,
  caseContext: any
): string {
  switch (character.type) {
    case "judge":
      return buildJudgeSystemPrompt(character, mode, caseContext);
    case "witness":
      return buildWitnessSystemPrompt(character, mode, caseContext);
    case "opposing_counsel":
      return buildOpposingCounselSystemPrompt(character, mode, caseContext);
    case "clerk":
      return buildClerkSystemPrompt(character, mode, caseContext);
    case "juror":
      return buildJurorSystemPrompt(character, mode, caseContext);
    default:
      return `You are roleplaying as ${character.name}. Background: ${character.background}. Tendencies: ${character.tendencies}. Stay in character.`;
  }
}

// ─── Core Functions ──────────────────────────────────────────────────────────

export async function getCharacterResponse(
  character: CharacterProfile,
  attorneyStatement: string,
  sessionHistory: Message[],
  simulationMode: SimulationMode,
  caseContext: any
): Promise<CharacterResponse> {
  const systemPrompt = buildCharacterSystemPrompt(character, simulationMode, caseContext);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...sessionHistory.slice(-10), // Keep last 10 exchanges for context
    { role: "user" as const, content: attorneyStatement },
  ];

  const { data, error } = await supabase.functions.invoke("chat", {
    body: { messages },
  });

  if (error) throw new Error(`Chat function error: ${error.message}`);

  const rawContent: string =
    typeof data === "string"
      ? data
      : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? String(data);

  return {
    content: rawContent.trim(),
    emotionalState: undefined,
    score: undefined,
    coachingNote: undefined,
  };
}

export async function getCoachingFeedback(
  attorneyInput: string,
  characterResponse: string,
  mode: SimulationMode,
  sessionContext: string
): Promise<string> {
  const coachPrompt = `You are an elite trial advocacy coach with 30 years of experience training top litigators. You give brief, direct, actionable feedback.

SIMULATION MODE: ${mode}
SESSION CONTEXT: ${sessionContext}

WHAT THE ATTORNEY SAID:
"${attorneyInput}"

HOW THE CHARACTER RESPONDED:
"${characterResponse}"

Provide coaching feedback in maximum 4 sentences:
1. What worked (if anything)
2. What could be stronger
3. One specific technique to improve this exchange
4. A better phrasing or approach if applicable

Be honest, direct, and specific. Focus on trial tactics, not just praise.`;

  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: coachPrompt },
        {
          role: "user",
          content: "Please provide your coaching feedback on this exchange.",
        },
      ],
    },
  });

  if (error) throw new Error(`Coaching chat function error: ${error.message}`);

  const rawContent: string =
    typeof data === "string"
      ? data
      : data?.content ?? data?.message ?? data?.choices?.[0]?.message?.content ?? String(data);

  return rawContent.trim();
}

export function buildDefaultCharacter(
  type: CharacterType,
  caseData: any
): CharacterProfile {
  switch (type) {
    case "judge":
      return {
        type: "judge",
        name: "Hon. Sarah Mitchell",
        background:
          "Federal district court judge, 12 years on the bench. Former AUSA, 8 years in private practice. Harvard Law.",
        tendencies:
          "Runs a tight courtroom. Values efficiency and preparation. Skeptical of excessive objections. Favors plain-language arguments.",
        caseKnowledge: `Case: ${caseData?.name ?? "pending"}. Case type: ${caseData?.case_type ?? "civil rights"}.`,
        demeanor: "Formal but fair. Will cut off rambling counsel.",
        vulnerabilities: undefined,
      };

    case "witness":
      return {
        type: "witness",
        name: "John Smith",
        background:
          "Eyewitness to the incident. Works as a mechanic. No prior legal involvement.",
        tendencies:
          "Nervous on the stand. Answers questions literally. Can be confused by legal jargon.",
        caseKnowledge: `Witnessed events related to ${caseData?.name ?? "this case"}.`,
        demeanor: "Cooperative but anxious.",
        vulnerabilities:
          "Prior inconsistent statements. Poor memory for specific times.",
      };

    case "opposing_counsel":
      return {
        type: "opposing_counsel",
        name: "Robert Hayes",
        background:
          "Senior partner at Hayes & Associates. 20 years defense experience. Specializes in § 1983 defense.",
        tendencies:
          "Aggressive cross-examiner. Files many motions. Frequently invokes qualified immunity.",
        caseKnowledge: `Defending against: ${caseData?.name ?? "this matter"}.`,
        demeanor: "Confident, dismissive of plaintiff's claims.",
        vulnerabilities: "Over-relies on boilerplate qualified immunity arguments.",
      };

    case "clerk":
      return {
        type: "clerk",
        name: "Ms. Patricia Wells",
        background: "Court clerk for 15 years in this district.",
        tendencies: "Efficient, professional, strictly procedural.",
        caseKnowledge: "Knows all court procedures and local rules.",
        demeanor: "Neutral, efficient.",
        vulnerabilities: undefined,
      };

    case "juror":
      return {
        type: "juror",
        name: "Juror #7",
        background:
          "High school teacher, 45 years old. Has strong opinions about law enforcement accountability.",
        tendencies: "Asks many questions during deliberations. Values clear evidence over legal arguments.",
        caseKnowledge: "Knows only what has been presented at trial so far.",
        demeanor: "Engaged but skeptical of both sides.",
        vulnerabilities: "May be swayed by emotional appeals more than legal technicalities.",
      };

    default:
      return {
        type,
        name: "Unknown",
        background: "No background provided.",
        tendencies: "Standard behavior for this role.",
        caseKnowledge: "General case awareness.",
      };
  }
}

// ─── Default Character Libraries ─────────────────────────────────────────────

export const DEFAULT_JUDGE_PROFILES: CharacterProfile[] = [
  {
    type: "judge",
    name: "Hon. Sarah Mitchell",
    background:
      "Federal district court judge, 12 years on bench. Former AUSA, 8 years private practice. Harvard Law.",
    tendencies:
      "Runs a tight courtroom. Skeptical of excessive objections. Rewards preparation.",
    caseKnowledge: "Civil rights § 1983 specialist.",
    demeanor: "Formal but fair. Will cut off rambling counsel.",
  },
  {
    type: "judge",
    name: "Hon. Marcus Williams",
    background:
      "State appellate judge, 20 years experience. Former public defender. Howard Law.",
    tendencies:
      "Pro-defendant lean in criminal matters. Deeply skeptical of qualified immunity. Values constitutional principles.",
    caseKnowledge: "Known for thorough written opinions on Fourth Amendment issues.",
    demeanor: "Patient, thoughtful, asks probing questions.",
  },
  {
    type: "judge",
    name: "Hon. Patricia Chen",
    background:
      "Federal magistrate judge, 5 years on bench. Former big-firm litigator. Yale Law.",
    tendencies:
      "Manages discovery aggressively. Hates discovery disputes. Will sanction bad-faith conduct.",
    caseKnowledge: "Complex civil litigation, class actions, discovery matters.",
    demeanor: "No-nonsense. Very detail-oriented.",
  },
];

export const DEFAULT_WITNESS_PROFILES: CharacterProfile[] = [
  {
    type: "witness",
    name: "Officer David Torres",
    background:
      "15-year veteran patrol officer. Multiple use-of-force incidents on record. Internal affairs complaints resolved in his favor.",
    tendencies:
      "Defensive when challenged. Uses police jargon. Claims perfect recall of procedure.",
    caseKnowledge: "Key defendant. Witnessed and participated in the incident.",
    demeanor: "Confident bordering on arrogant. Gets hostile under sustained cross.",
    vulnerabilities:
      "Inconsistent statements in prior reports. History of complaints from same community.",
  },
  {
    type: "witness",
    name: "Maria Rodriguez",
    background:
      "Eyewitness neighbor. Retired schoolteacher. No connection to plaintiff or defendants.",
    tendencies:
      "Wants to tell the whole story. Emotional about injustice. Very credible demeanor.",
    caseKnowledge: "Witnessed the incident from her front porch. Called 911.",
    demeanor: "Credible, empathetic, forthcoming.",
    vulnerabilities:
      "Poor lighting at time of incident. Defense will challenge distance and line of sight.",
  },
  {
    type: "witness",
    name: "Dr. James Caldwell",
    background:
      "Emergency physician. Treated plaintiff immediately after incident. Board certified.",
    tendencies:
      "Clinical, precise, uncomfortable with non-medical questions. Defers to medical records.",
    caseKnowledge: "Treated plaintiff's injuries. Documented findings consistent with excessive force.",
    demeanor: "Professional, methodical.",
    vulnerabilities:
      "Defense will argue injuries could have alternative causes.",
  },
];
