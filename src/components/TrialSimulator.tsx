import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Brain, AlertTriangle, CheckCircle, Target, RefreshCw,
  Zap, Send, Gavel, Users, BookOpen, Scale, FileText, Eye,
  MessageSquare, ChevronDown, ChevronUp, Lightbulb, Star,
  Mic, MicOff, Volume2, VolumeX
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Document } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useCaseFactsStore } from "@/store/useCaseFactsStore";
import { useDeepgram } from "@/hooks/useDeepgram";

interface CaseData {
  id: string;
  user_id: string;
  name: string;
  case_type: string;
  client_name: string;
  status: string;
  representation: string;
  case_theory: string | null;
  key_issues: string[] | null;
  winning_factors: string[] | null;
  next_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TrialSimulatorProps {
  caseData?: CaseData;
  documents?: Document[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  coaching?: string;
  hints?: string[];
  timestamp: Date;
}

interface DepositionQuestion {
  id: string;
  question: string;
  type: "foundational" | "trap" | "clarifying" | "impeachment";
  targetDocument?: string;
  suggestedFollowUp?: string;
  riskLevel: "low" | "medium" | "high";
  purpose: string;
}

interface TrialSimulationQuestionPayload {
  question?: string;
  type?: string;
  purpose?: string;
  risk?: string;
  riskLevel?: string;
  followUp?: string;
  suggestedFollowUp?: string;
  targetDocument?: string;
}

interface TrialSimulationResponse {
  message?: string;
  questions?: TrialSimulationQuestionPayload[];
  coaching?: string;
  performanceHints?: string[];
  objectionTypes?: string[];
}

interface SimMode {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  persona: string;
  icon: React.ElementType;
  difficulty: "easy" | "medium" | "hard";
  tips: string[];
  color: string;
}

const SIMULATION_MODES: SimMode[] = [
  {
    id: "cross-examination",
    title: "Cross-Examination",
    shortTitle: "Cross",
    description: "Challenge opposing witness testimony and expose inconsistencies",
    persona: "Hostile Witness",
    icon: Target,
    difficulty: "hard",
    tips: [
      "One fact per question — never compound",
      "Use leading questions: \"Isn't it true that...\"",
      "Never ask a question you don't know the answer to",
      "Control with yes/no — don't let the witness explain",
    ],
    color: "text-red-600",
  },
  {
    id: "direct-examination",
    title: "Direct Examination",
    shortTitle: "Direct",
    description: "Question your own witness to build your case narrative",
    persona: "Friendly Witness",
    icon: MessageSquare,
    difficulty: "medium",
    tips: [
      "Open-ended questions: Who, What, When, Where, How",
      "Build chronologically for the jury",
      "Avoid leading questions on direct",
      "Let the witness tell the story",
    ],
    color: "text-green-600",
  },
  {
    id: "opening-statement",
    title: "Opening Statement",
    shortTitle: "Opening",
    description: "Present your case theory and roadmap to the jury",
    persona: "Trial Judge",
    icon: BookOpen,
    difficulty: "easy",
    tips: [
      "State your theme in the first 30 seconds",
      "Preview evidence — don't argue facts",
      "End with what the jury will do",
      "Tell a story, not a list of facts",
    ],
    color: "text-blue-600",
  },
  {
    id: "closing-argument",
    title: "Closing Argument",
    shortTitle: "Closing",
    description: "Persuade the jury with evidence synthesis and a clear verdict ask",
    persona: "Judge & Jury Panel",
    icon: Scale,
    difficulty: "medium",
    tips: [
      "Connect every fact to a legal element",
      "Address the weaknesses head-on",
      "Use the evidence, not your opinion",
      "End with a specific, clear ask",
    ],
    color: "text-purple-600",
  },
  {
    id: "deposition",
    title: "Deposition",
    shortTitle: "Deposition",
    description: "Take sworn testimony in a discovery setting before trial",
    persona: "Deponent",
    icon: FileText,
    difficulty: "medium",
    tips: [
      "Short questions — never telegraph your goal",
      "Lock down facts early before impeachment",
      "Ask about every document the witness reviewed",
      "Silence is your friend — don't fill it",
    ],
    color: "text-orange-600",
  },
  {
    id: "motion-hearing",
    title: "Motion Hearing",
    shortTitle: "Motion",
    description: "Argue before a skeptical judge on a contested motion",
    persona: "Skeptical Judge",
    icon: Gavel,
    difficulty: "hard",
    tips: [
      "Know your controlling authority cold",
      "Answer the judge's question directly first",
      "Anticipate the other side's best argument",
      "Have a fallback position ready",
    ],
    color: "text-gray-700",
  },
  {
    id: "objections-practice",
    title: "Objections Practice",
    shortTitle: "Objections",
    description: "Sharpen your objection timing, grounds, and strategic judgment",
    persona: "Opposing Counsel & Judge",
    icon: AlertTriangle,
    difficulty: "medium",
    tips: [
      "Object before the witness answers",
      "State the ground immediately: \"Objection. Hearsay.\"",
      "Know when NOT to object — some questions help you",
      "Have a ready response if overruled",
    ],
    color: "text-yellow-600",
  },
  {
    id: "voir-dire",
    title: "Voir Dire",
    shortTitle: "Voir Dire",
    description: "Practice identifying juror bias and making strategic strikes",
    persona: "Prospective Juror",
    icon: Users,
    difficulty: "medium",
    tips: [
      "Build rapport before probing for bias",
      "Listen for what jurors don't say",
      "Use open-ended questions to encourage sharing",
      "Take notes on body language cues",
    ],
    color: "text-teal-600",
  },
  {
    id: "evidence-foundation",
    title: "Evidence Foundation",
    shortTitle: "Evidence",
    description: "Practice authenticating documents and admitting evidence",
    persona: "Witness & Judge",
    icon: Eye,
    difficulty: "medium",
    tips: [
      "Establish chain of custody for physical evidence",
      "Use the business records exception for routine docs",
      "Lay Daubert foundation before offering expert opinion",
      "Get the exhibit marked before showing it",
    ],
    color: "text-indigo-600",
  },
  {
    id: "deposition-prep",
    title: "Question Generator",
    shortTitle: "Gen Questions",
    description: "Generate strategic deposition questions from your case documents",
    persona: "Senior Partner",
    icon: Brain,
    difficulty: "easy",
    tips: [
      "Start foundational, then move to attack questions",
      "Create impeachment setup questions early",
      "Include trap questions that expose credibility gaps",
      "Target every key document with specific questions",
    ],
    color: "text-pink-600",
  },
];

const DIFFICULTY_STYLES = {
  easy: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  hard: "bg-red-100 text-red-800 border-red-200",
};

const RISK_STYLES = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const QUESTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  trap: <Target className="h-3.5 w-3.5 text-red-500" />,
  impeachment: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
  clarifying: <CheckCircle className="h-3.5 w-3.5 text-blue-500" />,
  foundational: <MessageSquare className="h-3.5 w-3.5 text-gray-500" />,
};

function normalizeQType(v?: string): DepositionQuestion["type"] {
  const t = (v || "").toLowerCase().trim();
  if (t === "trap" || t === "clarifying" || t === "impeachment" || t === "foundational") return t;
  return "foundational";
}

function normalizeRisk(v?: string): DepositionQuestion["riskLevel"] {
  const r = (v || "").toLowerCase().trim();
  if (r === "low" || r === "medium" || r === "high") return r;
  return "medium";
}

function mapQPayload(p: TrialSimulationQuestionPayload, idx: number, docs: Document[]): DepositionQuestion {
  const target = String(p.targetDocument || "").trim();
  const matched = docs.find(
    (d) =>
      target &&
      (d.name.toLowerCase().includes(target.toLowerCase()) ||
        target.toLowerCase().includes(d.name.toLowerCase()))
  );
  return {
    id: `q-${idx + 1}`,
    question: String(p.question || "").trim(),
    type: normalizeQType(p.type),
    riskLevel: normalizeRisk(p.riskLevel || p.risk),
    purpose: String(p.purpose || "Gather testimony tied to case facts."),
    suggestedFollowUp: String(p.suggestedFollowUp || p.followUp || "").trim() || undefined,
    targetDocument: matched?.name || target || undefined,
  };
}

export function TrialSimulator({ caseData, documents = [] }: TrialSimulatorProps) {
  const [selectedMode, setSelectedMode] = useState<SimMode>(SIMULATION_MODES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<DepositionQuestion[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showModePanel, setShowModePanel] = useState(true);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [objectionTypes, setObjectionTypes] = useState<string[]>([]);
  
  // Voice & Captioning State
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Browser-native TTS — replaces Azure TTS placeholder
  const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);

  const VOICE_ROLES: Record<string, { pitch: number; rate: number; voiceKeyword: string }> = {
    judge: { pitch: 0.85, rate: 0.92, voiceKeyword: "male" },
    witness: { pitch: 1.1, rate: 1.0, voiceKeyword: "female" },
    "opposing counsel": { pitch: 0.9, rate: 1.05, voiceKeyword: "male" },
    deponent: { pitch: 1.05, rate: 0.95, voiceKeyword: "female" },
    default: { pitch: 1.0, rate: 0.95, voiceKeyword: "male" },
  };

  const browserTTSSpeak = useCallback((text: string, role: string = "default") => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const config = VOICE_ROLES[role.toLowerCase()] || VOICE_ROLES.default;
    utter.pitch = config.pitch;
    utter.rate = config.rate;
    // Try to match a voice by keyword
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v =>
      v.lang.startsWith("en") && v.name.toLowerCase().includes(config.voiceKeyword)
    ) || voices.find(v => v.lang.startsWith("en"));
    if (match) utter.voice = match;
    utter.onstart = () => setIsTTSSpeaking(true);
    utter.onend = () => setIsTTSSpeaking(false);
    utter.onerror = () => setIsTTSSpeaking(false);
    ttsRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, []);

  const browserTTSStop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsTTSSpeaking(false);
  }, []);

  const deepgram = useDeepgram({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setUserInput(prev => {
          const newText = prev ? `${prev} ${text}` : text;
          return newText;
        });
        setCurrentTranscript("");
      } else {
        setCurrentTranscript(text);
      }
    },
    onError: (err) => {
      toast({ title: "Voice Recognition Error", description: err, variant: "destructive" });
      setIsVoiceEnabled(false);
    },
    apiKey: "your-deepgram-api-key" // User will need to provide this
  });

  useEffect(() => {
    if (isVoiceEnabled) {
      deepgram.startListening();
    } else {
      deepgram.stopListening();
    }
  }, [isVoiceEnabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, currentTranscript]);

  const switchMode = useCallback((mode: SimMode) => {
    setSelectedMode(mode);
    setMessages([]);
    setExchangeCount(0);
    setObjectionTypes([]);
    setQuestions([]);
    setShowQuestions(false);
    setUserInput("");
    if (window.innerWidth < 768) setShowModePanel(false);
  }, []);

  const resetSession = useCallback(() => {
    setMessages([]);
    setExchangeCount(0);
    setObjectionTypes([]);
    setUserInput("");
    inputRef.current?.focus();
  }, []);

  const generateQuestions = useCallback(async () => {
    if (!caseData) {
      toast({ title: "No case selected", variant: "destructive" });
      return;
    }

    const analyzedDocs = documents.filter((d) => d.ai_analyzed || !!d.summary || !!d.ocr_text);
    const sourceDocs = analyzedDocs.length > 0 ? analyzedDocs : documents;

    setIsGeneratingQuestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("trial-simulation", {
        body: {
          caseId: caseData.id,
          mode: "deposition-prep",
          messages: [
            {
              role: "user",
              content: `Generate strategic deposition questions for case "${caseData.name}". Return JSON with shape: {"questions":[{"question":"...","type":"foundational|trap|clarifying|impeachment","purpose":"...","risk":"low|medium|high","followUp":"...","targetDocument":"..."}]}. Documents available: ${sourceDocs.length}. Focus on contradictions, admissions, and impeachment setup.`,
            },
          ],
        },
      });

      if (error) throw error;

      const payload = (data || {}) as TrialSimulationResponse;
      let generated: DepositionQuestion[] = [];

      if (Array.isArray(payload.questions) && payload.questions.length > 0) {
        generated = payload.questions
          .map((q, i) => mapQPayload(q, i, sourceDocs))
          .filter((q) => q.question.length > 0);
      }

      if (generated.length === 0) {
        generated = [
          { id: "q-1", question: "Can you identify this document and explain when you first saw it?", type: "foundational", riskLevel: "low", purpose: "Establish authentication and personal knowledge", suggestedFollowUp: "Who gave you this document?" },
          { id: "q-2", question: "Your testimony today contradicts this document — which is accurate?", type: "impeachment", riskLevel: "high", purpose: "Create a credibility conflict between testimony and record", suggestedFollowUp: "What contemporaneous evidence supports your version?" },
        ];
      }

      setQuestions(generated);
      setShowQuestions(true);
      toast({ title: `Generated ${generated.length} deposition questions` });
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to generate questions", variant: "destructive" });
    } finally {
      setIsGeneratingQuestions(false);
    }
  }, [caseData, documents, toast]);

  const sendMessage = useCallback(async () => {
    const text = userInput.trim();
    if (!text || !caseData || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setUserInput("");
    setIsLoading(true);

    try {
      const caseEvents = useCaseFactsStore.getState().getEvents(caseData.id);
      const caseFacts = useCaseFactsStore.getState().getFacts(caseData.id);

      const contextParts: string[] = [];
      if (caseFacts.length > 0) {
        contextParts.push(`CASE FACTS:\n${caseFacts.slice(0, 10).map((f) => `- ${f.text}`).join("\n")}`);
      }
      if (caseEvents.length > 0) {
        contextParts.push(`KEY EVENTS:\n${caseEvents.slice(0, 8).map((e) => `- ${e.date}: ${e.event_title}`).join("\n")}`);
      }
      if (documents.length > 0) {
        contextParts.push(`DOCUMENTS:\n${documents.slice(0, 8).map((d) => `- ${d.name}: ${d.summary || "no summary"}`).join("\n")}`);
      }

      const historyForApi = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-12)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const { data, error } = await supabase.functions.invoke("trial-simulation", {
        body: {
          caseId: caseData.id,
          mode: selectedMode.id,
          context: contextParts.join("\n\n"),
          messages: [...historyForApi, { role: "user", content: text }],
        },
      });

      if (error) throw error;

      const payload = (data || {}) as TrialSimulationResponse;

      if (payload.objectionTypes?.length) {
        setObjectionTypes(payload.objectionTypes);
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: payload.message || "The witness pauses and waits for your next question.",
        coaching: payload.coaching || undefined,
        hints: payload.performanceHints?.length ? payload.performanceHints : undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setExchangeCount((n) => n + 1);

      if (isTTSEnabled && aiMsg.content) {
        browserTTSSpeak(aiMsg.content, selectedMode.persona);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Response failed — try again", variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setUserInput(text);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [userInput, caseData, isLoading, messages, selectedMode, documents, toast, isTTSEnabled, browserTTSSpeak]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const ModeIcon = selectedMode.icon;
  const isDepPrepMode = selectedMode.id === "deposition-prep";

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Mode Panel */}
      <div className={`${showModePanel ? "flex" : "hidden lg:flex"} flex-col w-full lg:w-64 xl:w-72 shrink-0`}>
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader className="py-3 px-4 border-b shrink-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Simulation Mode
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {SIMULATION_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = selectedMode.id === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => switchMode(mode)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-all ${
                      isActive
                        ? "bg-gold-50 border border-gold-200 shadow-sm"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? mode.color : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                            {mode.shortTitle}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${DIFFICULTY_STYLES[mode.difficulty]}`}>
                            {mode.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{mode.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Chat Panel */}
      <div className="flex flex-col flex-1 min-w-0 gap-3">
        {/* Header */}
        <Card className="shrink-0">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  className="lg:hidden text-muted-foreground hover:text-foreground"
                  onClick={() => setShowModePanel((v) => !v)}
                >
                  {showModePanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="p-1.5 rounded-md bg-muted">
                  <ModeIcon className={`h-4 w-4 ${selectedMode.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{selectedMode.title}</span>
                    <Badge variant="outline" className="text-[10px] py-0">
                      vs. {selectedMode.persona}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {exchangeCount === 0
                      ? "Session not started"
                      : `${exchangeCount} exchange${exchangeCount !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isTTSEnabled ? "default" : "outline"}
                  onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                  className="h-8 px-2"
                  title={isTTSEnabled ? "Disable Voice Output" : "Enable Voice Output"}
                >
                  {isTTSEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                
                <Button
                  size="sm"
                  variant={isVoiceEnabled ? "destructive" : "outline"}
                  onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  className="h-8 px-2"
                  title={isVoiceEnabled ? "Stop Voice Recognition" : "Start Voice Recognition"}
                >
                  {isVoiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>

                {isDepPrepMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateQuestions}
                    disabled={isGeneratingQuestions || !caseData}
                    className="h-8 text-xs"
                  >
                    {isGeneratingQuestions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Brain className="h-3.5 w-3.5 mr-1" />
                    )}
                    Generate Questions
                  </Button>
                )}
                {messages.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={resetSession} className="h-8 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="flex-1 overflow-hidden flex flex-col relative">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
                <div className="p-4 rounded-full bg-muted">
                  <ModeIcon className={`h-8 w-8 ${selectedMode.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedMode.title}</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mt-1">{selectedMode.description}</p>
                </div>
                <div className="bg-muted rounded-xl p-4 max-w-sm w-full text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Tips for this mode
                  </p>
                  <ul className="space-y-1.5">
                    {selectedMode.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                        <Star className="h-3 w-3 text-gold-500 mt-0.5 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
                {isDepPrepMode ? (
                  <Button onClick={generateQuestions} disabled={isGeneratingQuestions || !caseData}>
                    {isGeneratingQuestions ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Brain className="h-4 w-4 mr-2" />
                    )}
                    Generate Deposition Questions
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {caseData ? `Case: ${caseData.name}` : "No case selected"} · Type your first question or statement below
                  </p>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-3`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center mt-1">
                    <ModeIcon className={`h-4 w-4 ${selectedMode.color}`} />
                  </div>
                )}
                <div className={`flex flex-col gap-2 max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {msg.role === "user" ? "You" : selectedMode.persona}
                  </span>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {msg.hints && msg.hints.length > 0 && (
                    <div className="w-full space-y-1.5">
                      {msg.hints.map((hint, i) => (
                        <Alert key={i} className="py-2 border-orange-200 bg-orange-50">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          <AlertDescription className="text-xs text-orange-800 ml-1">{hint}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}

                  {msg.coaching && (
                    <div className="w-full rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-700">
                          Coach Feedback
                        </span>
                      </div>
                      <p className="text-xs text-yellow-900 leading-relaxed">{msg.coaching}</p>
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <ModeIcon className={`h-4 w-4 ${selectedMode.color}`} />
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

            {/* Live Captioning Overlay */}
            {currentTranscript && (
              <div className="sticky bottom-4 left-0 right-0 px-4 z-10">
                <div className="bg-black/80 backdrop-blur-md text-white rounded-lg p-4 shadow-xl border border-white/20 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Live Captions</span>
                  </div>
                  <p className="text-lg font-medium leading-tight">
                    {currentTranscript}
                    <span className="inline-block w-1 h-5 ml-1 bg-white/50 animate-pulse" />
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Objection quick-reference buttons */}
          {selectedMode.id === "objections-practice" && objectionTypes.length > 0 && (
            <div className="px-4 pb-2 border-t pt-2 shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                Quick Objections
              </p>
              <div className="flex wrap gap-1">
                {objectionTypes.slice(0, 10).map((obj) => (
                  <button
                    key={obj}
                    onClick={() => setUserInput(`Objection. ${obj}.`)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors border"
                  >
                    {obj}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          {!isDepPrepMode && (
            <div className="border-t p-3 shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    messages.length === 0
                      ? `Begin your ${selectedMode.shortTitle.toLowerCase()}...`
                      : "Continue... (Enter to send, Shift+Enter for new line)"
                  }
                  className="min-h-[60px] max-h-[160px] resize-none text-sm"
                  disabled={isLoading || !caseData}
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={isLoading || (!userInput.trim() && !currentTranscript) || !caseData}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!caseData && (
                <p className="text-xs text-muted-foreground mt-1.5 text-center">Select a case to start practicing</p>
              )}
            </div>
          )}
        </Card>

        {/* Deposition Questions Panel */}
        {(isDepPrepMode || questions.length > 0) && (
          <Card className="shrink-0">
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Deposition Questions
                  {questions.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">{questions.length}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {questions.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowQuestions((v) => !v)}>
                      {showQuestions ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                      {showQuestions ? "Hide" : "Show"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateQuestions}
                    disabled={isGeneratingQuestions || !caseData}
                    className="h-7 text-xs"
                  >
                    {isGeneratingQuestions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 mr-1" />
                    )}
                    {questions.length > 0 ? "Regenerate" : "Generate"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {showQuestions && questions.length > 0 && (
              <ScrollArea className="max-h-[320px]">
                <div className="p-3 space-y-2">
                  {questions.map((q) => (
                    <div key={q.id} className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {QUESTION_TYPE_ICONS[q.type]}
                          <Badge variant="outline" className="text-[10px] capitalize py-0 px-1.5">{q.type}</Badge>
                          <Badge className={`text-[10px] py-0 px-1.5 ${RISK_STYLES[q.riskLevel]}`}>
                            {q.riskLevel} risk
                          </Badge>
                        </div>
                        {q.targetDocument && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={q.targetDocument}>
                            📄 {q.targetDocument}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1.5">{q.question}</p>
                      <p className="text-xs text-muted-foreground mb-2">{q.purpose}</p>
                      {q.suggestedFollowUp && (
                        <p className="text-xs text-muted-foreground italic">
                          Follow-up: &ldquo;{q.suggestedFollowUp}&rdquo;
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 text-xs w-full border border-dashed hover:border-solid hover:bg-muted"
                        onClick={() => {
                          const depMode = SIMULATION_MODES.find((m) => m.id === "deposition");
                          if (depMode) {
                            switchMode(depMode);
                          }
                          setUserInput(q.question);
                          setTimeout(() => inputRef.current?.focus(), 150);
                        }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Practice in Deposition mode
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
