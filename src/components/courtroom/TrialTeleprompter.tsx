import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, RotateCcw, ChevronUp, ChevronDown,
  Mic, MicOff, Maximize2, Minimize2, Settings2,
  Lightbulb, FileText, AlertTriangle, CheckCircle,
  Volume2, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface CoachingTip {
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

interface TeleprompterScript {
  title: string;
  lines: string[];
}

interface TrialTeleprompterProps {
  /** Lines to display on the teleprompter (e.g. deposition questions, opening statement) */
  script?: TeleprompterScript;
  /** Live captions from the simulation */
  captions: CaptionEntry[];
  /** Real-time coaching tips from the AI */
  coachingTips: CoachingTip[];
  /** Whether speech recognition is currently active */
  isListening: boolean;
  /** Whether the AI is currently speaking */
  aiSpeaking: boolean;
  /** Toggle speech recognition */
  onToggleMic: () => void;
  /** Called when teleprompter is dismissed */
  onClose?: () => void;
  /** Current simulation mode label */
  modeLabel?: string;
}

// ── Teleprompter scroll hook ─────────────────────────────────────────────────

function useTeleprompter(lines: string[], autoScroll: boolean, speed: number) {
  const [currentLine, setCurrentLine] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const start = useCallback(() => {
    if (currentLine >= lines.length - 1) return;
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentLine(prev => {
        if (prev >= lines.length - 1) {
          stop();
          return prev;
        }
        return prev + 1;
      });
    }, Math.max(1000, 8000 - speed * 70)); // speed 1-100 → 7000ms–1000ms
  }, [currentLine, lines.length, speed, stop]);

  const reset = useCallback(() => {
    stop();
    setCurrentLine(0);
  }, [stop]);

  const advance = useCallback(() => setCurrentLine(p => Math.min(p + 1, lines.length - 1)), [lines.length]);
  const retreat = useCallback(() => setCurrentLine(p => Math.max(p - 1, 0)), []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { currentLine, isPlaying, start, stop, reset, advance, retreat };
}

// ── Caption entry component ──────────────────────────────────────────────────

function CaptionBubble({ entry }: { entry: CaptionEntry }) {
  const isYou = entry.speaker === "you";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: entry.interim ? 0.6 : 1, y: 0 }}
      className={cn("flex gap-2", isYou ? "justify-end" : "justify-start")}
    >
      {!isYou && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-400 mt-1">
          AI
        </div>
      )}
      <div className={cn(
        "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
        isYou
          ? "bg-blue-600 text-white rounded-tr-sm"
          : "bg-slate-700/80 text-slate-100 rounded-tl-sm border border-slate-600/30",
        entry.interim && "italic opacity-70"
      )}>
        {entry.text}
        {entry.interim && <span className="ml-1 animate-pulse">▋</span>}
      </div>
      {isYou && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-300 mt-1">
          You
        </div>
      )}
    </motion.div>
  );
}

// ── Coaching tip component ───────────────────────────────────────────────────

function CoachingCard({ tip }: { tip: CoachingTip }) {
  const icons = {
    suggestion: <Lightbulb className="h-3.5 w-3.5 text-amber-400" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
    success: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
  };
  const colors = {
    suggestion: "border-amber-500/30 bg-amber-500/5",
    warning: "border-red-500/30 bg-red-500/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={cn("flex gap-2 rounded-lg border px-3 py-2 text-xs", colors[tip.type])}
    >
      <span className="flex-shrink-0 mt-0.5">{icons[tip.type]}</span>
      <p className="text-slate-200 leading-relaxed">{tip.text}</p>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TrialTeleprompter({
  script,
  captions,
  coachingTips,
  isListening,
  aiSpeaking,
  onToggleMic,
  onClose,
  modeLabel = "Trial Simulation",
}: TrialTeleprompterProps) {
  const [speed, setSpeed] = useState(40);
  const [autoScroll, setAutoScroll] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showScript, setShowScript] = useState(!!script);
  const [showCoaching, setShowCoaching] = useState(true);
  const captionsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = script?.lines ?? [];
  const { currentLine, isPlaying, start, stop, reset, advance, retreat } =
    useTeleprompter(lines, autoScroll, speed);

  // Auto-scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [captions]);

  // Fullscreen support
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-slate-900 text-white rounded-xl overflow-hidden border border-slate-700/50",
        fullscreen ? "fixed inset-0 z-[100] rounded-none" : "h-full"
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px]">
            {modeLabel}
          </Badge>
          {aiSpeaking && (
            <motion.div
              className="flex items-center gap-1.5 text-xs text-emerald-400"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>AI Speaking</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {script && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowScript(s => !s)}
              className="h-7 px-2 text-xs text-slate-400 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {showScript ? "Hide Script" : "Show Script"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCoaching(s => !s)}
            className="h-7 px-2 text-xs text-slate-400 hover:text-white"
          >
            {showCoaching ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-7 w-7 text-slate-400 hover:text-white"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Teleprompter + Captions */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Teleprompter panel */}
          {showScript && lines.length > 0 && (
            <div className="bg-black/40 border-b border-slate-700/50 flex-shrink-0">
              {/* Script display */}
              <div className="relative px-8 py-6 min-h-[140px] flex flex-col items-center justify-center text-center overflow-hidden">
                {/* Previous line (faded) */}
                {currentLine > 0 && (
                  <p className="text-slate-500 text-sm mb-3 line-clamp-1">
                    {lines[currentLine - 1]}
                  </p>
                )}
                {/* Current line */}
                <motion.p
                  key={currentLine}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-white font-medium text-lg lg:text-xl leading-relaxed max-w-2xl"
                >
                  {lines[currentLine]}
                </motion.p>
                {/* Next line (faded) */}
                {currentLine < lines.length - 1 && (
                  <p className="text-slate-500 text-sm mt-3 line-clamp-1">
                    {lines[currentLine + 1]}
                  </p>
                )}
                {/* Progress */}
                <div className="absolute bottom-2 right-4 text-[10px] text-slate-600">
                  {currentLine + 1} / {lines.length}
                </div>
              </div>
              {/* Controls */}
              <div className="flex items-center justify-between px-4 pb-3 gap-3">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={retreat} className="h-7 w-7 text-slate-400 hover:text-white">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={advance} className="h-7 w-7 text-slate-400 hover:text-white">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={reset} className="h-7 w-7 text-slate-400 hover:text-white">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={isPlaying ? stop : start}
                    className="h-7 px-2 text-xs"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                    {isPlaying ? "Pause" : "Auto-scroll"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-32">
                  <Settings2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => setSpeed(v)}
                    min={10}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Live captions */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800/40 border-b border-slate-700/30 flex-shrink-0">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live Transcript</span>
              <div className="flex items-center gap-2">
                {isListening && (
                  <motion.div
                    className="flex items-center gap-1.5 text-xs text-red-400"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Recording
                  </motion.div>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {captions.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-600 text-sm">
                    <Mic className="h-6 w-6 mb-2 opacity-40" />
                    <p>Transcript will appear here as you speak</p>
                  </div>
                )}
                {captions.map(entry => (
                  <CaptionBubble key={entry.id} entry={entry} />
                ))}
                <div ref={captionsEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Mic control bar */}
          <div className="flex-shrink-0 border-t border-slate-700/50 bg-slate-800/60 px-4 py-3 flex items-center justify-center gap-4">
            <Button
              onClick={onToggleMic}
              variant={isListening ? "destructive" : "default"}
              className="gap-2 min-w-32"
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Stop Mic
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Start Mic
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Coaching panel */}
        <AnimatePresence>
          {showCoaching && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-l border-slate-700/50 bg-slate-800/30 flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-700/30 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-slate-200">AI Coach</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Real-time feedback on your performance</p>
              </div>
              <ScrollArea className="flex-1 px-3 py-3">
                <div className="space-y-2">
                  {coachingTips.length === 0 && (
                    <p className="text-xs text-slate-600 text-center mt-4">
                      Coaching tips will appear as you practice
                    </p>
                  )}
                  <AnimatePresence>
                    {[...coachingTips].reverse().map(tip => (
                      <CoachingCard key={tip.id} tip={tip} />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type { CaptionEntry, CoachingTip, TeleprompterScript };
