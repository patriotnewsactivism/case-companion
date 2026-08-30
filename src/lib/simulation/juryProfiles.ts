export interface JurorProfile {
  id: string;
  name: string;
  age: number;
  occupation: string;
  education: string;
  politicalLeaning: 'conservative' | 'moderate' | 'liberal' | 'independent';
  socioeconomicStatus: 'working-class' | 'middle-class' | 'upper-middle' | 'affluent';
  priorJuryExperience: boolean;
  personalityTraits: string[];
  coreBiases: string[];
  persuadabilityScore: number; // 0 (rigid) to 100 (highly impressionable)
  skepticismTowardsAuthority: number; // 0 (trusts authority/police/corporate) to 100 (distrusts)
  sympathyWeight: number; // 0 (rule-strictly-by-letter) to 100 (emotional/equitable)
  preferredEvidenceType: 'hard_physical' | 'expert_testimony' | 'eyewitness' | 'circumstantial' | 'documentary';
  deliberationRole: 'foreperson_candidate' | 'vocal_leader' | 'quiet_follower' | 'contrarian' | 'compromiser';
}

export const JURY_PROFILES_BANK: JurorProfile[] = [
  {
    id: 'juror-001',
    name: 'Marcus Vance',
    age: 48,
    occupation: 'Civil Engineer',
    education: 'B.S. Civil Engineering',
    politicalLeaning: 'moderate',
    socioeconomicStatus: 'middle-class',
    priorJuryExperience: false,
    personalityTraits: ['Analytical', 'Detail-oriented', 'Reserved', 'Methodical'],
    coreBiases: ['Prefers quantitative proof over emotion', 'Skeptical of eyewitness memory'],
    persuadabilityScore: 35,
    skepticismTowardsAuthority: 40,
    sympathyWeight: 25,
    preferredEvidenceType: 'hard_physical',
    deliberationRole: 'foreperson_candidate',
  },
  {
    id: 'juror-002',
    name: 'Elena Rostova',
    age: 34,
    occupation: 'High School Biology Teacher',
    education: 'M.Ed. Science Education',
    politicalLeaning: 'liberal',
    socioeconomicStatus: 'middle-class',
    priorJuryExperience: true,
    personalityTraits: ['Empathetic', 'Articulate', 'Patient', 'Inquisitive'],
    coreBiases: ['Concerned with social equity', 'Values institutional accountability'],
    persuadabilityScore: 60,
    skepticismTowardsAuthority: 70,
    sympathyWeight: 75,
    preferredEvidenceType: 'expert_testimony',
    deliberationRole: 'vocal_leader',
  },
  {
    id: 'juror-003',
    name: 'Robert Chen',
    age: 62,
    occupation: 'Retired Small Business Owner (Hardware)',
    education: 'Associate Degree in Business',
    politicalLeaning: 'conservative',
    socioeconomicStatus: 'upper-middle',
    priorJuryExperience: true,
    personalityTraits: ['Pragmatic', 'Direct', 'Impatient with jargon', 'Strong-willed'],
    coreBiases: ['Values personal responsibility', 'Suspicious of excuses or complex legal loopholes'],
    persuadabilityScore: 25,
    skepticismTowardsAuthority: 30,
    sympathyWeight: 20,
    preferredEvidenceType: 'documentary',
    deliberationRole: 'vocal_leader',
  },
  {
    id: 'juror-004',
    name: 'Aaliyah Washington',
    age: 27,
    occupation: 'UX Designer & Freelancer',
    education: 'B.A. Graphic Design',
    politicalLeaning: 'liberal',
    socioeconomicStatus: 'working-class',
    priorJuryExperience: false,
    personalityTraits: ['Creative', 'Observant', 'Quiet', 'Open-minded'],
    coreBiases: ['Empathetic toward underdogs', 'High digital literacy, skeptical of physical document chains'],
    persuadabilityScore: 70,
    skepticismTowardsAuthority: 80,
    sympathyWeight: 80,
    preferredEvidenceType: 'eyewitness',
    deliberationRole: 'quiet_follower',
  },
  {
    id: 'juror-005',
    name: 'Walter H. Briggs',
    age: 55,
    occupation: 'Long-haul Freight Dispatcher',
    education: 'High School Diploma',
    politicalLeaning: 'conservative',
    socioeconomicStatus: 'working-class',
    priorJuryExperience: false,
    personalityTraits: ['Skeptical', 'Stubborn', 'Common-sense focused', 'Distrusting'],
    coreBiases: ['Believes common sense trumps legal technicalities', 'Skeptical of paid expert witnesses'],
    persuadabilityScore: 20,
    skepticismTowardsAuthority: 50,
    sympathyWeight: 40,
    preferredEvidenceType: 'circumstantial',
    deliberationRole: 'contrarian',
  },
  {
    id: 'juror-006',
    name: 'Dr. Priya Nair',
    age: 41,
    occupation: 'Clinical Pharmacist',
    education: 'Pharm.D.',
    politicalLeaning: 'moderate',
    socioeconomicStatus: 'upper-middle',
    priorJuryExperience: false,
    personalityTraits: ['Precision-focused', 'Objective', 'Cautious', 'Diplomatic'],
    coreBiases: ['Demands peer-reviewed standard of proof', 'Dissects procedural irregularities'],
    persuadabilityScore: 45,
    skepticismTowardsAuthority: 45,
    sympathyWeight: 45,
    preferredEvidenceType: 'expert_testimony',
    deliberationRole: 'compromiser',
  },
  {
    id: 'juror-007',
    name: 'Samuel G. Torres',
    age: 39,
    occupation: 'Union Electrician',
    education: 'Apprenticeship Certification',
    politicalLeaning: 'independent',
    socioeconomicStatus: 'middle-class',
    priorJuryExperience: true,
    personalityTraits: ['Fair-minded', 'Tenacious', 'Plainspoken'],
    coreBiases: ['Strong solidarity with working people', 'Values clear chronological timelines'],
    persuadabilityScore: 50,
    skepticismTowardsAuthority: 60,
    sympathyWeight: 65,
    preferredEvidenceType: 'hard_physical',
    deliberationRole: 'compromiser',
  },
  {
    id: 'juror-008',
    name: 'Diane Cartwright',
    age: 58,
    occupation: 'Municipal Records Clerk',
    education: 'B.A. Public Administration',
    politicalLeaning: 'moderate',
    socioeconomicStatus: 'middle-class',
    priorJuryExperience: false,
    personalityTraits: ['By-the-book', 'Punctual', 'Risk-averse', 'Attentive'],
    coreBiases: ['Strictly adheres to judge jury instructions', 'Uncomfortable with ambiguous evidence'],
    persuadabilityScore: 40,
    skepticismTowardsAuthority: 25,
    sympathyWeight: 35,
    preferredEvidenceType: 'documentary',
    deliberationRole: 'foreperson_candidate',
  },
];

export function getRandomJuryPanel(size: number = 6): JurorProfile[] {
  const shuffled = [...JURY_PROFILES_BANK].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(size, shuffled.length));
}
