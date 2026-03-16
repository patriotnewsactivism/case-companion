# CASEBUDDY ELITE UPGRADE — AGENT MISSION BRIEF
**Repo:** github.com/patriotnewsactivism/case-companion  
**Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + OpenAI GPT-4o  
**Mission:** Transform CaseBuddy from a decent legal tool into the most powerful AI-driven 
trial prep platform available to attorneys and pro se litigants. Four critical modules 
must be rebuilt or created from scratch.

---

## PRE-MISSION ARCHITECTURE AUDIT

Before writing a single line of code, read the following existing files:
- `src/` directory tree (understand all current components)
- `supabase/` migrations (understand current DB schema)
- `CLAUDE.md` (project rules and conventions)
- `package.json` (current dependencies)

Map what exists for: Timeline, Motion handling, Document generation, Trial Simulator.
Identify gaps. Then execute the four missions below in order.

---

## MISSION 1 — INTELLIGENT CASE-SPECIFIC TIMELINE ENGINE

### Problem
The current timeline generates generic events. It has no understanding of case type, 
legal posture, deadlines, or document-specific facts. It doesn't link timeline items 
back to source documents or flag missing events.

### What to Build

#### 1A — Case Context Schema
Add a `case_context` table to Supabase with these fields:
```sql
CREATE TABLE case_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  case_type TEXT NOT NULL, -- 'civil_rights_1983', 'dwi_criminal', 'federal_civil', 
                           -- 'state_criminal', 'civil_personal_injury', 'family', 'other'
  jurisdiction TEXT,       -- 'federal_5th_circuit', 'state_texas', etc.
  court_name TEXT,
  judge_name TEXT,
  opposing_counsel TEXT,
  filing_date DATE,
  key_facts JSONB,         -- AI-extracted facts array
  legal_theories TEXT[],   -- ['first_amendment_retaliation', 'fabricated_evidence', etc.]
  defendants JSONB,
  plaintiffs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1B — Intelligent Timeline Events Table
Rebuild or alter `timeline_events` to include:
```sql
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS event_category TEXT; 
-- Categories: 'incident', 'arrest', 'filing', 'hearing', 'discovery', 
--             'deadline', 'constitutional_violation', 'evidence', 
--             'witness', 'judicial_order', 'retaliation', 'media'
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS source_document_name TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS source_page_reference TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS ai_confidence FLOAT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS legal_significance TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS deadline_triggered_by TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
```

#### 1C — AI Timeline Generation Service
Create `src/services/timelineIntelligence.ts`:

```typescript
// This service takes case context + all uploaded documents and produces
// legally intelligent timeline events

interface TimelineGenerationRequest {
  caseId: string;
  caseType: string;
  jurisdiction: string;
  documents: Array<{ id: string; name: string; content: string; uploadDate: string }>;
  existingFacts: string;
  legalTheories: string[];
}

// Prompt structure for GPT-4o:
const TIMELINE_SYSTEM_PROMPT = `
You are a senior litigation attorney and legal analyst. Your job is to extract and 
generate a legally intelligent case timeline from documents provided.

For each timeline event you identify or infer, you must:
1. Assign it to one of these categories: incident, arrest, filing, hearing, discovery, 
   deadline, constitutional_violation, evidence, witness, judicial_order, retaliation, media
2. Provide exact or estimated date with confidence level (0.0-1.0)
3. Cite the source document and page/section
4. Explain legal significance in 1-2 sentences
5. Flag any GAPS — missing events that SHOULD be in the timeline for this case type
6. Identify any DEADLINES triggered by events (statute of limitations, appeal windows, etc.)
7. Flag any INCONSISTENCIES between documents

For a civil rights § 1983 case, always check for:
- Date of constitutional violation
- Date plaintiff learned of violation  
- Statute of limitations window (typically 2 years, varies by state)
- Date of first filing / complaint
- Service deadlines
- Discovery deadlines per scheduling order
- Any prior exhaustion requirements (PLRA if prison, administrative)
- Dates of any retaliation events following the original incident

Return a JSON array of timeline events in this exact format:
{
  "events": [
    {
      "date": "2023-07-15",
      "date_confidence": 0.95,
      "title": "DWI Arrest — Galveston Police Department",
      "description": "Plaintiff arrested by Officer Busby for DWI. Toxicology later showed 0.00 BAC.",
      "category": "arrest",
      "source_document_name": "arrest_report_072023.pdf",
      "source_page_reference": "pp. 1-3",
      "legal_significance": "Establishes the predicate constitutional violation; zero BAC evidence supports fabrication claim under § 1983.",
      "is_gap": false,
      "deadline_triggered": "SOL runs July 15, 2025 (2-year Texas § 1983 limit)"
    }
  ],
  "gaps": [
    {
      "missing_event": "Internal Affairs Complaint",
      "why_important": "Required to establish administrative exhaustion and pattern evidence",
      "recommended_action": "Verify whether an IA complaint was filed; if not, consider whether it strengthens or weakens the retaliation narrative"
    }
  ]
}
`;

export async function generateIntelligentTimeline(
  request: TimelineGenerationRequest
): Promise<{ events: TimelineEvent[]; gaps: TimelineGap[] }> {
  // Call GPT-4o with document content + case context
  // Parse and validate response
  // Upsert into Supabase timeline_events table
  // Return enriched timeline
}
```

#### 1D — Timeline UI Component Rebuild
Create `src/components/timeline/IntelligentTimeline.tsx`:
- Vertical timeline with category color-coding (constitutional violations = red, filings = blue, hearings = purple, evidence = amber, deadlines = orange with pulse animation)
- Each event card shows: date, title, category badge, legal significance, source document link
- Click any event → drawer opens with full AI analysis + link to source document page
- GAPS section at bottom — shows missing events as red dashed cards with "Why this matters" explanation
- DEADLINE TRACKER sidebar — upcoming deadlines with countdown
- Filter by category, date range, confidence level
- Manual add/edit events
- "Re-analyze" button to re-run AI on all documents

---

## MISSION 2 — MOTION INTELLIGENCE ENGINE

### Problem
CaseBuddy has no motion suggestion or generation capability. Attorneys and pro se 
litigants need the app to actively identify what motions should be filed based on 
case posture, and then generate those motions fully.

### What to Build

#### 2A — Motion Library Database
```sql
CREATE TABLE motion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_type TEXT NOT NULL,
  motion_category TEXT NOT NULL, -- 'dispositive', 'discovery', 'evidentiary', 
                                  -- 'emergency', 'procedural', 'appellate'
  case_types_applicable TEXT[],  -- which case types this motion applies to
  description TEXT,
  trigger_conditions TEXT[],     -- conditions that suggest this motion is appropriate
  section_structure JSONB,       -- the structural outline of the motion
  sample_arguments JSONB,        -- key argument blocks with placeholders
  relevant_rules TEXT[],         -- FRCP rules, local rules, etc.
  bluebook_citations JSONB,      -- key cases to cite
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Seed this table with at minimum these motion types:
- Motion to Dismiss (12(b)(1), 12(b)(2), 12(b)(6))
- Motion for Summary Judgment
- Motion to Strike (affidavit, pleading, evidence)
- Motion in Limine (multiple types)
- Motion for Preliminary Injunction / TRO
- Motion to Compel Discovery
- Motion for Sanctions (Rule 11, 28 USC § 1927, inherent authority)
- Motion to Reconsider / Alter Judgment
- Motion for Leave to Amend
- Emergency Motion (generic)
- Opposition to Motion to Dismiss
- Response to Summary Judgment
- Motion to Suppress (criminal)
- Motion for Acquittal (Rule 29)
- Motion for Mistrial
- Habeas Corpus (§ 2255, § 2254)
- Motion for Extension of Time
- Motion for CM/ECF Access
- Motion to Strike Fraudulent Affidavit
- First Amendment / Anti-SLAPP Motion
- Bivens Action complaint supplement
- § 1983 Civil Rights complaint supplement

#### 2B — Motion Gap Scanner Service
Create `src/services/motionIntelligence.ts`:

```typescript
const MOTION_SCANNER_PROMPT = `
You are a senior trial attorney performing a case posture analysis.
You have been given:
1. Case type and jurisdiction
2. Current timeline events
3. Filed documents list
4. Case facts summary
5. Available motion templates

Your job is to identify every motion opportunity that exists RIGHT NOW in this case.
For each motion you identify:
- Explain WHY this motion is appropriate based on the specific facts
- Rate urgency: URGENT (file within 7 days), HIGH (30 days), MEDIUM (60 days), LOW (discretionary)
- Identify the strongest argument section
- Cite the specific rule or statute that authorizes the motion
- Note any deadlines that will kill this motion if not filed in time

Output JSON:
{
  "motion_suggestions": [
    {
      "motion_type": "Motion to Strike Fraudulent Affidavit",
      "urgency": "URGENT",
      "why_applicable": "Defendant Busby filed an affidavit on [date] claiming [X]. 
                         Timeline document [Y] directly contradicts this at page [Z]. 
                         Fraud on the court is established when...",
      "key_argument": "The affidavit contains material misrepresentations that constitute 
                       fraud on the court under 5th Circuit precedent...",
      "authorizing_rule": "FRCP 12(f); Court's inherent authority",
      "deadline_warning": "Must file before court rules on pending motion to dismiss",
      "estimated_strength": 0.87,
      "generate_ready": true
    }
  ]
}
`;

export async function scanForMotionOpportunities(caseId: string): Promise<MotionSuggestion[]>;
export async function generateMotionDraft(
  caseId: string, 
  motionType: string,
  customInstructions?: string
): Promise<GeneratedMotion>;
```

#### 2C — Motion Suggestion Dashboard UI
Create `src/components/motions/MotionDashboard.tsx`:
- Card grid of suggested motions, sorted by urgency
- Each card: motion name, urgency badge (red/orange/yellow/green), strength meter, 1-sentence rationale
- URGENT cards pulse with red border animation
- Click card → expand to full analysis + "Generate This Motion" button
- Manual motion trigger: "Generate a [dropdown: motion type] for my case" button
- Filters: by urgency, by category, by case phase

---

## MISSION 3 — ON-DEMAND MOTION AND BRIEF GENERATOR

### Problem
No motion/brief generation exists. Attorneys need to generate complete, properly 
formatted, court-ready motions and briefs with their case facts injected automatically.

### What to Build

#### 3A — Generation Pipeline
Create `src/services/documentGenerator.ts`:

The generation pipeline must work in these stages:
1. **Case fact injection** — pull key facts from case_context, timeline, uploaded docs
2. **Structure generation** — AI generates the full argument outline for the specific motion type
3. **Section expansion** — each section expanded with full legal prose, citations, and fact-specific argument
4. **Citation verification** — flag any citations that need human verification
5. **DOCX assembly** — use docx.js to assemble proper court document with:
   - Caption block (court name, case number, parties, judge)
   - Title block
   - Table of contents (for longer briefs)
   - Numbered paragraph format or prose format (user selects)
   - Certificate of service
   - Signature block
   - Exhibit index if exhibits referenced

```typescript
const MOTION_GENERATION_SYSTEM_PROMPT = `
You are a senior federal litigation attorney drafting a court motion.

CRITICAL REQUIREMENTS:
- Every factual assertion must cite to a document in the case record by name and page
- Every legal proposition must include a Bluebook citation
- Use formal legal writing style — no colloquial language
- Paragraph numbering for motion body (1, 2, 3...) if procedural motion
- Argumentative prose for legal brief sections
- Follow federal court formatting conventions unless jurisdiction specifies otherwise
- Write in activist-scholar voice — firm, precise, righteous, legally unimpeachable

CASE CONTEXT PROVIDED:
{caseContext}

AVAILABLE DOCUMENTS AND KEY FACTS:
{documentFacts}

MOTION TYPE: {motionType}

ADDITIONAL INSTRUCTIONS: {customInstructions}

Generate the COMPLETE motion text with all sections fully written out.
Do NOT use placeholders like [PARTY NAME] — use the actual party names from the case context.
Do NOT abbreviate argument sections — write them fully.

Structure your output as JSON:
{
  "caption": { 
    "court": "...", "case_number": "...", "plaintiff": "...", 
    "defendant": "...", "judge": "...", "document_title": "..." 
  },
  "sections": [
    { 
      "title": "INTRODUCTION", 
      "content": "full text...",
      "type": "intro"
    },
    {
      "title": "STATEMENT OF FACTS",
      "content": "full text with record citations...",
      "type": "facts"
    },
    {
      "title": "ARGUMENT",
      "subsections": [
        {
          "heading": "I. THE COURT HAS PERSONAL JURISDICTION OVER DEFENDANT BUSBY",
          "content": "full argument text with Bluebook citations..."
        }
      ],
      "type": "argument"
    },
    {
      "title": "CONCLUSION",
      "content": "...",
      "type": "conclusion"
    },
    {
      "title": "CERTIFICATE OF SERVICE",
      "content": "...",
      "type": "certificate"
    }
  ],
  "verification_flags": [
    "Verify: 5th Circuit citation at Argument § I — confirm case is still good law",
    "Verify: Defendant's last known address for service"
  ]
}
`;
```

#### 3B — DOCX Export Engine
Use the `docx` npm package. Create `src/services/docxExporter.ts`:

The DOCX output must include:
- Proper Times New Roman 12pt, 1-inch margins (federal standard)
- Case caption with horizontal rule styling
- Bold centered title
- Numbered paragraphs for pleadings
- Indented argument headings (I., A., 1.)
- Footnotes for citations in brief format
- Exhibit references in brackets [Ex. A at 3]
- Page numbers (footer, centered)
- Double-spacing for body text
- Proper signature block
- Download as `.docx` with filename auto-generated from case number + motion type + date

#### 3C — Motion Generator UI
Create `src/components/motions/MotionGenerator.tsx`:
- Step 1: Select motion type (or type custom)
- Step 2: Review auto-populated case facts panel — edit/add facts before generation
- Step 3: Add custom instructions (e.g. "Emphasize First Amendment retaliation angle, cite to Lozman v. City of Riviera Beach")
- Step 4: Generate — streaming output with section-by-section reveal
- Step 5: Review with inline editing — click any paragraph to edit
- Step 6: Verification flags highlighted in yellow — user must check and approve each
- Step 7: Export to DOCX
- Version history — all generated motions saved with timestamp, downloadable
- "Regenerate section" button for any individual section

---

## MISSION 4 — ADVANCED AI TRIAL PREP SIMULATOR WITH FULL VOICE

### Problem
The current simulator has simulation modes but no intelligence, no real voice integration,
no AI characters that respond in-character, and no coaching system.

### What to Build

#### 4A — Simulator Architecture
Create `src/components/simulator/TrialSimulator.tsx` as the master component with these sub-components:
- `SimulatorSetup.tsx` — configure the simulation session
- `SimulatorStage.tsx` — the live courtroom interface  
- `VoiceEngine.tsx` — handles all STT and TTS
- `CaptionDisplay.tsx` — real-time captioning
- `AICharacter.tsx` — renders AI character responses
- `ScorePanel.tsx` — live and post-session scoring
- `CoachingPanel.tsx` — AI coaching after each exchange

#### 4B — Voice Engine (Web Speech API)
Create `src/services/voiceEngine.ts`:

```typescript
export class VoiceEngine {
  private recognition: SpeechRecognition;
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  // Speech-to-Text
  startListening(onInterim: (text: string) => void, onFinal: (text: string) => void): void;
  stopListening(): void;
  pauseListening(): void;
  
  // Text-to-Speech with character voices
  speak(text: string, character: CharacterVoice, onEnd?: () => void): void;
  stopSpeaking(): void;
  
  // Voice selection per character
  selectVoiceForCharacter(character: 'judge' | 'witness' | 'opposing_counsel' | 'clerk'): SpeechSynthesisVoice;
}

// Character voice profiles
export const CHARACTER_VOICES: Record<string, VoiceProfile> = {
  judge: { 
    pitch: 0.85,    // Deeper, authoritative
    rate: 0.9,      // Measured pace
    preferredVoice: 'Google US English Male' 
  },
  witness: {
    pitch: 1.0,
    rate: 1.0,
    preferredVoice: 'Google US English'  // varies by witness profile
  },
  opposing_counsel: {
    pitch: 1.05,
    rate: 1.1,      // Slightly faster, aggressive
    preferredVoice: 'Google US English Male'
  },
  clerk: {
    pitch: 1.0,
    rate: 0.95,
    preferredVoice: 'Google US English Female'
  }
};
```

#### 4C — AI Character Engine
Create `src/services/characterEngine.ts`:

Each AI character has a detailed system prompt that makes them respond in-character.
The character engine receives:
- Character type (judge, witness, opposing counsel, juror)
- Character profile (name, background, tendencies, case knowledge)
- Current simulation mode (opening, direct exam, cross, closing, etc.)
- Full conversation history for this session
- Case facts (so AI characters know the actual facts of the case)

```typescript
const JUDGE_SYSTEM_PROMPT = `
You are Judge {judgeName} presiding over {caseName} in {courtName}.
You are a federal judge with {yearsOnBench} years on the bench.
Your judicial philosophy: {judicialPhilosophy}.
Known tendencies: {judgeNotes}

The case before you: {caseSummary}

You respond ONLY as a judge would in open court. You:
- Maintain strict courtroom decorum
- Rule on objections immediately with brief explanations
- Ask pointed clarifying questions when confused
- Interrupt rambling arguments with "Counsel, get to your point"
- Show impatience with procedural mistakes
- Occasionally test attorneys with hard questions from the bench
- Reference specific FRCP rules when ruling

NEVER break character. NEVER provide coaching. NEVER explain why you ruled a certain way 
unless the attorney asks for clarification on the record.

Current phase: {simulationPhase}
Last attorney statement: {lastStatement}

Respond as Judge {judgeName} would respond in open court.
Keep responses realistic — judges don't give speeches, they give rulings.
`;

const WITNESS_SYSTEM_PROMPT = `
You are {witnessName}, a witness in {caseName}.
Your relationship to the case: {witnessRole}
Your background: {witnessBackground}
What you know: {witnessKnowledge}
Your demeanor: {witnessDemeanor} -- options: cooperative, hostile, evasive, nervous, 
                                              confident, confused, lying, truthful
Vulnerabilities in your testimony: {witnessVulnerabilities}

You are being {examinationType}: direct examination, cross-examination, or re-direct.

CRITICAL RULES:
- Answer ONLY the question asked. Do not volunteer information.
- If hostile or evasive: give technically truthful but unhelpful answers
- If lying: be internally consistent but vulnerable to specific follow-up questions
- If nervous: sometimes hedge, add "I think" or "I'm not sure"
- NEVER break character
- React authentically to pressure — good cross-examination makes you visibly uncomfortable
- Bad or leading questions: object in your mind but only a lawyer can object for you
`;

export async function getCharacterResponse(
  character: SimulatorCharacter,
  attorneyStatement: string,
  sessionHistory: Message[],
  simulationMode: SimulationMode,
  caseContext: CaseContext
): Promise<CharacterResponse>;
```

#### 4D — Simulation Modes (All 10 Must Be Intelligent)
Each mode has its own AI context and scoring criteria:

1. **Opening Statement** — AI judge evaluates structure, persuasiveness, roadmap clarity
2. **Direct Examination** — AI witness responds to questions; score on: question clarity, narrative building, leading question avoidance
3. **Cross-Examination** — AI hostile witness responds; score on: control, impeachment, commitment to answers, not arguing with witness
4. **Closing Argument** — AI judge + simulated jury reaction; score on: summarizing evidence, emotional resonance, call to action
5. **Voir Dire** — AI simulated juror panel responds; score on: bias identification, rehabilitating favorable jurors
6. **Objections Practice** — AI opposing counsel fires rapid statements; user must object or not and state grounds; AI judge rules
7. **Bench Trial Argument** — Direct argument to AI judge; scored on legal precision, citation accuracy, responding to questions
8. **Deposition Practice** — AI witness in deposition mode; score on pinning testimony, locking in admissions
9. **Motion Hearing** — Oral argument on a specific motion; AI judge asks probing questions
10. **Full Trial Simulation** — Multi-phase; AI rotates through judge/witness/opposing counsel roles in sequence

#### 4E — Scoring and Coaching System
Create `src/services/trialCoach.ts`:

```typescript
const COACH_PROMPT = `
You are a senior trial advocacy coach reviewing this exchange from a trial simulation.

Attorney's statement/question: {attorneyInput}
Character's response: {characterResponse}
Simulation mode: {mode}
Session context: {sessionContext}

Provide immediate coaching on:
1. TECHNIQUE: What did they do right/wrong tactically?
2. LEGAL: Any procedural or evidentiary issues?
3. STRATEGIC: How did this advance or hurt their case theory?
4. BETTER APPROACH: Give the exact better question/statement they should have used
5. SCORE: 1-10 on this specific exchange with brief justification

Keep coaching concise — this appears BETWEEN exchanges. Max 4 sentences.
Be direct. Be specific. Reference exactly what they said.
`;

// Scoring dimensions tracked across full session:
interface SessionScore {
  overall: number;
  dimensions: {
    questioning_technique: number;   // 0-100
    legal_accuracy: number;          // 0-100
    strategic_thinking: number;      // 0-100
    objection_use: number;           // 0-100
    narrative_control: number;       // 0-100
    time_management: number;         // 0-100
    courtroom_decorum: number;       // 0-100
  };
  exchanges_scored: number;
  highlights: string[];   // best moments
  weaknesses: string[];   // areas to improve
  recommended_drills: string[];
}
```

#### 4F — Live Caption Display
Create `src/components/simulator/CaptionDisplay.tsx`:
- Fixed bottom bar of the simulator (like real courtroom captioning)
- Shows last 3 lines of spoken dialogue with speaker labels
- Color-coded by speaker (user = blue, judge = dark gray, witness = green, opposing = red)
- Interim transcription appears in lighter color, finalizes in full color
- Scrollable transcript panel on the right side
- "Save Transcript" button — exports full session transcript as .txt or .pdf

#### 4G — Simulator UI Design
The simulator interface must feel like an actual courtroom tech setup:
- Left panel: AI character display (text-based "avatar" with character name, role, current emotional state)
- Center: Active exchange area — shows conversation thread in courtroom format
- Right panel: Score/coaching — live score gauge, last coaching note, session stats
- Bottom bar: Caption display (always visible)
- Top bar: Simulation mode indicator, timer, phase tracker (Opening → Direct → Cross → Closing)
- Large MIC button in center bottom — press and hold to speak (or toggle mode)
- Waveform animation while user is speaking
- Status indicators: "AI Thinking..." / "AI Speaking..." / "Your Turn" / "Paused"
- Voice controls: mute AI voice (read only), adjust AI speech rate

#### 4H — Database Schema for Simulator Sessions
```sql
CREATE TABLE trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  session_name TEXT,
  simulation_mode TEXT NOT NULL,
  simulation_phase TEXT,
  characters_config JSONB,
  session_transcript JSONB,  -- full conversation history
  session_score JSONB,       -- final scores object
  coaching_notes TEXT[],
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES trial_sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,  -- 'user', 'judge', 'witness', 'opposing_counsel'
  content TEXT NOT NULL,
  timestamp_ms INTEGER,
  is_interim BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## CROSS-CUTTING REQUIREMENTS

### Performance
- All AI calls must be streaming (use OpenAI streaming API) — no waiting for full response
- Timeline generation: run in background, show progress bar
- Motion generation: stream section by section — user sees text appearing live
- Simulator: AI response latency target < 2 seconds (use GPT-4o-mini for character responses, GPT-4o for motion generation)

### Error Handling
- Voice recognition unavailable: graceful fallback to text input with prominent notice
- AI call fails: retry with exponential backoff (max 3 attempts), then show error with manual retry
- Document too large: chunking strategy — process in segments, merge timeline results
- DOCX generation fails: offer plain text download as fallback

### Environment Variables Required (add to .env.example)
```
VITE_OPENAI_API_KEY=           # GPT-4o access
VITE_OPENAI_MODEL_HEAVY=claude-sonnet-4-20250514   # or gpt-4o for complex generation
VITE_OPENAI_MODEL_FAST=gpt-4o-mini                 # for simulator character responses
VITE_WHISPER_ENABLED=true                           # if using Whisper for high-accuracy STT
```

### Navigation Updates
Add to sidebar nav:
- Timeline (rebuilt) → `/case/:id/timeline`
- Motion Intelligence → `/case/:id/motions`  
- Generate Motion → `/case/:id/motions/generate`
- Trial Simulator → `/case/:id/simulator`
- Simulator History → `/case/:id/simulator/history`

---

## EXECUTION ORDER

Execute missions in this exact order to avoid dependency issues:

1. **DB migrations first** — Run all Supabase migration files for new tables
2. **Services layer** — Build all `src/services/` files (no UI yet)
3. **Mission 1 UI** — Rebuild Timeline component using new service
4. **Mission 2 UI** — Build Motion Dashboard using motion scanner service
5. **Mission 3 UI** — Build Motion Generator with DOCX export
6. **Mission 4 Voice Engine** — Build and test VoiceEngine in isolation
7. **Mission 4 Character Engine** — Build and test each character prompt
8. **Mission 4 Full Simulator UI** — Assemble all simulator components
9. **Integration testing** — Full case flow: add case → upload doc → generate timeline → scan motions → generate motion → export DOCX → run simulator
10. **Navigation and routing** — Wire all new pages into router

---

## DEFINITION OF DONE

The upgrade is complete when:
- [ ] Uploading a document to a case automatically triggers timeline extraction with document citations
- [ ] Timeline shows category-colored events with gap analysis and deadline forecasting
- [ ] Motion dashboard surfaces at least 3 relevant motion suggestions for any civil rights case
- [ ] Clicking "Generate" on a motion suggestion produces a full, properly formatted motion with zero placeholders
- [ ] Generated motion exports as properly formatted .docx with caption, numbered sections, citations
- [ ] Trial Simulator loads with voice permission, AI judge responds in character via TTS within 2 seconds
- [ ] Captions appear in real-time during both user speech and AI TTS output
- [ ] Post-session score report shows dimensional breakdown and specific coaching notes
- [ ] All new features work on mobile (voice simulation may require desktop notice)

---

## NOTES FOR THE AGENT

- This is a pro se federal litigant platform. Legal accuracy matters enormously.
- The primary user (Don Matthews, Reardon v. Osteen, S.D. Tex.) litigates § 1983 civil rights cases.
- Default jurisdiction assumptions: federal court, 5th Circuit, Texas state law for limitations periods.
- Motion templates must be accurate to FRCP and 5th Circuit local rules.
- The activist-scholar voice is intentional — firm, righteous, legally precise. Maintain it in generated documents.
- Never generate placeholder text in exported documents. If a fact is unknown, flag it with [VERIFY: description].
- Treat every generated motion as if it will actually be filed in federal court the next morning.
