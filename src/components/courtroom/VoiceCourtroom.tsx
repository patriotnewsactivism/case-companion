import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel,
  Play,
  Square,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  Send,
  Lightbulb,
  Radio,
  Hand,
  User,
  Scale,
  MessageCircle,
  Timer,
  RotateCcw,
  Download,
  AlertTriangle,
  Settings,
  Headphones,
  Eye,
  EyeOff,
  Brain,
  ChevronDown,
  ChevronUp,
  ScrollText,
  Target,
  Star,
  ChevronRight,
  X,
  BookOpen,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVoiceEngine, VoiceMode } from "@/hooks/useVoiceEngine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  createTrialSession,
  endTrialSession,
  addTranscriptMessage,
  addCoachingTip,
  PerformanceMetrics,
} from "@/lib/trial-session-api";

// ---------- Types ----------

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  aiRole?: string;
}

interface SimulationResponse {
  success: boolean;
  message: string;
  coaching?: string;
  role: string;
  performanceHints?: string[];
  objectionTypes?: string[];
  courtroomAction?: string;
  teleprompterScript?: string;
  legalError?: string;
  encouragement?: string;
}

interface VoiceCourtroomProps {
  caseId: string;
  caseName: string;
  mode: string;
  modeName: string;
  onEnd: () => void;
}

interface CoachingEntry {
  id: string;
  type: "suggestion" | "warning" | "success";
  text: string;
  timestamp: Date;
}

interface CaptionEntry {
  id: string;
  speaker: "you" | "ai";
  text: string;
  interim?: boolean;
  timestamp: Date;
}

// ---------- Constants ----------

const OBJECTION_QUICK_BUTTONS = [
  "Hearsay",
  "Leading",
  "Relevance",
  "Speculation",
  "Foundation",
  "Asked and answered",
  "Argumentative",
  "Beyond scope",
  "Compound",
  "Narrative",
];

const ROLE_COLORS: Record<string, string> = {
  judge: "text-amber-400",
  witness: "text-blue-400",
  "opposing counsel": "text-red-400",
  "court clerk": "text-slate-400",
  "potential juror": "text-purple-400",
  deponent: "text-cyan-400",
  default: "text-slate-300",
};

const ROLE_ICONS: Record<string, string> = {
  judge: "Judge",
  witness: "Witness",
  "opposing counsel": "Opp. Counsel",
  "your own witness": "Witness",
  "skeptical judge": "Judge",
  "judge evaluating your opening": "Judge",
  "judge and jury evaluating your closing": "Judge & Jury",
  "opposing counsel and judge": "Opp. Counsel / Judge",
  "potential juror": "Juror",
  "witness and judge": "Witness / Judge",
  deponent: "Deponent",
};

function getRoleDisplay(role: string): string {
  return ROLE_ICONS[role.toLowerCase()] || role;
}

function getRoleColor(role: string): string {
  const lower = role.toLowerCase();
  for (const [key, color] of Object.entries(ROLE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return ROLE_COLORS.default;
}

// ---------- Client-side AI fallback ----------

const FALLBACK_SYSTEM_PROMPTS: Record<string, string> = {
  "cross-examination": "You are a hostile witness being cross-examined in a civil rights trial. Stay in character. Be evasive but eventually yield to strong questions. Provide coaching about questioning technique in a separate field.",
  "direct-examination": "You are a cooperative witness in direct examination. Answer clearly but don't volunteer extra info. Coach the attorney on question form.",
  "opening-statement": "You are a judge evaluating an opening statement. Respond with observations about effectiveness and suggest improvements.",
  "closing-argument": "You are a judge and jury evaluating a closing argument. Rate persuasiveness and note logical gaps.",
  "objections-practice": "You are opposing counsel making objectionable statements. Sometimes ask leading questions, sometimes hearsay, sometimes speculation. The attorney must object correctly.",
  "voir-dire": "You are a potential juror in voir dire. Answer honestly about biases. Some answers should raise red flags.",
  "deposition": "You are a deponent being questioned. Be precise about what you do and don't recall. Object to form when appropriate.",
};

async function clientSideSimulation(
  mode: string,
  messages: { role: string; content: string }[],
  caseId: string,
): Promise<SimulationResponse> {
  // Use Supabase Gemini proxy if available, otherwise fall back to a simple response
  const systemPrompt = FALLBACK_SYSTEM_PROMPTS[mode] || FALLBACK_SYSTEM_PROMPTS["cross-examination"];

  const prompt = `${systemPrompt}

Case context: case ID ${caseId}

Conversation so far:
${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

Respond in valid JSON:
{
  "message": "your in-character spoken response",
  "role": "your courtroom role (judge/witness/opposing counsel)",
  "coaching": "coaching feedback for the attorney",
  "teleprompterScript": "suggested next statement for the attorney",
  "performanceHints": ["tip 1", "tip 2"],
  "legalError": null or "description of any legal error made",
  "encouragement": null or "positive reinforcement if warranted"
}`;

  try {
    const { data, error } = await supabase.functions.invoke("gemini-proxy", {
      body: {
        prompt,
        model: "gemini-2.5-flash",
        options: { temperature: 0.85, maxOutputTokens: 1024 },
      },
    });

    if (error) throw error;
    if (!data?.success || !data?.text) throw new Error("Empty response");

    let raw = data.text.replace(/```json\n?|```/g, "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];

    const parsed = JSON.parse(raw);
    return {
      success: true,
      message: parsed.message || parsed.speak || raw,
      role: parsed.role || "opposing counsel",
      coaching: parsed.coaching,
      teleprompterScript: parsed.teleprompterScript,
      performanceHints: parsed.performanceHints,
      legalError: parsed.legalError,
      encouragement: parsed.encouragement,
    };
  } catch {
    // Last resort: simple fallback so user always gets a response
    return {
      success: true,
      message: "I'll need you to rephrase that, Counselor. The court didn't fully understand your question.",
      role: mode === "objections-practice" ? "judge" : "opposing counsel",
      coaching: "The AI service is temporarily slow. Try speaking clearly and keep your questions short and direct.",
      performanceHints: [],
    };
  }
}

// ---------- Sub-components ----------

function AudioVisualizer({ level, isActive }: { level: number; isActive: boolean }) {
  const bars = 12;
  return (
    <div className="flex items-end gap-[2px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const barLevel = isActive
          ? Math.min(1, level * (1 + Math.sin(Date.now() / 100 + i) * 0.3))
          : 0;
        return (
          <motion.div
            key={i}
            className={cn(
              "w-1 rounded-full transition-colors",
              isActive ? "bg-red-500" : "bg-slate-600"
            )}
            animate={{ height: isActive ? Math.max(4, barLevel * 32) : 4 }}
            transition={{ duration: 0.05 }}
          />
        );
      })}
    </div>
  );
}

function SpeakingIndicator({ role }: { role: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/80 rounded-full"
    >
      <div className="flex gap-[2px]">
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="w-[3px] bg-emerald-400 rounded-full"
            animate={{ height: [4, 12, 6, 14, 4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <span className="text-xs text-emerald-400 font-medium">
        {getRoleDisplay(role)} speaking
      </span>
    </motion.div>
  );
}

function CourtroomParticipant({
  label,
  icon,
  isActive,
  isSpeaking,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isSpeaking: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
        isActive ? "bg-slate-700/50" : "bg-slate-800/30",
        isSpeaking && "ring-2 ring-emerald-400/60",
        className
      )}
      animate={isSpeaking ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 1, repeat: isSpeaking ? Infinity : 0 }}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-lg",
          isSpeaking
            ? "bg-emerald-500/20 text-emerald-400"
            : isActive
              ? "bg-slate-600 text-slate-200"
              : "bg-slate-700 text-slate-500"
        )}
      >
        {icon}
      </div>
      <span className={cn("text-[10px] font-medium", isActive ? "text-slate-300" : "text-slate-600")}>
        {label}
      </span>
      {isSpeaking && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

function TranscriptMessage({ message, aiRole }: { message: Message; aiRole?: string }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center py-2"
      >
        <div className="bg-slate-700/50 border border-slate-600/50 rounded-full px-4 py-1.5">
          <p className="text-xs text-slate-400 text-center">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
          isUser ? "bg-accent/20 text-accent" : "bg-slate-600 text-slate-200"
        )}
      >
        {isUser ? "You" : <Scale className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[75%] space-y-1", isUser ? "items-end" : "items-start")}>
        {!isUser && aiRole && (
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", getRoleColor(aiRole))}>
            {getRoleDisplay(aiRole)}
          </span>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-accent text-white rounded-tr-sm"
              : "bg-slate-700/80 text-slate-100 rounded-tl-sm border border-slate-600/30"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] text-slate-500 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

// ---------- Main Component ----------

export function VoiceCourtroom({ caseId, caseName, mode, modeName, onEnd }: VoiceCourtroomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [coaching, setCoaching] = useState<string | null>(null);
  const [performanceHints, setPerformanceHints] = useState<string[]>([]);
  const [aiRole, setAiRole] = useState<string>("");
  // Real-time trial assistant
  const [assistantPanel, setAssistantPanel] = useState<Record<string, unknown> | null>(null);
  const [showAssistant, setShowAssistant] = useState(true);
  const [sessionStartTime] = useState(new Date());
  const [exchangeCount, setExchangeCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [speechOutputEnabled, setSpeechOutputEnabled] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalQuestions: 0,
    successfulObjections: 0,
    missedObjections: 0,
    leadingQuestionsUsed: 0,
    openQuestionsUsed: 0,
    avgResponseTimeMs: null,
    credibilityScore: null,
  });

  // Teleprompter and coaching state
  const [teleprompterText, setTeleprompterText] = useState<string>("");
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [coachingHistory, setCoachingHistory] = useState<CoachingEntry[]>([]);
  const [showCoachingPanel, setShowCoachingPanel] = useState(true);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);

  // Live captions
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const manualMicPauseRef = useRef(false);
  const micBlockedRef = useRef(false);
  const initializedVoiceModeRef = useRef(false);
  const sessionCreatedRef = useRef(false);

  // Voice engine
  const voice = useVoiceEngine({
    onTranscript: (text, isFinal) => {
      const normalized = text.trim();
      if (!normalized) return;

      // Keep the textarea in sync so users can see what the mic captured
      setCurrentInput(normalized);

      // Update live captions
      if (isFinal) {
        inputRef.current?.blur();
        setCaptions(prev => {
          // Remove any interim captions from "you"
          const withoutInterim = prev.filter(c => !(c.speaker === "you" && c.interim));
          return [...withoutInterim, {
            id: `cap-you-${Date.now()}`,
            speaker: "you" as const,
            text: normalized,
            interim: false,
            timestamp: new Date(),
          }];
        });
      } else {
        // Show interim caption
        setCaptions(prev => {
          const withoutInterim = prev.filter(c => !(c.speaker === "you" && c.interim));
          return [...withoutInterim, {
            id: `cap-you-interim`,
            speaker: "you" as const,
            text: normalized,
            interim: true,
            timestamp: new Date(),
          }];
        });
      }
    },
    onAutoSend: (text) => {
      if (text.trim()) {
        handleSendMessage(text.trim());
      }
    },
    onError: (message) => {
      const lower = message.toLowerCase();
      if (
        lower.includes("denied") ||
        lower.includes("not supported") ||
        lower.includes("no microphone")
      ) {
        micBlockedRef.current = true;
      }
      toast.error(message, { duration: 6000 });
    },
    initialVoiceMode: "hands-free",
  });

  const {
    isListening,
    isSpeaking,
    voiceMode,
    interimTranscript,
    audioLevel,
    speechSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setVoiceMode,
  } = voice;

  // Intro message
  useEffect(() => {
    const introMessage: Message = {
      id: "intro",
      role: "system",
      content: `${modeName} — ${caseName}. Voice courtroom is live. Speak naturally or type below.`,
      timestamp: new Date(),
    };
    setMessages([introMessage]);
  }, [modeName, caseName]);

  // Create session on mount
  useEffect(() => {
    if (sessionCreatedRef.current) return;
    sessionCreatedRef.current = true;

    const initSession = async () => {
      try {
        const session = await createTrialSession({
          case_id: caseId,
          mode,
          scenario: modeName,
        });
        setSessionId(session.id);
      } catch (error) {
        console.error("Failed to create trial session:", error);
      }
    };

    initSession();
  }, [caseId, mode, modeName]);

  // Initialize simulator in hands-free mode for natural turn-taking
  useEffect(() => {
    if (initializedVoiceModeRef.current) return;
    initializedVoiceModeRef.current = true;
    setVoiceMode("hands-free");
  }, [setVoiceMode]);

  // AI simulation mutation — with client-side fallback
  const simulationMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const conversationMessages = messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

      // Try edge function first
      try {
        const response = await supabase.functions.invoke("trial-simulation", {
          body: {
            caseId,
            mode,
            messages: [
              ...conversationMessages,
              { role: "user", content: userMessage },
            ],
          },
        });

        if (response.error) throw response.error;
        if (!response.data) throw new Error("Empty response");
        return response.data as SimulationResponse;
      } catch (edgeFnError) {
        console.warn("trial-simulation edge function failed, using client-side fallback:", edgeFnError);
        // Client-side fallback via Gemini proxy
        return clientSideSimulation(mode, [
          ...conversationMessages,
          { role: "user", content: userMessage },
        ], caseId);
      }
    },
    onSuccess: (data, userMessage) => {
      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        aiRole: data.role,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setAiRole(data.role);
      setExchangeCount(prev => prev + 1);

      // Live caption for AI response
      setCaptions(prev => [...prev, {
        id: `cap-ai-${Date.now()}`,
        speaker: "ai" as const,
        text: data.message,
        interim: false,
        timestamp: new Date(),
      }]);

      // Coaching & teleprompter
      if (data.coaching) {
        setCoaching(data.coaching);
        setCoachingHistory(prev => [{
          id: `coach-${Date.now()}`,
          type: "suggestion" as const,
          text: data.coaching!,
          timestamp: new Date(),
        }, ...prev].slice(0, 20));
      }
      if (data.performanceHints?.length) setPerformanceHints(data.performanceHints);
      if (data.teleprompterScript) setTeleprompterText(data.teleprompterScript);
      if (data.legalError) {
        setLegalError(data.legalError);
        setCoachingHistory(prev => [{
          id: `err-${Date.now()}`,
          type: "warning" as const,
          text: data.legalError!,
          timestamp: new Date(),
        }, ...prev].slice(0, 20));
        setTimeout(() => setLegalError(null), 8000);
      }
      if (data.encouragement) {
        setEncouragement(data.encouragement);
        setCoachingHistory(prev => [{
          id: `enc-${Date.now()}`,
          type: "success" as const,
          text: data.encouragement!,
          timestamp: new Date(),
        }, ...prev].slice(0, 20));
        setTimeout(() => setEncouragement(null), 5000);
      }

      // Real-time trial assistant — runs in parallel, non-blocking
      const conversationHistory = messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));
      supabase.functions.invoke("trial-assistant", {
        body: {
          caseId,
          mode,
          lastQuestion: userMessage,
          lastAnswer: data.message,
          recentHistory: conversationHistory.slice(-6),
        },
      }).then(({ data: assistantData }) => {
        if (assistantData && !assistantData.error) {
          setAssistantPanel(assistantData as Record<string, unknown>);
        }
      }).catch(() => { /* non-fatal */ });

      const normalizedUserMessage = userMessage.toLowerCase();
      const usedOpenQuestion = /\b(what|how|why|when|where|who)\b/.test(normalizedUserMessage);
      const usedLeadingQuestion =
        normalizedUserMessage.includes("isn't it true") ||
        normalizedUserMessage.includes("wouldn't you agree") ||
        normalizedUserMessage.includes("isn't that correct");

      setMetrics(prev => ({
        ...prev,
        totalQuestions: prev.totalQuestions + 1,
        openQuestionsUsed: prev.openQuestionsUsed + (usedOpenQuestion ? 1 : 0),
        leadingQuestionsUsed: prev.leadingQuestionsUsed + (usedLeadingQuestion ? 1 : 0),
      }));

      if (sessionId) {
        addTranscriptMessage(sessionId, {
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
          aiRole: data.role,
        }).catch(console.error);

        if (data.coaching) {
          addCoachingTip(sessionId, data.coaching).catch(console.error);
        }
      }

      if (speechOutputEnabled) {
        speak(data.message, data.role);
      }
    },
    onError: (error: Error) => {
      console.error("Simulation error:", error);
      const errorMsg = error.message?.includes("API")
        ? "AI service is temporarily unavailable. Please try again."
        : error.message?.includes("authenticated")
          ? "Your session has expired. Please log in again."
          : error.message || "Failed to get AI response. Please try again.";
      toast.error(errorMsg, {
        description: "Tap 'Send' or speak again to retry.",
        duration: 6000,
      });
    },
  });

  // Auto-arm microphone when appropriate so users do not need to keep tapping the mic
  useEffect(() => {
    if (!speechSupported) return;
    if (voiceMode !== "hands-free") return;
    if (isListening || isSpeaking || simulationMutation.isPending) return;
    if (manualMicPauseRef.current || micBlockedRef.current) return;

    const timer = window.setTimeout(() => {
      startListening();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    isListening,
    isSpeaking,
    simulationMutation.isPending,
    speechSupported,
    startListening,
    voiceMode,
  ]);

  const handleSendMessage = useCallback((text?: string) => {
    const messageText = text || currentInput.trim();
    if (!messageText || simulationMutation.isPending) return;
    manualMicPauseRef.current = false;

    // Stop listening/speaking before sending
    if (isListening) stopListening();
    if (isSpeaking) stopSpeaking();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setCurrentInput("");

    // Log to session
    if (sessionId) {
      addTranscriptMessage(sessionId, {
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      }).catch(console.error);
    }

    simulationMutation.mutate(messageText);
  }, [currentInput, isListening, isSpeaking, simulationMutation, stopListening, stopSpeaking, sessionId]);

  const handleObjection = (type: string) => {
    const objectionText = `Objection, Your Honor! ${type}.`;
    handleSendMessage(objectionText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = () => {
    if (!speechSupported) {
      toast.error("Voice input is not supported in this browser. Use latest Chrome/Edge on HTTPS.");
      return;
    }

    if (isListening) {
      manualMicPauseRef.current = true;
      stopListening();
    } else {
      manualMicPauseRef.current = false;
      micBlockedRef.current = false;
      startListening();
    }
  };

  const cycleVoiceMode = () => {
    const modes: VoiceMode[] = ["push-to-talk", "hands-free", "off"];
    const currentIdx = modes.indexOf(voiceMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    manualMicPauseRef.current = nextMode !== "hands-free";
    if (nextMode === "hands-free") {
      micBlockedRef.current = false;
    }
    setVoiceMode(nextMode);
    toast.info(`Voice mode: ${nextMode}`);
  };

  const handleEndSession = async () => {
    stopListening();
    stopSpeaking();

    if (sessionId) {
      try {
        const finalMetrics: PerformanceMetrics = {
          ...metrics,
          credibilityScore: metrics.totalQuestions > 0
            ? Math.min(10, Math.max(1, 7 + (metrics.successfulObjections * 0.5) - (metrics.missedObjections * 0.3)))
            : null,
        };

        await endTrialSession(sessionId, finalMetrics);
        toast.success("Session saved", {
          description: `Completed ${exchangeCount} exchanges. View your performance in Trial Prep.`,
        });
      } catch (error) {
        console.error("Failed to save session:", error);
        toast.error("Failed to save session");
      }
    }

    onEnd();
  };

  const exportTranscript = () => {
    const transcript = messages
      .map(m => {
        const role = m.role === "user" ? "ATTORNEY" : m.role === "system" ? "COURT" : (m.aiRole || "AI").toUpperCase();
        return `[${m.timestamp.toLocaleTimeString()}] ${role}: ${m.content}`;
      })
      .join("\n\n");

    // Include coaching history
    const coachingLog = coachingHistory.length > 0
      ? "\n\n=== COACHING NOTES ===\n" + coachingHistory.map(c =>
        `[${c.timestamp.toLocaleTimeString()}] ${c.type.toUpperCase()}: ${c.text}`
      ).join("\n")
      : "";

    const blob = new Blob([transcript + coachingLog], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `courtroom-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported with coaching notes");
  };

  const elapsed = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;
  const isObjectionMode = mode === "objections-practice";

  // Determine which participant is "active"
  const judgeActive = aiRole.toLowerCase().includes("judge");
  const witnessActive = aiRole.toLowerCase().includes("witness") || aiRole.toLowerCase().includes("deponent") || aiRole.toLowerCase().includes("juror");
  const opposingActive = aiRole.toLowerCase().includes("opposing") || aiRole.toLowerCase().includes("counsel");

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl">
      {/* Courtroom Header Bar */}
      <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <motion.div
                className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-red-500"
                animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">{modeName}</span>
              <span className="text-xs text-slate-400 ml-2">| {caseName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-slate-700/50 border-slate-600 text-slate-300 gap-1">
              <Timer className="h-3 w-3" />
              {elapsedMin}:{String(elapsedSec).padStart(2, "0")}
            </Badge>
            <Badge variant="outline" className="text-xs bg-slate-700/50 border-slate-600 text-slate-300">
              {exchangeCount} exchanges
            </Badge>
            {aiRole && (
              <Badge className={cn("text-xs border-0", getRoleColor(aiRole), "bg-slate-700/50")}>
                {getRoleDisplay(aiRole)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Courtroom Scene */}
      <div className="bg-slate-800/40 border-b border-slate-700/30 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Courtroom participants */}
          <div className="flex items-center gap-3">
            <CourtroomParticipant
              label="Judge"
              icon={<Gavel className="h-4 w-4" />}
              isActive={judgeActive}
              isSpeaking={isSpeaking && judgeActive}
            />
            <CourtroomParticipant
              label="Witness"
              icon={<User className="h-4 w-4" />}
              isActive={witnessActive}
              isSpeaking={isSpeaking && witnessActive}
            />
            <CourtroomParticipant
              label="Opp. Counsel"
              icon={<Scale className="h-4 w-4" />}
              isActive={opposingActive}
              isSpeaking={isSpeaking && opposingActive}
            />
            <Separator orientation="vertical" className="h-12 bg-slate-700" />
            <CourtroomParticipant
              label="You"
              icon={<MessageCircle className="h-4 w-4" />}
              isActive={true}
              isSpeaking={isListening}
              className="ring-1 ring-accent/30"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={cycleVoiceMode}
              className={cn(
                "text-xs gap-1 h-8",
                voiceMode === "hands-free" ? "text-emerald-400" : "text-slate-400"
              )}
              title={`Voice mode: ${voiceMode}`}
            >
              {voiceMode === "hands-free" ? (
                <Radio className="h-3.5 w-3.5" />
              ) : voiceMode === "push-to-talk" ? (
                <Mic className="h-3.5 w-3.5" />
              ) : (
                <MicOff className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {voiceMode === "hands-free" ? "Hands-free" : voiceMode === "push-to-talk" ? "Push-to-talk" : "Voice off"}
              </span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSpeechOutputEnabled(!speechOutputEnabled)}
              className="text-slate-400 hover:text-white h-8"
              title={speechOutputEnabled ? "Mute AI voice" : "Unmute AI voice"}
            >
              {speechOutputEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCoachingPanel(!showCoachingPanel)}
              className={cn("h-8", showCoachingPanel ? "text-purple-400" : "text-slate-400")}
              title={showCoachingPanel ? "Hide coaching" : "Show coaching"}
            >
              <Brain className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={exportTranscript}
              className="text-slate-400 hover:text-white h-8"
              title="Export transcript"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEndSession}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 gap-1"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">End</span>
            </Button>
          </div>
        </div>

        {/* Speaking indicator */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-center pt-2"
            >
              <SpeakingIndicator role={aiRole} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ════════ Live Caption Bar ════════ */}
      <div className="shrink-0 px-4 py-2 bg-slate-900/80 border-b border-slate-800/50 min-h-[44px] flex items-center gap-2">
        {isSpeaking ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex gap-0.5 shrink-0">
              {[0, 1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="w-1 bg-amber-500 rounded-full"
                  animate={{ height: [4, 12, 6, 14, 4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
            <span className="text-amber-400 text-xs font-semibold shrink-0">
              {getRoleDisplay(aiRole).toUpperCase()}:
            </span>
            <span className="text-slate-300 text-sm leading-snug line-clamp-2 min-w-0">
              {messages.filter(m => m.role === "assistant").at(-1)?.content?.slice(0, 200) || "Speaking..."}
            </span>
          </div>
        ) : simulationMutation.isPending ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 size={14} className="animate-spin text-amber-500" />
            <span className="text-xs text-slate-500">
              {aiRole ? `${getRoleDisplay(aiRole)} is thinking...` : "Courtroom is thinking..."}
            </span>
          </div>
        ) : (isListening || interimTranscript) ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-slate-400 text-xs font-semibold mr-1 shrink-0">YOU:</span>
            <span className="text-white text-sm italic leading-snug min-w-0 truncate">
              {interimTranscript || currentInput || "Listening..."}
            </span>
          </div>
        ) : (
          <span className="text-slate-600 text-xs">
            🎙 Listening... speak into your microphone
          </span>
        )}
      </div>

      {/* ════════ Main content area — messages + side panels ════════ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1 min-w-0">
          <div className="p-4 space-y-4">
            <AnimatePresence>
              {messages.map(message => (
                <TranscriptMessage key={message.id} message={message} aiRole={message.aiRole || aiRole} />
              ))}
            </AnimatePresence>

            {simulationMutation.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                  <Scale className="h-4 w-4 text-slate-300" />
                </div>
                <div className="bg-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-600/30">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-slate-400 rounded-full"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* ════════ Right Side Panel — Coaching + Teleprompter ════════ */}
        <AnimatePresence>
          {showCoachingPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 border-l border-slate-700/50 bg-slate-900/80 overflow-hidden flex flex-col"
            >
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {/* Teleprompter Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ScrollText className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          Say This
                        </span>
                      </div>
                      <button
                        onClick={() => setShowTeleprompter(!showTeleprompter)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        {showTeleprompter ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                    {showTeleprompter && (
                      <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-2.5">
                        {teleprompterText ? (
                          <p className="text-white text-sm leading-relaxed font-medium">
                            "{teleprompterText}"
                          </p>
                        ) : (
                          <p className="text-slate-500 text-xs italic">
                            {exchangeCount === 0
                              ? "Speak your opening statement or question. The teleprompter will suggest your next move after each exchange."
                              : "Waiting for AI to suggest your next statement..."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Legal Error Alert */}
                  <AnimatePresence>
                    {legalError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-950/50 border border-red-700/30 rounded-lg p-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-red-400 text-[10px] font-bold uppercase block">Legal Error</span>
                            <p className="text-red-300 text-xs leading-relaxed mt-0.5">{legalError}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Encouragement */}
                  <AnimatePresence>
                    {encouragement && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-950/40 border border-emerald-700/30 rounded-lg p-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <Star className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <p className="text-emerald-300 text-xs leading-relaxed">{encouragement}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Current Coaching */}
                  {coaching && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                          Coach
                        </span>
                      </div>
                      <div className="bg-purple-950/30 border border-purple-700/30 rounded-lg p-2.5">
                        <p className="text-purple-200/80 text-xs leading-relaxed whitespace-pre-wrap">{coaching}</p>
                      </div>
                    </div>
                  )}

                  {/* Performance Hints */}
                  {performanceHints.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Target className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">Tips</span>
                      </div>
                      {performanceHints.map((hint, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-amber-300/80">
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{hint}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Trial Assistant Panel */}
                  {assistantPanel && showAssistant && (
                    <div className="space-y-2 border-t border-slate-700/50 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Lightbulb className="h-3 w-3 text-amber-400" />
                          Trial Assistant
                        </span>
                        <button
                          onClick={() => setShowAssistant(false)}
                          className="text-slate-500 hover:text-slate-300 text-xs"
                        >
                          ×
                        </button>
                      </div>

                      {/* Objection Alert */}
                      {(() => {
                        const obj = assistantPanel.objectionAlert as Record<string, unknown> | undefined;
                        if (obj?.isObjectionable) {
                          return (
                            <div className="flex items-start gap-2 p-2 bg-red-950/50 rounded border border-red-700/30">
                              <span className="text-red-400 font-bold text-xs shrink-0">OBJ</span>
                              <div className="text-xs">
                                <span className="text-red-300 font-medium">{obj.objectionType as string}</span>
                                {obj.grounds && <span className="text-red-400/80"> — {obj.grounds as string}</span>}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Evasion / Trap Alert */}
                      {(() => {
                        const ans = assistantPanel.answerAnalysis as Record<string, unknown> | undefined;
                        if (ans?.isEvasive || ans?.trapAlert) {
                          return (
                            <div className="flex items-start gap-2 p-2 bg-amber-950/50 rounded border border-amber-700/30">
                              <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-amber-300">{(ans.trapAlert || ans.evasionTactic) as string}</p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Evidence Reference */}
                      {(() => {
                        const evRef = assistantPanel.evidenceReference as Record<string, unknown> | undefined;
                        if (evRef?.relevantDoc) {
                          return (
                            <div className="flex items-start gap-2 p-2 bg-blue-950/50 rounded border border-blue-700/30">
                              <span className="text-blue-400 text-xs font-bold shrink-0">DOC</span>
                              <div className="text-xs">
                                <span className="text-blue-300 font-medium">{evRef.relevantDoc as string}</span>
                                {evRef.howToUse && <p className="text-blue-400/80 mt-0.5">{evRef.howToUse as string}</p>}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Suggested Follow-ups */}
                      {Array.isArray(assistantPanel.suggestedFollowUps) && (assistantPanel.suggestedFollowUps as string[]).length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Ask next:</p>
                          <div className="space-y-1">
                            {(assistantPanel.suggestedFollowUps as string[]).slice(0, 3).map((q, i) => (
                              <button
                                key={i}
                                onClick={() => setCurrentInput(q)}
                                className="w-full text-left text-xs p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Coaching Note */}
                      {assistantPanel.coachingNote && (
                        <p className="text-xs text-slate-400 italic border-t border-slate-700/50 pt-2">
                          {assistantPanel.coachingNote as string}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Coaching History */}
                  {coachingHistory.length > 0 && (
                    <div className="space-y-2 border-t border-slate-700/50 pt-3">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        Previous Coaching ({coachingHistory.length})
                      </span>
                      {coachingHistory.slice(0, 8).map(entry => (
                        <div
                          key={entry.id}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-xs",
                            entry.type === "warning" ? "border-red-500/30 bg-red-500/5" :
                            entry.type === "success" ? "border-emerald-500/30 bg-emerald-500/5" :
                            "border-amber-500/30 bg-amber-500/5"
                          )}
                        >
                          <div className="flex items-start gap-1.5">
                            {entry.type === "warning" ? (
                              <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                            ) : entry.type === "success" ? (
                              <Star className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <Lightbulb className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                            )}
                            <p className="text-slate-300 leading-relaxed">{entry.text}</p>
                          </div>
                          <span className="text-[9px] text-slate-600 mt-1 block">
                            {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Objection Quick Bar (for objections-practice mode) */}
      {isObjectionMode && (
        <div className="border-t border-slate-700/50 bg-slate-800/60 px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Hand className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex-shrink-0">
              Objections:
            </span>
            {OBJECTION_QUICK_BUTTONS.map(type => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                onClick={() => handleObjection(type)}
                disabled={simulationMutation.isPending}
                className="h-6 text-[10px] px-2 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200 flex-shrink-0"
              >
                {type}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSendMessage("No objection.")}
              disabled={simulationMutation.isPending}
              className="h-6 text-[10px] px-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 flex-shrink-0"
            >
              Allow
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-slate-700/50 bg-slate-800/80 backdrop-blur-sm p-3">
        {!speechSupported && (
          <Alert className="mb-3 bg-amber-950/40 border-amber-500/40 text-amber-200">
            <AlertDescription className="text-xs">
              Voice input is unavailable in this browser. Use the latest Chrome or Edge and ensure microphone permission is enabled.
            </AlertDescription>
          </Alert>
        )}

        {/* Voice indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between mb-2 px-2"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-3 h-3 bg-red-500 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-xs text-red-400 font-medium">Listening...</span>
                <AudioVisualizer level={audioLevel} isActive={isListening} />
              </div>
              {interimTranscript && (
                <span className="text-xs text-slate-400 italic truncate max-w-[200px]">
                  {interimTranscript}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          {/* Mic button */}
          {speechSupported && voiceMode !== "off" && (
            <Button
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              onClick={handleVoiceToggle}
              disabled={simulationMutation.isPending}
              className={cn(
                "h-10 w-10 flex-shrink-0 rounded-full",
                isListening
                  ? "bg-red-500 hover:bg-red-600 border-red-500"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          {/* Text input */}
          <Textarea
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              isListening
                ? "Listening... speak now or type here"
                : "Speak or type your response..."
            }
            className="min-h-[40px] max-h-[100px] resize-none bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 rounded-xl text-sm"
            disabled={simulationMutation.isPending}
          />

          {/* Send button */}
          <Button
            size="icon"
            onClick={() => handleSendMessage()}
            disabled={!currentInput.trim() || simulationMutation.isPending}
            className="h-10 w-10 flex-shrink-0 rounded-full bg-accent hover:bg-accent/90"
          >
            {simulationMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
