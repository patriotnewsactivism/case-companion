import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel,
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
  Download,
  AlertTriangle,
} from "lucide-react";
import { useVoiceEngine, VoiceMode } from "@/hooks/useVoiceEngine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
}

interface VoiceCourtroomProps {
  caseId: string;
  caseName: string;
  mode: string;
  modeName: string;
  onEnd: () => void;
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
  const [sessionStartTime] = useState(new Date());
  const [exchangeCount, setExchangeCount] = useState(0);
  const [speechOutputEnabled, setSpeechOutputEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Refs for stable closures
  const messagesRef = useRef<Message[]>([]);
  const sendFnRef = useRef<(text: string) => void>(() => {});
  const speechOutputRef = useRef(true);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { speechOutputRef.current = speechOutputEnabled; }, [speechOutputEnabled]);

  // Voice engine — uses ref-based callback to avoid circular dependency
  const voice = useVoiceEngine({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setCurrentInput(text);
      }
    },
    onAutoSend: (text) => {
      if (text.trim()) {
        sendFnRef.current(text.trim());
      }
    },
    silenceTimeout: 2000,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial courtroom message
  useEffect(() => {
    const introMessage: Message = {
      id: "intro",
      role: "system",
      content: `${modeName} simulation started for "${caseName}". Speak or type to begin.`,
      timestamp: new Date(),
    };
    setMessages([introMessage]);
  }, [modeName, caseName]);

  // AI simulation mutation — uses messagesRef for fresh conversation history
  const simulationMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated. Please log in and try again.");

      // Use ref to get the current messages (avoids stale closure)
      const conversationMessages = messagesRef.current
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

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

      if (response.error) {
        const errorMsg = typeof response.error === "object" && response.error !== null
          ? (response.error as { message?: string }).message || JSON.stringify(response.error)
          : String(response.error);
        throw new Error(errorMsg);
      }
      return response.data as SimulationResponse;
    },
    onSuccess: (data) => {
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
      setIsSending(false);

      if (data.coaching) setCoaching(data.coaching);
      if (data.performanceHints?.length) setPerformanceHints(data.performanceHints);

      // Speak the response using ref for current speechOutput setting
      if (speechOutputRef.current) {
        voice.speak(data.message, data.role);
      }
    },
    onError: (error: Error) => {
      console.error("Simulation error:", error);
      setIsSending(false);
      toast.error(error.message || "Failed to get AI response. Check that the trial-simulation edge function is deployed.");
    },
  });

  // The main send function
  const doSend = useCallback((text: string) => {
    if (!text || simulationMutation.isPending) return;

    voice.stopListening();
    voice.stopSpeaking();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setCurrentInput("");
    setIsSending(true);
    simulationMutation.mutate(text);
  }, [simulationMutation, voice]);

  // Keep ref in sync so onAutoSend always has the latest function
  useEffect(() => { sendFnRef.current = doSend; }, [doSend]);

  const handleSendMessage = useCallback((text?: string) => {
    const messageText = text || currentInput.trim();
    if (messageText) doSend(messageText);
  }, [currentInput, doSend]);

  const handleObjection = (type: string) => {
    doSend(`Objection, Your Honor! ${type}.`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      voice.startListening();
    }
  };

  const cycleVoiceMode = () => {
    const modes: VoiceMode[] = ["push-to-talk", "hands-free", "off"];
    const currentIdx = modes.indexOf(voice.voiceMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    voice.setVoiceMode(nextMode);
    toast.info(`Voice mode: ${nextMode}`);
  };

  const handleEndSession = () => {
    voice.stopListening();
    voice.stopSpeaking();
    onEnd();
  };

  const exportTranscript = () => {
    const transcript = messages
      .map(m => {
        const role = m.role === "user" ? "ATTORNEY" : m.role === "system" ? "COURT" : (m.aiRole || "AI").toUpperCase();
        return `[${m.timestamp.toLocaleTimeString()}] ${role}: ${m.content}`;
      })
      .join("\n\n");

    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `courtroom-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported");
  };

  const isPending = simulationMutation.isPending || isSending;
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
              isSpeaking={voice.isSpeaking && judgeActive}
            />
            <CourtroomParticipant
              label="Witness"
              icon={<User className="h-4 w-4" />}
              isActive={witnessActive}
              isSpeaking={voice.isSpeaking && witnessActive}
            />
            <CourtroomParticipant
              label="Opp. Counsel"
              icon={<Scale className="h-4 w-4" />}
              isActive={opposingActive}
              isSpeaking={voice.isSpeaking && opposingActive}
            />
            <Separator orientation="vertical" className="h-12 bg-slate-700" />
            <CourtroomParticipant
              label="You"
              icon={<MessageCircle className="h-4 w-4" />}
              isActive={true}
              isSpeaking={voice.isListening}
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
                voice.voiceMode === "hands-free" ? "text-emerald-400" : "text-slate-400"
              )}
              title={`Voice mode: ${voice.voiceMode}`}
            >
              {voice.voiceMode === "hands-free" ? (
                <Radio className="h-3.5 w-3.5" />
              ) : voice.voiceMode === "push-to-talk" ? (
                <Mic className="h-3.5 w-3.5" />
              ) : (
                <MicOff className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {voice.voiceMode === "hands-free" ? "Hands-free" : voice.voiceMode === "push-to-talk" ? "Push-to-talk" : "Voice off"}
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
          {voice.isSpeaking && (
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

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <AnimatePresence>
            {messages.map(message => (
              <TranscriptMessage key={message.id} message={message} aiRole={message.aiRole || aiRole} />
            ))}
          </AnimatePresence>

          {isPending && (
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

      {/* Performance Hints */}
      <AnimatePresence>
        {performanceHints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-amber-500/20 bg-amber-950/30 px-4 py-2"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                {performanceHints.map((hint, i) => (
                  <p key={i} className="text-xs text-amber-300/90">{hint}</p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coaching Panel */}
      <AnimatePresence>
        {coaching && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-blue-500/20 bg-blue-950/30 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Coaching Tips</p>
                <p className="text-xs text-blue-200/80 whitespace-pre-wrap leading-relaxed">{coaching}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCoaching(null)}
                className="text-blue-400 hover:text-blue-300 ml-auto h-6 w-6 p-0"
              >
                &times;
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                disabled={isPending}
                className="h-6 text-[10px] px-2 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200 flex-shrink-0"
              >
                {type}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => doSend("No objection.")}
              disabled={isPending}
              className="h-6 text-[10px] px-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 flex-shrink-0"
            >
              Allow
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-slate-700/50 bg-slate-800/80 backdrop-blur-sm p-3">
        {/* Voice indicator */}
        <AnimatePresence>
          {voice.isListening && (
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
                <AudioVisualizer level={voice.audioLevel} isActive={voice.isListening} />
              </div>
              {voice.interimTranscript && (
                <span className="text-xs text-slate-400 italic truncate max-w-[200px]">
                  {voice.interimTranscript}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          {/* Mic button */}
          {voice.speechSupported && voice.voiceMode !== "off" && (
            <Button
              size="icon"
              variant={voice.isListening ? "destructive" : "outline"}
              onClick={handleVoiceToggle}
              disabled={isPending}
              className={cn(
                "h-10 w-10 flex-shrink-0 rounded-full",
                voice.isListening
                  ? "bg-red-500 hover:bg-red-600 border-red-500"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
            >
              {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          {/* Text input */}
          <Textarea
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              voice.isListening
                ? "Listening... speak now or type here"
                : "Speak or type your response..."
            }
            className="min-h-[40px] max-h-[100px] resize-none bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 rounded-xl text-sm"
            disabled={isPending}
          />

          {/* Send button */}
          <Button
            size="icon"
            onClick={() => handleSendMessage()}
            disabled={!currentInput.trim() || isPending}
            className="h-10 w-10 flex-shrink-0 rounded-full bg-accent hover:bg-accent/90"
          >
            {isPending ? (
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
