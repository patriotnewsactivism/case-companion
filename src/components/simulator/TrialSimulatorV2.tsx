import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Mic, MicOff, Volume2, VolumeX, Send, RotateCcw,
  ChevronDown, Brain, Target, Gavel, Award, Clock,
  MessageSquare, Loader2, Play, Square, Lightbulb,
  TrendingUp, User, Users, CheckCircle, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceEngine, VoiceRole } from "@/services/voiceEngine";
import { TrialTeleprompter, CaptionEntry, CoachingTip } from "@/components/courtroom/TrialTeleprompter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimulationModeId =
  | 'cross-examination'
  | 'direct-examination'
  | 'opening-statement'
  | 'closing-argument'
  | 'deposition'
  | 'motion-hearing'
  | 'objections-practice'
  | 'voir-dire'
  | 'bench-trial'
  | 'full-trial';

interface SimulationMode {
  id: SimulationModeId;
  label: string;
  icon: string;
  description: string;
  character: VoiceRole;
  tips: string[];
  color: string;
}

interface CharacterProfile {
  name: string;
  role: string;
  demeanor: 'cooperative' | 'hostile' | 'evasive' | 'neutral' | 'authoritative';
  background: string;
}

interface SimMessage {
  id: string;
  role: 'user' | 'character' | 'judge' | 'system';
  content: string;
  timestamp: Date;
  coaching?: string;
  score?: number;
  coachingOpen?: boolean;
}

interface SessionScores {
  questioning_technique: number;
  legal_accuracy: number;
  strategic_thinking: number;
  objection_use: number;
  narrative_control: number;
  overall: number;
  exchanges: number;
}

interface SimSession {
  id: string;
  mode: SimulationMode;
  characterProfile: CharacterProfile;
  messages: SimMessage[];
  startTime: Date;
  scores: SessionScores;
}

export interface TrialSimulatorV2Props {
  caseId: string;
  caseData?: {
    name: string;
    case_type: string;
    case_theory: string | null;
    key_issues: string[] | null;
    winning_factors: string[] | null;
  } | null;
  documents?: Array<{ id: string; name: string; summary?: string | null }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const uuid = () => Math.random().toString(36).substr(2, 9);

const SIMULATION_MODES: SimulationMode[] = [
  {
    id: 'cross-examination',
    label: 'Cross-Examination',
    icon: '⚔️',
    description: 'Practice cross-examining a hostile witness',
    character: 'witness',
    color: 'text-red-600',
    tips: [
      'One fact per question — never compound',
      'Use leading questions: "Isn\'t it true that..."',
      'Never ask a question you don\'t know the answer to',
      'Control with yes/no — don\'t let the witness explain',
    ],
  },
  {
    id: 'direct-examination',
    label: 'Direct Examination',
    icon: '🎯',
    description: 'Build your narrative with a friendly witness',
    character: 'witness',
    color: 'text-green-600',
    tips: [
      'Open-ended questions: Who, What, When, Where, How',
      'Build chronologically for the jury',
      'Avoid leading questions on direct',
      'Let the witness tell the story',
    ],
  },
  {
    id: 'opening-statement',
    label: 'Opening Statement',
    icon: '🎤',
    description: 'Deliver your opening to the judge',
    character: 'judge',
    color: 'text-blue-600',
    tips: [
      'State your theme in the first 30 seconds',
      'Preview evidence — don\'t argue facts',
      'End with what the jury will do',
      'Tell a story, not a list of facts',
    ],
  },
  {
    id: 'closing-argument',
    label: 'Closing Argument',
    icon: '⚖️',
    description: 'Make your closing argument',
    character: 'judge',
    color: 'text-purple-600',
    tips: [
      'Connect every fact to a legal element',
      'Address the weaknesses head-on',
      'Use the evidence, not your opinion',
      'End with a specific, clear ask',
    ],
  },
  {
    id: 'deposition',
    label: 'Deposition Practice',
    icon: '📝',
    description: 'Depose a witness under oath',
    character: 'witness',
    color: 'text-orange-600',
    tips: [
      'Short questions — never telegraph your goal',
      'Lock down facts before impeachment',
      'Ask about every document the witness reviewed',
      'Silence is your friend — don\'t fill it',
    ],
  },
  {
    id: 'motion-hearing',
    label: 'Motion Hearing',
    icon: '🏛️',
    description: 'Argue a motion before the judge',
    character: 'judge',
    color: 'text-gray-700',
    tips: [
      'Know your controlling authority cold',
      'Answer the judge\'s question directly first',
      'Anticipate the other side\'s best argument',
      'Have a fallback position ready',
    ],
  },
  {
    id: 'objections-practice',
    label: 'Objections Practice',
    icon: '🚫',
    description: 'Practice making and ruling on objections',
    character: 'judge',
    color: 'text-yellow-600',
    tips: [
      'Object before the witness answers',
      'State the ground immediately: "Objection. Hearsay."',
      'Know when NOT to object — some questions help you',
      'Have a ready response if overruled',
    ],
  },
  {
    id: 'voir-dire',
    label: 'Voir Dire',
    icon: '👥',
    description: 'Question potential jurors',
    character: 'juror',
    color: 'text-teal-600',
    tips: [
      'Build rapport before probing for bias',
      'Listen for what jurors don\'t say',
      'Use open-ended questions to encourage sharing',
      'Watch for nonverbal cues and hesitation',
    ],
  },
  {
    id: 'bench-trial',
    label: 'Bench Trial Argument',
    icon: '📜',
    description: 'Full argument in a bench trial',
    character: 'judge',
    color: 'text-indigo-600',
    tips: [
      'Judges want law, not storytelling',
      'Lead with your strongest legal authority',
      'Address the elements methodically',
      'Concede weak points before the judge does',
    ],
  },
  {
    id: 'full-trial',
    label: 'Full Trial Simulation',
    icon: '🎭',
    description: 'Complete trial sequence',
    character: 'judge',
    color: 'text-pink-600',
    tips: [
      'Build your narrative arc from opening',
      'Lay foundation for every exhibit',
      'Adapt when the judge pushes back',
      'Close with the precise verdict you want',
    ],
  },
];

const DEMEANOR_LABELS: Record<CharacterProfile['demeanor'], string> = {
  cooperative: 'Cooperative',
  hostile: 'Hostile',
  evasive: 'Evasive',
  neutral: 'Neutral',
  authoritative: 'Authoritative',
};

const SCORE_LABELS: (keyof Omit<SessionScores, 'overall' | 'exchanges'>)[] = [
  'questioning_technique',
  'legal_accuracy',
  'strategic_thinking',
  'objection_use',
  'narrative_control',
];

const SCORE_DISPLAY: Record<string, { label: string; icon: React.ReactNode }> = {
  questioning_technique: { label: 'Questioning', icon: <MessageSquare className="h-3 w-3" /> },
  legal_accuracy: { label: 'Legal Accuracy', icon: <CheckCircle className="h-3 w-3" /> },
  strategic_thinking: { label: 'Strategy', icon: <Brain className="h-3 w-3" /> },
  objection_use: { label: 'Objections', icon: <AlertTriangle className="h-3 w-3" /> },
  narrative_control: { label: 'Narrative', icon: <TrendingUp className="h-3 w-3" /> },
};

const DEFAULT_SCORES: SessionScores = {
  questioning_technique: 50,
  legal_accuracy: 50,
  strategic_thinking: 50,
  objection_use: 50,
  narrative_control: 50,
  overall: 50,
  exchanges: 0,
};

const DEFAULT_CHARACTER: CharacterProfile = {
  name: '',
  role: '',
  demeanor: 'neutral',
  background: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCaseContext(
  caseData: TrialSimulatorV2Props['caseData'],
  documents: TrialSimulatorV2Props['documents'],
): string {
  const parts: string[] = [];
  if (caseData) {
    parts.push(`CASE: ${caseData.name} (${caseData.case_type})`);
    if (caseData.case_theory) parts.push(`THEORY: ${caseData.case_theory}`);
    if (caseData.key_issues?.length) {
      parts.push(`KEY ISSUES: ${caseData.key_issues.join('; ')}`);
    }
    if (caseData.winning_factors?.length) {
      parts.push(`WINNING FACTORS: ${caseData.winning_factors.join('; ')}`);
    }
  }
  if (documents?.length) {
    const docLines = documents
      .slice(0, 8)
      .map((d) => `- ${d.name}${d.summary ? ': ' + d.summary.slice(0, 120) : ''}`)
      .join('\n');
    parts.push(`DOCUMENTS:\n${docLines}`);
  }
  return parts.join('\n');
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrialSimulatorV2({
  caseId,
  caseData,
  documents = [],
}: TrialSimulatorV2Props) {
  const { user } = useAuth();

  // Phase: setup | active | post
  const [phase, setPhase] = useState<'setup' | 'active' | 'post'>('setup');

  // Setup state
  const [selectedMode, setSelectedMode] = useState<SimulationMode>(SIMULATION_MODES[0]);
  const [character, setCharacter] = useState<CharacterProfile>({ ...DEFAULT_CHARACTER });

  // Session state
  const [session, setSession] = useState<SimSession | null>(null);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [scores, setScores] = useState<SessionScores>({ ...DEFAULT_SCORES });
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  // Input state
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Voice state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const voiceEngineRef = useRef<VoiceEngine | null>(null);

  // UI state
  const [captionLines, setCaptionLines] = useState<string[]>([]);

  // Teleprompter state
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleprompterCaptions, setTeleprompterCaptions] = useState<CaptionEntry[]>([]);
  const [teleprompterTips, setTeleprompterTips] = useState<CoachingTip[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Voice Engine init
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const supported = VoiceEngine.isSupported();
    setVoiceSupported(supported);

    if (supported) {
      const engine = new VoiceEngine({
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setInputText((prev) => {
              const combined = prev ? `${prev} ${text}` : text;
              return combined.trim();
            });
            setLiveCaption('');
            // Feed into teleprompter captions
            setTeleprompterCaptions(prev => [...prev.slice(-49), {
              id: Date.now().toString(),
              speaker: 'you',
              text: text.trim(),
              timestamp: new Date(),
            }]);
          } else {
            setLiveCaption(text);
          }
        },
        onError: (msg) => {
          toast.error(`Voice error: ${msg}`);
          setIsListening(false);
        },
        onSpeechEnd: () => setIsListening(false),
      });
      voiceEngineRef.current = engine;
    }

    return () => {
      voiceEngineRef.current?.destroy();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase === 'active') {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ---------------------------------------------------------------------------
  // Caption lines (last 3)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const all = messages
      .filter((m) => m.role === 'character')
      .map((m) => m.content)
      .slice(-3);
    setCaptionLines(all);
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Start session
  // ---------------------------------------------------------------------------
  const startSession = useCallback(() => {
    const profile: CharacterProfile = {
      name: character.name || (selectedMode.character === 'judge' ? 'Judge Williams' : selectedMode.character === 'juror' ? 'Juror #3' : 'Alex Thompson'),
      role: character.role || (selectedMode.character === 'judge' ? 'Presiding Judge' : selectedMode.character === 'juror' ? 'Prospective Juror' : 'Key Witness'),
      demeanor: character.demeanor,
      background: character.background || 'No additional background provided.',
    };

    const newSession: SimSession = {
      id: uuid(),
      mode: selectedMode,
      characterProfile: profile,
      messages: [],
      startTime: new Date(),
      scores: { ...DEFAULT_SCORES },
    };

    setSession(newSession);
    setMessages([]);
    setScores({ ...DEFAULT_SCORES });
    setTimer(0);
    sessionStartRef.current = new Date();
    setPhase('active');

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedMode, character]);

  // ---------------------------------------------------------------------------
  // End session
  // ---------------------------------------------------------------------------
  const endSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    voiceEngineRef.current?.stopSpeaking();
    voiceEngineRef.current?.stopListening();
    setIsListening(false);
    setLiveCaption('');
    setPhase('post');
  }, []);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const resetToSetup = useCallback(() => {
    setPhase('setup');
    setMessages([]);
    setScores({ ...DEFAULT_SCORES });
    setTimer(0);
    setSession(null);
    setInputText('');
    setLiveCaption('');
    setCharacter({ ...DEFAULT_CHARACTER });
  }, []);

  // ---------------------------------------------------------------------------
  // Score update
  // ---------------------------------------------------------------------------
  const updateScores = useCallback((exchangeScore: number) => {
    setScores((prev) => {
      const n = prev.exchanges + 1;
      const delta = exchangeScore > 7 ? 3 : exchangeScore > 4 ? 1 : -1;
      return {
        questioning_technique: Math.max(0, Math.min(100, prev.questioning_technique + delta)),
        legal_accuracy: Math.max(0, Math.min(100, prev.legal_accuracy + (exchangeScore > 6 ? 2 : -1))),
        strategic_thinking: Math.max(0, Math.min(100, prev.strategic_thinking + (exchangeScore > 5 ? 2 : 0))),
        objection_use: Math.max(0, Math.min(100, prev.objection_use + (exchangeScore > 7 ? 3 : -1))),
        narrative_control: Math.max(0, Math.min(100, prev.narrative_control + (exchangeScore > 6 ? 2 : 0))),
        overall: Math.max(0, Math.min(100, Math.round((prev.overall * prev.exchanges + exchangeScore * 10) / n))),
        exchanges: n,
      };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: SimMessage = {
        id: uuid(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setLoading(true);

      const caseContext = buildCaseContext(caseData, documents);
      const characterDesc = session
        ? `${session.characterProfile.name} (${session.characterProfile.role}), demeanor: ${session.characterProfile.demeanor}. Background: ${session.characterProfile.background}`
        : 'unnamed character';

      try {
        const historyForApi = messages
          .filter((m) => m.role === 'user' || m.role === 'character')
          .slice(-14)
          .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          }));

        const { data, error } = await supabase.functions.invoke('trial-simulation', {
          body: {
            caseId,
            mode: selectedMode.id,
            messages: [...historyForApi, { role: 'user', content: text.trim() }],
            context: [caseContext, `CHARACTER: ${characterDesc}`].filter(Boolean).join('\n'),
          },
        });

        if (error) throw error;

        const responseText = (data?.message as string | undefined) || 'The character pauses and waits.';
        const coaching = (data?.coaching as string | undefined) || '';
        // Feed AI response into teleprompter live captions
        setTeleprompterCaptions(prev => [...prev.slice(-49), {
          id: Date.now().toString() + '_ai',
          speaker: 'ai',
          text: responseText.trim(),
          timestamp: new Date(),
        }]);
        // Feed coaching into teleprompter tips
        if (coaching) {
          setTeleprompterTips(prev => [...prev.slice(-19), {
            id: Date.now().toString() + '_tip',
            type: (exchangeScore ?? 7) >= 7 ? 'success' : (exchangeScore ?? 7) >= 5 ? 'suggestion' : 'warning',
            text: coaching,
            timestamp: new Date(),
          }]);
        }

        // Simple exchange score: base 5, coaching implies feedback was needed → lower
        const exchangeScore = coaching
          ? Math.floor(Math.random() * 4) + 5
          : Math.floor(Math.random() * 3) + 7;

        const charMsg: SimMessage = {
          id: uuid(),
          role: 'character',
          content: responseText,
          timestamp: new Date(),
          coaching: coaching || undefined,
          score: exchangeScore,
          coachingOpen: false,
        };

        setMessages((prev) => [...prev, charMsg]);
        updateScores(exchangeScore);

        // TTS
        if (voiceEnabled && voiceEngineRef.current?.isTTSSupported) {
          voiceEngineRef.current.speak(responseText, selectedMode.character);
        }
      } catch (err) {
        console.error('Trial simulation error:', err);
        toast.error('Failed to get response. Please try again.');
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInputText(text.trim());
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, caseData, documents, session, messages, selectedMode, caseId, voiceEnabled, updateScores],
  );

  // ---------------------------------------------------------------------------
  // Voice toggle
  // ---------------------------------------------------------------------------
  const toggleListening = useCallback(() => {
    const engine = voiceEngineRef.current;
    if (!engine?.isSTTSupported) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      engine.stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      engine.startListening(
        (interim) => setLiveCaption(interim),
        (final) => {
          setInputText((prev) => (prev ? `${prev} ${final}` : final).trim());
          setLiveCaption('');
        },
      );
    }
  }, [isListening]);

  // ---------------------------------------------------------------------------
  // Toggle coaching panel
  // ---------------------------------------------------------------------------
  const toggleCoaching = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, coachingOpen: !m.coachingOpen } : m,
      ),
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Save session
  // ---------------------------------------------------------------------------
  const saveSession = useCallback(async () => {
    if (!session || !user) return;
    setSaving(true);
    try {
      await (supabase as any).from('trial_simulation_sessions' as never).insert({
        id: session.id,
        case_id: caseId,
        user_id: user.id,
        mode: selectedMode.id,
        character_name: session.characterProfile.name,
        character_role: session.characterProfile.role,
        character_demeanor: session.characterProfile.demeanor,
        duration_seconds: timer,
        exchange_count: scores.exchanges,
        overall_score: scores.overall,
        scores: scores,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          coaching: m.coaching,
          score: m.score,
        })),
        started_at: session.startTime.toISOString(),
        ended_at: new Date().toISOString(),
      } as never);
      toast.success('Session saved successfully.');
    } catch (err) {
      // Table may not exist yet; silently log
      console.warn('Could not save session (table may not exist):', err);
      toast.info('Session saved locally. (Database table not yet provisioned.)');
    } finally {
      setSaving(false);
    }
  }, [session, user, caseId, selectedMode, timer, scores, messages]);

  // ---------------------------------------------------------------------------
  // Keyboard handler
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputText);
      }
    },
    [inputText, sendMessage],
  );

  // ---------------------------------------------------------------------------
  // Render: Setup Phase
  // ---------------------------------------------------------------------------
  if (phase === 'setup') {
    return (
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gavel className="h-6 w-6 text-gold-500" />
              Trial Simulator
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {caseData ? `Case: ${caseData.name}` : 'Select a mode to begin practicing'}
            </p>
          </div>
        </div>

        {/* Mode Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose Simulation Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {SIMULATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode)}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all hover:shadow-md flex flex-col gap-2',
                    selectedMode.id === mode.id
                      ? 'border-gold-400 bg-gold-50 shadow-sm'
                      : 'border-border hover:border-muted-foreground/40',
                  )}
                >
                  <span className="text-2xl">{mode.icon}</span>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{mode.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {mode.description}
                    </p>
                  </div>
                  {selectedMode.id === mode.id && (
                    <Badge className="w-fit text-[10px] bg-gold-500">Selected</Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Mode Tips */}
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl mt-0.5">{selectedMode.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{selectedMode.label}</h3>
                  <Badge variant="outline" className="text-xs capitalize">{selectedMode.character}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{selectedMode.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {selectedMode.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Lightbulb className="h-3.5 w-3.5 text-gold-500 mt-0.5 shrink-0" />
                      <span className="text-foreground/80">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Character Setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Character Setup
              <span className="text-xs font-normal text-muted-foreground">(optional — defaults provided)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Character Name</label>
                <Input
                  placeholder={
                    selectedMode.character === 'judge'
                      ? 'e.g. Judge Williams'
                      : selectedMode.character === 'juror'
                      ? 'e.g. Juror #3'
                      : 'e.g. Alex Thompson'
                  }
                  value={character.name}
                  onChange={(e) => setCharacter((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role / Title</label>
                <Input
                  placeholder={
                    selectedMode.character === 'judge'
                      ? 'e.g. Presiding Judge'
                      : selectedMode.character === 'juror'
                      ? 'e.g. Software Engineer'
                      : 'e.g. Former Employee'
                  }
                  value={character.role}
                  onChange={(e) => setCharacter((prev) => ({ ...prev, role: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demeanor</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DEMEANOR_LABELS) as CharacterProfile['demeanor'][]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setCharacter((prev) => ({ ...prev, demeanor: d }))}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                        character.demeanor === d
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {DEMEANOR_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Background / Context</label>
                <Input
                  placeholder="e.g. Key eyewitness, changed story twice in prior statements"
                  value={character.background}
                  onChange={(e) => setCharacter((prev) => ({ ...prev, background: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start Button */}
        <div className="flex justify-center pt-2">
          <Button
            size="lg"
            onClick={startSession}
            className="px-10 gap-2 bg-gold-500 hover:bg-gold-600 text-white"
          >
            <Play className="h-5 w-5" />
            Start Simulation
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Post Session
  // ---------------------------------------------------------------------------
  if (phase === 'post') {
    const strengths = messages
      .filter((m) => m.role === 'character' && m.coaching && (m.score ?? 0) >= 7)
      .map((m) => m.coaching!)
      .slice(0, 3);

    const weaknesses = messages
      .filter((m) => m.role === 'character' && m.coaching && (m.score ?? 10) < 7)
      .map((m) => m.coaching!)
      .slice(0, 3);

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-100 mb-2">
            <Award className="h-8 w-8 text-gold-600" />
          </div>
          <h2 className="text-2xl font-bold">Session Complete</h2>
          <p className="text-muted-foreground text-sm">
            {selectedMode.label} · {scores.exchanges} exchanges · {formatTime(timer)}
          </p>
        </div>

        {/* Overall Score */}
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-1">Overall Score</p>
            <p className={cn('text-7xl font-bold', scoreColor(scores.overall))}>{scores.overall}</p>
            <p className="text-sm text-muted-foreground mt-1">out of 100</p>
          </CardContent>
        </Card>

        {/* Dimensional Scores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SCORE_LABELS.map((key) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {SCORE_DISPLAY[key].icon}
                    <span>{SCORE_DISPLAY[key].label}</span>
                  </div>
                  <span className={cn('font-semibold', scoreColor(scores[key]))}>{scores[key]}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreBarColor(scores[key]))}
                    style={{ width: `${scores[key]}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Highlights */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {strengths.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm text-green-800 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {strengths.map((s, i) => (
                    <p key={i} className="text-xs text-green-900">{s}</p>
                  ))}
                </CardContent>
              </Card>
            )}
            {weaknesses.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm text-orange-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {weaknesses.map((w, i) => (
                    <p key={i} className="text-xs text-orange-900">{w}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="outline" onClick={resetToSetup} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            New Session
          </Button>
          <Button
            onClick={saveSession}
            disabled={saving}
            className="gap-2 bg-gold-500 hover:bg-gold-600 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
            Save Session
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Active Simulation
  // ---------------------------------------------------------------------------
  const characterName = session?.characterProfile.name || 'Character';
  const characterRole = session?.characterProfile.role || selectedMode.character;

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[600px] gap-0">
      {/* TOP BAR */}
      <div className="flex items-center justify-between gap-3 bg-card border rounded-t-xl px-4 py-2.5 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xl">{selectedMode.icon}</span>
          <div>
            <p className="font-semibold text-sm leading-tight">{selectedMode.label}</p>
            <p className="text-xs text-muted-foreground">{scores.exchanges} exchanges</p>
          </div>
          <Badge variant="outline" className="text-xs hidden sm:flex">
            Phase: {session?.characterProfile.demeanor ?? 'neutral'}
          </Badge>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatTime(timer)}
        </div>

        {/* Score Summary */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:block">Score:</span>
          <span className={cn('font-bold text-lg', scoreColor(scores.overall))}>{scores.overall}</span>
          <Button
            variant={showTeleprompter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTeleprompter(s => !s)}
            className="h-7 text-xs gap-1"
            title="Toggle Teleprompter & Coaching Overlay"
          >
            📡 Teleprompter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={endSession}
            className="h-7 text-xs gap-1 ml-2"
          >
            <Square className="h-3 w-3" />
            End
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToSetup}
            className="h-7 text-xs gap-1"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex flex-1 min-h-0 border-x border-b rounded-b-xl overflow-hidden">
        {/* LEFT: Character panel */}
        <div className="w-[200px] shrink-0 border-r bg-muted/30 p-3 flex flex-col gap-3 hidden md:flex">
          <div className="text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              {selectedMode.character === 'judge' ? (
                <Gavel className="h-7 w-7 text-primary" />
              ) : selectedMode.character === 'juror' ? (
                <Users className="h-7 w-7 text-primary" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
            </div>
            <p className="font-semibold text-sm leading-tight">{characterName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{characterRole}</p>
          </div>

          <div className="border rounded-lg p-2 bg-card text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Demeanor</p>
            <p className="text-xs font-medium capitalize">{session?.characterProfile.demeanor}</p>
          </div>

          {/* Mini score bars */}
          <div className="space-y-2 mt-auto">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Live Scores</p>
            {SCORE_LABELS.map((key) => (
              <div key={key} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground truncate">{SCORE_DISPLAY[key].label}</span>
                  <span className={scoreColor(scores[key])}>{scores[key]}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', scoreBarColor(scores[key]))}
                    style={{ width: `${scores[key]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Messages */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-3">
                <span className="text-5xl">{selectedMode.icon}</span>
                <div>
                  <p className="font-semibold text-base">{selectedMode.label}</p>
                  <p className="text-muted-foreground text-sm max-w-xs mt-1">{selectedMode.description}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {caseData ? `Case: ${caseData.name} · ` : ''}Type your first question or statement below
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {msg.role !== 'user' && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center mt-1">
                    {selectedMode.character === 'judge' ? (
                      <Gavel className="h-4 w-4 text-muted-foreground" />
                    ) : selectedMode.character === 'juror' ? (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    'flex flex-col gap-1.5 max-w-[72%]',
                    msg.role === 'user' ? 'items-end' : 'items-start',
                  )}
                >
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {msg.role === 'user' ? 'You' : `${characterName} (${characterRole})`}
                  </span>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm',
                    )}
                  >
                    {msg.content}
                  </div>

                  {/* Coaching (collapsible) */}
                  {msg.coaching && (
                    <div className="w-full">
                      <button
                        onClick={() => toggleCoaching(msg.id)}
                        className="flex items-center gap-1.5 text-[11px] text-yellow-700 hover:text-yellow-800 font-medium"
                      >
                        <Lightbulb className="h-3 w-3" />
                        Coach Feedback
                        <ChevronDown
                          className={cn(
                            'h-3 w-3 transition-transform',
                            msg.coachingOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {msg.coachingOpen && (
                        <div className="mt-1.5 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                          <p className="text-xs text-yellow-900 leading-relaxed">{msg.coaching}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {/* Live caption */}
            {liveCaption && (
              <div className="sticky bottom-2 px-4">
                <div className="bg-black/80 backdrop-blur text-white rounded-lg px-4 py-2.5 shadow-xl border border-white/10">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Live</span>
                  </div>
                  <p className="text-sm font-medium">
                    {liveCaption}
                    <span className="inline-block w-0.5 h-4 ml-1 bg-white/60 animate-pulse" />
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Score + Coach panel */}
        <div className="w-[260px] shrink-0 border-l bg-muted/20 p-3 flex flex-col gap-3 hidden lg:flex">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">Score Dashboard</p>
            <div className="text-center mb-3">
              <p className={cn('text-5xl font-bold', scoreColor(scores.overall))}>{scores.overall}</p>
              <p className="text-xs text-muted-foreground mt-0.5">overall</p>
            </div>
            <Progress value={scores.overall} className="h-2 mb-4" />

            {SCORE_LABELS.map((key) => (
              <div key={key} className="mb-2.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {SCORE_DISPLAY[key].icon}
                    <span>{SCORE_DISPLAY[key].label}</span>
                  </div>
                  <span className={cn('font-semibold', scoreColor(scores[key]))}>{scores[key]}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', scoreBarColor(scores[key]))}
                    style={{ width: `${scores[key]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Recent coaching notes */}
          <div className="mt-auto">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">Latest Coaching</p>
            <ScrollArea className="h-32">
              <div className="space-y-2 pr-1">
                {messages
                  .filter((m) => m.coaching)
                  .slice(-4)
                  .reverse()
                  .map((m) => (
                    <div key={m.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-2">
                      <p className="text-[11px] text-yellow-900 leading-snug">{m.coaching}</p>
                    </div>
                  ))}
                {!messages.some((m) => m.coaching) && (
                  <p className="text-xs text-muted-foreground italic">Coaching notes will appear here.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* TELEPROMPTER OVERLAY */}
      {showTeleprompter && phase === 'active' && (
        <div className="border-t bg-slate-900 shrink-0" style={{ height: '420px' }}>
          <TrialTeleprompter
            captions={teleprompterCaptions}
            coachingTips={teleprompterTips}
            isListening={isListening}
            aiSpeaking={loading}
            onToggleMic={toggleListening}
            onClose={() => setShowTeleprompter(false)}
            modeLabel={selectedMode.label}
          />
        </div>
      )}

      {/* CAPTION BAR */}
      {captionLines.length > 0 && (
        <div className="bg-gray-900 text-white px-4 py-2 border-t shrink-0">
          <div className="space-y-0.5">
            {captionLines.slice(-2).map((line, i) => (
              <p
                key={i}
                className={cn(
                  'text-sm leading-snug',
                  i === captionLines.slice(-2).length - 1 ? 'opacity-100' : 'opacity-50',
                )}
              >
                {line.length > 120 ? line.slice(0, 120) + '…' : line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="border-t bg-card px-3 py-2.5 shrink-0 flex items-center gap-2">
        {voiceSupported && (
          <>
            <Button
              variant={voiceEnabled ? 'default' : 'outline'}
              size="icon"
              onClick={() => setVoiceEnabled((v) => !v)}
              title={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
              className="h-9 w-9 shrink-0"
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant={isListening ? 'destructive' : 'outline'}
              size="icon"
              className={cn('h-12 w-12 rounded-full shrink-0', isListening && 'animate-pulse')}
              onClick={toggleListening}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          </>
        )}

        <Input
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            messages.length === 0
              ? `Begin your ${selectedMode.label.toLowerCase()}…`
              : 'Your question or statement…'
          }
          disabled={loading}
          className="flex-1 h-10"
        />

        <Button
          onClick={() => sendMessage(inputText)}
          disabled={loading || !inputText.trim()}
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
