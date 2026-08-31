import { JurorProfile } from './juryProfiles';

export interface DeliberationArgument {
  party: 'plaintiff' | 'defendant' | 'prosecution' | 'defense';
  topic: string;
  evidenceType: 'hard_physical' | 'expert_testimony' | 'eyewitness' | 'circumstantial' | 'documentary';
  emotionalAppeal: number; // 0 to 100
  factualRigor: number; // 0 to 100
  deliveryConfidence: number; // 0 to 100
  summary: string;
}

export interface JurorDeliberationState {
  jurorId: string;
  currentLeaning: 'plaintiff' | 'defendant' | 'undecided';
  confidence: number; // 0 to 100
  influentialPoints: string[];
  dissentReason?: string;
}

export interface DeliberationRoundResult {
  roundNumber: number;
  voteCounts: {
    plaintiff: number;
    defendant: number;
    undecided: number;
  };
  jurorStates: JurorDeliberationState[];
  transcript: Array<{
    speakerName: string;
    role: string;
    statement: string;
  }>;
  consensusReached: boolean;
  verdict?: 'plaintiff' | 'defendant' | 'hung_jury';
}

export function calculateJurorArgumentImpact(
  juror: JurorProfile,
  arg: DeliberationArgument
): { score: number; rationale: string } {
  let score = 0;

  // Evidence type affinity match
  if (arg.evidenceType === juror.preferredEvidenceType) {
    score += 30;
  } else {
    score += 10;
  }

  // Factual rigor vs emotional appeal match
  const sympathyFactor = juror.sympathyWeight / 100;
  const logicFactor = (100 - juror.sympathyWeight) / 100;

  score += arg.factualRigor * logicFactor * 0.4;
  score += arg.emotionalAppeal * sympathyFactor * 0.3;
  score += arg.deliveryConfidence * 0.1;

  // Persuadability adjustment
  const persuadabilityMultiplier = (juror.persuadabilityScore + 50) / 100;
  score *= persuadabilityMultiplier;

  const rationale = `${juror.name} (${juror.deliberationRole}) evaluated '${arg.topic}': factual rigor ${arg.factualRigor}/100, evidence alignment ${(score).toFixed(1)}.`;
  return { score: Math.min(100, Math.max(0, score)), rationale };
}

export function simulateDeliberationRound(
  panel: JurorProfile[],
  previousStates: JurorDeliberationState[],
  argumentsPresented: DeliberationArgument[],
  roundNumber: number
): DeliberationRoundResult {
  const currentStates: JurorDeliberationState[] = [];
  const transcript: Array<{ speakerName: string; role: string; statement: string }> = [];

  let plaintiffVotes = 0;
  let defendantVotes = 0;
  let undecidedVotes = 0;

  panel.forEach((juror) => {
    const prevState = previousStates.find((s) => s.jurorId === juror.id) || {
      jurorId: juror.id,
      currentLeaning: 'undecided',
      confidence: 50,
      influentialPoints: [],
    };

    let plaintiffScore = 0;
    let defendantScore = 0;

    argumentsPresented.forEach((arg) => {
      const { score } = calculateJurorArgumentImpact(juror, arg);
      if (arg.party === 'plaintiff' || arg.party === 'prosecution') {
        plaintiffScore += score;
      } else {
        defendantScore += score;
      }
    });

    let leaning: 'plaintiff' | 'defendant' | 'undecided' = prevState.currentLeaning;
    let confidence = prevState.confidence;
    const influentialPoints = [...prevState.influentialPoints];

    const delta = plaintiffScore - defendantScore;
    const threshold = (100 - juror.persuadabilityScore) * 0.35;

    if (delta > threshold) {
      leaning = 'plaintiff';
      confidence = Math.min(100, confidence + 15);
      influentialPoints.push(`Strong case presented for plaintiff in round ${roundNumber}`);
    } else if (delta < -threshold) {
      leaning = 'defendant';
      confidence = Math.min(100, confidence + 15);
      influentialPoints.push(`Strong defense arguments resonated in round ${roundNumber}`);
    } else if (roundNumber > 2 && Math.abs(delta) < 10) {
      // May compromise
      if (juror.deliberationRole === 'compromiser') {
        leaning = plaintiffScore > defendantScore ? 'plaintiff' : 'defendant';
        confidence = 55;
      }
    }

    if (leaning === 'plaintiff') plaintiffVotes++;
    else if (leaning === 'defendant') defendantVotes++;
    else undecidedVotes++;

    currentStates.push({
      jurorId: juror.id,
      currentLeaning: leaning,
      confidence,
      influentialPoints,
      dissentReason: leaning === 'undecided' ? 'Requires clearer proof or cross-examination' : undefined,
    });

    // Generate transcript line
    const statement = generateJurorStatement(juror, leaning, roundNumber);
    transcript.push({
      speakerName: juror.name,
      role: juror.deliberationRole,
      statement,
    });
  });

  const total = panel.length;
  const consensusReached = plaintiffVotes === total || defendantVotes === total;
  let verdict: 'plaintiff' | 'defendant' | 'hung_jury' | undefined = undefined;

  if (consensusReached) {
    verdict = plaintiffVotes === total ? 'plaintiff' : 'defendant';
  } else if (roundNumber >= 5) {
    verdict = 'hung_jury';
  }

  return {
    roundNumber,
    voteCounts: {
      plaintiff: plaintiffVotes,
      defendant: defendantVotes,
      undecided: undecidedVotes,
    },
    jurorStates: currentStates,
    transcript,
    consensusReached,
    verdict,
  };
}

function generateJurorStatement(juror: JurorProfile, leaning: 'plaintiff' | 'defendant' | 'undecided', round: number): string {
  switch (leaning) {
    case 'plaintiff':
      return `"Looking closely at the timeline and evidence presented in round ${round}, the burden of proof has been convincingly satisfied on the key claims."`;
    case 'defendant':
      return `"I still have substantial doubts regarding causation and credibility. The defense counter-arguments hold more structural weight."`;
    case 'undecided':
    default:
      return `"I'm not fully convinced either way yet. I need us to examine the specific exhibits and witness statements once more."`;
  }
}
