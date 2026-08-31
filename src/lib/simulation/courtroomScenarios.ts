export type SimulationMode =
  | 'cross_examination'
  | 'direct_examination'
  | 'deposition'
  | 'motion_hearing'
  | 'voir_dire'
  | 'opening_statement'
  | 'closing_argument'
  | 'expert_challenge'
  | 'sentencing_hearing';

export interface CourtroomScenario {
  id: string;
  mode: SimulationMode;
  title: string;
  summary: string;
  caseContext: string;
  jurisdiction: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetSkills: string[];
  rulesOfEvidenceFocus: string[];
  opponentProfile: {
    role: string;
    name: string;
    temperament: 'aggressive' | 'evasive' | 'cooperative' | 'technical' | 'unflappable';
    background: string;
    weaknesses: string[];
  };
  evaluationRubric: {
    criteria: string;
    weight: number;
    description: string;
  }[];
}

export const COURTROOM_SCENARIOS: CourtroomScenario[] = [
  {
    id: 'scen-cross-01',
    mode: 'cross_examination',
    title: 'Hostile Corporate Whistleblower Cross-Examination',
    summary: 'Impeach an adverse CFO witness who altered financial projections prior to acquisition.',
    caseContext: 'Securities fraud litigation where plaintiff alleges intentional omission of material liability in 10-Q filing.',
    jurisdiction: 'Federal District Court (SDNY)',
    difficulty: 'advanced',
    targetSkills: ['Prior inconsistent statement impeachment', 'Leading question control', 'Bates-stamped exhibit confrontation'],
    rulesOfEvidenceFocus: ['FRE 613 (Prior Statements)', 'FRE 801(d)(2) (Opposing Party Statements)', 'FRE 403'],
    opponentProfile: {
      role: 'Adverse Witness (Chief Financial Officer)',
      name: 'Arthur Sterling',
      temperament: 'evasive',
      background: 'Experienced executive with 25 years of corporate testimony experience.',
      weaknesses: ['Contradictory internal email from June 14', 'Personal bonus tied to deal closing'],
    },
    evaluationRubric: [
      { criteria: 'Leading Question Compliance', weight: 30, description: 'Maintained tight one-fact leading questions without open-ended traps.' },
      { criteria: 'Impeachment Execution', weight: 40, description: 'Accurately established commitment, credit, and confrontation with exhibit.' },
      { criteria: 'Objection Handling', weight: 30, description: 'Responded effectively to compound and relevance objections.' },
    ],
  },
  {
    id: 'scen-voir-dire-01',
    mode: 'voir_dire',
    title: 'Medical Malpractice Jury Selection (Voir Dire)',
    summary: 'Identify juror biases regarding standard of care, pain and suffering damages, and corporate hospital liability.',
    caseContext: 'Surgical error case resulting in permanent nerve damage against a regional healthcare system.',
    jurisdiction: 'State Superior Court (Civil)',
    difficulty: 'intermediate',
    targetSkills: ['Open-ended bias elicitation', 'Cause challenge groundwork', 'Peremptory strike prioritization'],
    rulesOfEvidenceFocus: ['Civil Procedure Rule 47', 'Strikes for Cause (Implied vs Actual Bias)'],
    opponentProfile: {
      role: 'Defense Counsel',
      name: 'Eleanor Vance, Esq.',
      temperament: 'technical',
      background: 'Senior medical malpractice defense partner with high jury trial win rate.',
      weaknesses: ['Prone to over-relying on clinical jargon'],
    },
    evaluationRubric: [
      { criteria: 'Bias Discovery', weight: 40, description: 'Uncovered latent biases regarding damage caps and tort reform.' },
      { criteria: 'Rapport & Juror Comfort', weight: 30, description: 'Fostered an open environment where venirepersons candidly spoke.' },
      { criteria: 'Cause Foundation', weight: 30, description: 'Built an unambiguous record for challenges for cause.' },
    ],
  },
  {
    id: 'scen-deposition-01',
    mode: 'deposition',
    title: 'Key Eyewitness Deposition in Trucking Collision',
    summary: 'Depose the dispatch manager regarding driver hours-of-service violations and electronic log tampering.',
    caseContext: 'Interstate commercial truck collision involving catastrophic highway injury.',
    jurisdiction: 'Federal District Court (EDTX)',
    difficulty: 'intermediate',
    targetSkills: ['Document pinning', 'Exhausting witness memory', 'Overcoming speaking objections'],
    rulesOfEvidenceFocus: ['FRCP 30(c)(2) (Objection Conduct)', 'FRE 803(6) (Business Records)'],
    opponentProfile: {
      role: 'Fleet Safety Director',
      name: 'Gary Brock',
      temperament: 'aggressive',
      background: 'Former highway patrol officer turned safety consultant.',
      weaknesses: ['Signed off on altered driver log 2 hours prior to crash'],
    },
    evaluationRubric: [
      { criteria: 'Foundation Building', weight: 35, description: 'Established systematic document custody and company safety policy breaches.' },
      { criteria: 'Defeating Evasion', weight: 35, description: 'Refocused the witness through repetitive precise questioning.' },
      { criteria: 'Record Protection', weight: 30, description: 'Maintained clear oral record free of ambiguous gestures or nods.' },
    ],
  },
  {
    id: 'scen-motion-01',
    mode: 'motion_hearing',
    title: 'Emergency Motion in Limine (Spoliation Sanctions)',
    summary: 'Argue for adverse inference jury instruction due to deleted surveillance video server logs.',
    caseContext: 'Premises liability case where defendant commercial store recycled surveillance servers after receiving preservation letter.',
    jurisdiction: 'State Circuit Court (Civil)',
    difficulty: 'advanced',
    targetSkills: ['Standard of proof articulation', 'Sanction spectrum tailoring', 'Bench question agility'],
    rulesOfEvidenceFocus: ['FRCP 37(e) / State Spoliation Rule', 'Bad Faith vs Negligent Destruction Standard'],
    opponentProfile: {
      role: 'Presiding Judge',
      name: 'Hon. Miriam Sterling',
      temperament: 'technical',
      background: 'Strict formalist judge with strong focus on statutory prerequisites for sanctions.',
      weaknesses: ['Demands concrete proof of prejudice beyond speculative loss'],
    },
    evaluationRubric: [
      { criteria: 'Legal Authority Synthesis', weight: 40, description: 'Applied relevant circuit precedent on duty to preserve and culpability.' },
      { criteria: 'Proportionality of Remedy', weight: 30, description: 'Persuaded the court on why curative instruction is necessary.' },
      { criteria: 'Responsiveness to Bench', weight: 30, description: 'Directly addressed judicial inquiries without evading tough questions.' },
    ],
  },
  {
    id: 'scen-expert-01',
    mode: 'expert_challenge',
    title: 'Daubert / Frye Expert Witness Challenge',
    summary: 'Cross-examine and disqualify opposing economic damages expert on flawed regression methodology.',
    caseContext: 'Antitrust monopolization litigation with $45M claimed lost profit damages.',
    jurisdiction: 'Federal District Court (NDCA)',
    difficulty: 'advanced',
    targetSkills: ['Daubert standard application', 'Methodology peer review attack', 'Rate of error interrogation'],
    rulesOfEvidenceFocus: ['FRE 702 (Testimony by Expert Witnesses)', 'FRE 703 (Bases of Opinion)'],
    opponentProfile: {
      role: 'Econometric Expert Witness',
      name: 'Prof. Donald Keller',
      temperament: 'unflappable',
      background: 'Emeritus Professor of Economics with over 80 expert engagements.',
      weaknesses: ['Failed to isolate macroeconomic market contractions from defendant conduct'],
    },
    evaluationRubric: [
      { criteria: 'Methodological Precision', weight: 45, description: 'Isolated variable omissions in regression model.' },
      { criteria: 'Peer Review & Standard Compliance', weight: 30, description: 'Demonstrated deviation from standard econometrics practices.' },
      { criteria: 'Control & Tone', weight: 25, description: 'Avoided arguing theory; forced concessions on calculation flaws.' },
    ],
  },
  {
    id: 'scen-opening-01',
    mode: 'opening_statement',
    title: 'Opening Statement in Trade Secret Misappropriation',
    summary: 'Deliver a persuasive non-argumentative opening framing the timeline of intellectual property theft.',
    caseContext: 'Tech startup claims departing lead engineer exfiltrated proprietary neural network weights to direct competitor.',
    jurisdiction: 'Federal District Court (D. Del.)',
    difficulty: 'intermediate',
    targetSkills: ['Storytelling architecture', 'Visual exhibit previewing', 'Avoiding premature argument objection'],
    rulesOfEvidenceFocus: ['Trial Practice Rules (Argumentative Openings)', 'FRE 1006 (Summaries)'],
    opponentProfile: {
      role: 'Opposing Lead Counsel',
      name: 'Marcus Sterling, Esq.',
      temperament: 'aggressive',
      background: 'Aggressive trial attorney quick to object to argumentative phrasing in opening.',
      weaknesses: ['Easily triggered by vivid chronological factual metaphors'],
    },
    evaluationRubric: [
      { criteria: 'Theme & Story Arc', weight: 40, description: 'Framed the core narrative around trust, timing, and quantifiable loss.' },
      { criteria: 'Argumentation Guardrails', weight: 30, description: 'Framed evidence without running afoul of argumentative objections.' },
      { criteria: 'Jury Engagement', weight: 30, description: 'Clear pacing, rhetorical clarity, and humanizing key facts.' },
    ],
  },
];

export function getScenarioById(id: string): CourtroomScenario | undefined {
  return COURTROOM_SCENARIOS.find((s) => s.id === id);
}

export function getScenariosByMode(mode: SimulationMode): CourtroomScenario[] {
  return COURTROOM_SCENARIOS.filter((s) => s.mode === mode);
}
