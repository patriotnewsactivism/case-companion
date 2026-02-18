import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gavel,
  Mic,
  MicOff,
  Lightbulb,
  Loader2,
  Play,
  Square,
  Copy,
  MessageSquareQuote,
  ListChecks,
  AlertTriangle,
  Gauge,
  Clock3,
  WandSparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const simulationModes = [
  { value: "cross-examination", label: "Cross-Examination" },
  { value: "direct-examination", label: "Direct Examination" },
  { value: "opening-statement", label: "Opening Statement" },
  { value: "closing-argument", label: "Closing Argument" },
  { value: "deposition", label: "Deposition" },
  { value: "motion-hearing", label: "Motion Hearing" },
];

const modeQuestionBank: Record<string, string[]> = {
  "cross-examination": [
    "You previously said [fact]. Was that statement under oath?",
    "Isn't it true that your timeline changed between statements?",
    "What document supports that claim, specifically?",
    "You were present on [date], correct?",
    "There is no record corroborating that point, right?",
  ],
  "direct-examination": [
    "Please describe your role in this matter.",
    "What did you personally observe on the key date?",
    "Can you explain what happened next in chronological order?",
    "How did that event affect your decision-making?",
    "What records did you rely on at the time?",
  ],
  "opening-statement": [
    "Frame the dispute in one sentence.",
    "State your burden and the elements you will prove.",
    "Preview your strongest evidence with exact labels.",
    "Explain why the timeline matters to liability.",
    "Conclude with the precise verdict you seek.",
  ],
  "closing-argument": [
    "Tie each element of the claim to admitted evidence.",
    "Address credibility conflicts and resolve them explicitly.",
    "Highlight why opposing explanations fail.",
    "State the legal standard and show it is met.",
    "Ask for a specific, narrow ruling.",
  ],
  deposition: [
    "Please state your full name for the record.",
    "What preparation did you do before this deposition?",
    "Who did you speak with about this case beforehand?",
    "What documents did you review in preparation?",
    "Is there anything in your testimony you would like to clarify?",
  ],
  "motion-hearing": [
    "What rule governs the requested relief?",
    "What controlling authority is most directly on point?",
    "Where is the prejudice if relief is denied?",
    "What factual dispute, if any, remains material?",
    "What is the narrowest order the court can enter today?",
  ],
};

type TranscriptSource = "speech" | "manual";

interface TranscriptEntry {
  id: string;
  text: string;
  createdAt: string;
  source: TranscriptSource;
  confidence: number | null;
  latencyMs: number | null;
}

interface CoachPayload {
  witnessResponse: string;
  sayThisNext: string[];
  followUpQuestions: string[];
  objectionOpportunities: string[];
  weakPoints: string[];
  scorecard: {
    clarity: number;
    control: number;
    foundation: number;
    persuasion: number;
  };
  rationale: string;
}

type AnyRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  grammars?: {
    addFromString: (grammar: string, weight: number) => void;
  };
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => AnyRecognition;
  webkitSpeechRecognition?: new () => AnyRecognition;
  SpeechGrammarList?: new () => {
    addFromString: (grammar: string, weight: number) => void;
  };
  webkitSpeechGrammarList?: new () => {
    addFromString: (grammar: string, weight: number) => void;
  };
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toList = (value: unknown, maxItems = 6) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((entry, index, arr) => arr.indexOf(entry) === index)
    .slice(0, maxItems);
};

const toScore = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 65;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const modeLabelByValue = Object.fromEntries(simulationModes.map((mode) => [mode.value, mode.label]));

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getFallbackCoach = (mode: string): CoachPayload => ({
  witnessResponse:
    "The witness would likely answer cautiously here. Pin them to one fact and one source before moving on.",
  sayThisNext: [
    "Let's keep this precise. Please answer yes or no before any explanation.",
    "Identify the exact document and page supporting your statement.",
    "Walk the court through your timeline using specific dates only.",
  ],
  followUpQuestions: modeQuestionBank[mode] ?? modeQuestionBank["cross-examination"],
  objectionOpportunities: [
    "Non-responsive answer.",
    "Calls for speculation.",
    "Assumes facts not in evidence.",
  ],
  weakPoints: [
    "Your last statement did not tie to a specific exhibit.",
    "The question can be narrower to control witness narrative.",
  ],
  scorecard: {
    clarity: 72,
    control: 70,
    foundation: 68,
    persuasion: 71,
  },
  rationale:
    "Anchor each question to one fact, one date, or one exhibit. That structure increases credibility and control.",
});

const buildLocalCoach = (mode: string, lastUtterance: string): CoachPayload => {
  const fallback = getFallbackCoach(mode);
  const cleaned = lastUtterance.replace(/\s+/g, " ").trim();
  const excerpt = cleaned.length > 140 ? `${cleaned.slice(0, 140)}...` : cleaned;

  if (!excerpt) {
    return fallback;
  }

  const modeQuestions = modeQuestionBank[mode] ?? modeQuestionBank["cross-examination"];

  return {
    ...fallback,
    witnessResponse:
      "Expected response: the witness will either hedge or broaden. Re-ask with one fact and one date only.",
    sayThisNext: [
      `Lock this down: "${excerpt}". Is that your testimony under oath?`,
      "Identify the exact exhibit, page, and line that supports that answer.",
      "Please answer yes or no first, then explain if needed.",
    ],
    followUpQuestions: modeQuestions,
    rationale:
      "Local coaching mode is active. Keep questions short, fact-anchored, and tied to a specific exhibit or date.",
  };
};

export default function TrialPrep() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialCaseIdFromUrl = searchParams.get("caseId") || "";

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  useEffect(() => {
    if (!selectedCase && initialCaseIdFromUrl) {
      setSelectedCase(initialCaseIdFromUrl);
    }
  }, [initialCaseIdFromUrl, selectedCase]);

  const [isMicSupported, setIsMicSupported] = useState<boolean | null>(null);
  const [selectedCase, setSelectedCase] = useState<string>(initialCaseIdFromUrl);
  const [selectedMode, setSelectedMode] = useState<string>("cross-examination");
  const [isSimulating, setIsSimulating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [coach, setCoach] = useState<CoachPayload>(() => getFallbackCoach(selectedMode));
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [coachBackendStatus, setCoachBackendStatus] = useState<"ready" | "offline">("ready");
  const [coachLatencyMs, setCoachLatencyMs] = useState<number | null>(null);
  const [lastRecognitionLatencyMs, setLastRecognitionLatencyMs] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(Date.now());

  const recognitionRef = useRef<AnyRecognition | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const isSimulatingRef = useRef(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const coachAbortRef = useRef<AbortController | null>(null);
  const coachDebounceRef = useRef<number | null>(null);
  const askedQuestionsRef = useRef<string[]>([]);
  const coachOfflineToastShownRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  useEffect(() => {
    if (!isSimulating || !sessionStartedAt) return;
    const intervalId = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [isSimulating, sessionStartedAt]);

  const caseContextQuery = useQuery({
    queryKey: ["trial-prep-case-context", selectedCase],
    enabled: !!selectedCase,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, name, case_type, client_name, case_theory, key_issues, winning_factors, notes")
        .eq("id", selectedCase)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const legalTerms = useMemo(() => {
    const caseData = caseContextQuery.data;
    if (!caseData) return [];

    const baseTerms = [
      "objection",
      "hearsay",
      "foundation",
      "impeachment",
      "relevance",
      "testimony",
      "exhibit",
      "sustained",
      "overruled",
      "leading",
    ];

    const caseTerms = [
      caseData.case_type,
      caseData.client_name,
      ...(Array.isArray(caseData.key_issues) ? caseData.key_issues : []),
      ...(Array.isArray(caseData.winning_factors) ? caseData.winning_factors : []),
    ]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .flatMap((entry) => entry.split(/[,\n]/g))
      .map((entry) => entry.replace(/[^a-zA-Z0-9 ]/g, "").trim().toLowerCase())
      .filter((entry) => entry.length >= 3);

    return [...new Set([...baseTerms, ...caseTerms])].slice(0, 40);
  }, [caseContextQuery.data]);

  const pushTranscript = useCallback((entry: Omit<TranscriptEntry, "id" | "createdAt">) => {
    setTranscript((prev) => {
      const next: TranscriptEntry[] = [
        ...prev,
        {
          id: createId(),
          createdAt: new Date().toISOString(),
          ...entry,
        },
      ];
      return next.slice(-80);
    });
  }, []);

  const invokeCoach = useCallback(
    async (lastUtterance: string) => {
      if (!selectedCase) return;

      setCoach(buildLocalCoach(selectedMode, lastUtterance));
      coachAbortRef.current?.abort();
      const controller = new AbortController();
      coachAbortRef.current = controller;

      setIsCoachLoading(true);
      const startedAt = performance.now();

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) throw new Error("Not authenticated");

        const transcriptWindow = transcriptRef.current
          .slice(-18)
          .map((turn, index) => `${index + 1}. [${turn.source}] ${turn.text}`)
          .join("\n");

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trial-coach`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            caseId: selectedCase,
            mode: selectedMode,
            transcript: transcriptWindow,
            lastUtterance,
            askedQuestions: askedQuestionsRef.current.slice(-20),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Coach request failed: ${response.status}`);
        }

        const data = await response.json();
        const fallback = getFallbackCoach(selectedMode);
        const nextCoach: CoachPayload = {
          witnessResponse: String(data.witnessResponse || "").trim() || fallback.witnessResponse,
          sayThisNext: toList(data.sayThisNext, 6),
          followUpQuestions: toList(data.followUpQuestions, 8),
          objectionOpportunities: toList(data.objectionOpportunities, 5),
          weakPoints: toList(data.weakPoints, 4),
          scorecard: {
            clarity: toScore(data.scorecard?.clarity),
            control: toScore(data.scorecard?.control),
            foundation: toScore(data.scorecard?.foundation),
            persuasion: toScore(data.scorecard?.persuasion),
          },
          rationale: String(data.rationale || "").trim(),
        };

        setCoach({
          ...fallback,
          ...nextCoach,
          sayThisNext: nextCoach.sayThisNext.length > 0 ? nextCoach.sayThisNext : fallback.sayThisNext,
          followUpQuestions:
            nextCoach.followUpQuestions.length > 0
              ? nextCoach.followUpQuestions
              : fallback.followUpQuestions,
          objectionOpportunities:
            nextCoach.objectionOpportunities.length > 0
              ? nextCoach.objectionOpportunities
              : fallback.objectionOpportunities,
          weakPoints: nextCoach.weakPoints.length > 0 ? nextCoach.weakPoints : fallback.weakPoints,
          rationale: nextCoach.rationale || fallback.rationale,
        });

        askedQuestionsRef.current = [
          ...askedQuestionsRef.current,
          ...toList(data.followUpQuestions, 8),
        ].slice(-30);

        setCoachBackendStatus("ready");
        coachOfflineToastShownRef.current = false;
        setCoachLatencyMs(Math.round(performance.now() - startedAt));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Coach request failed:", error);
        setCoachBackendStatus("offline");
        setCoach((prev) => ({ ...buildLocalCoach(selectedMode, lastUtterance), ...prev }));
        if (!coachOfflineToastShownRef.current) {
          coachOfflineToastShownRef.current = true;
          toast({
            title: "Coach backend unavailable",
            description: "Running in local coaching mode. Deploy/restart edge functions to restore live AI responses.",
            variant: "destructive",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCoachLoading(false);
        }
      }
    },
    [selectedCase, selectedMode, toast]
  );

  const scheduleCoach = useCallback(
    (lastUtterance: string, immediate = false) => {
      if (!selectedCase) return;
      if (coachDebounceRef.current) {
        window.clearTimeout(coachDebounceRef.current);
      }
      coachDebounceRef.current = window.setTimeout(() => invokeCoach(lastUtterance), immediate ? 100 : 550);
    },
    [invokeCoach, selectedCase]
  );

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setRecognitionError("Speech recognition is unavailable in this browser.");
      return;
    }

    setRecognitionError(null);
    shouldKeepListeningRef.current = true;

    try {
      recognition.start();
      setIsListening(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start microphone recognition.";
      setRecognitionError(message);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        console.warn("Error stopping recognition:", error);
      }
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const RecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setIsMicSupported(false);
      return;
    }

    setIsMicSupported(true);
    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onspeechstart = () => {
      speechStartedAtRef.current = performance.now();
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      const finalized: Array<{ text: string; confidence: number | null }> = [];

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = String(result?.[0]?.transcript || "").trim();
        if (!text) continue;

        if (result.isFinal) {
          finalized.push({
            text,
            confidence: Number.isFinite(result?.[0]?.confidence) ? Number(result[0].confidence) : null,
          });
        } else {
          interim = `${interim} ${text}`.trim();
        }
      }

      setInterimText(interim);

      finalized.forEach((entry) => {
        const latency =
          speechStartedAtRef.current !== null
            ? Math.max(0, Math.round(performance.now() - speechStartedAtRef.current))
            : null;

        pushTranscript({
          text: entry.text,
          confidence: entry.confidence,
          latencyMs: latency,
          source: "speech",
        });

        if (latency !== null) {
          setLastRecognitionLatencyMs(latency);
        }

        scheduleCoach(entry.text);
      });
    };

    recognition.onerror = (event: any) => {
      const error = String(event?.error || "unknown");
      if (error === "no-speech") return;

      const message =
        error === "not-allowed"
          ? "Microphone access was denied. Allow mic access to enable live coaching."
          : `Speech recognition error: ${error}`;

      setRecognitionError(message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");

      if (isSimulatingRef.current && shouldKeepListeningRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch (error) {
            console.warn("Auto-restart recognition failed:", error);
          }
        }, 180);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onspeechstart = null;
      try {
        recognition.stop();
      } catch (error) {
        console.warn("Recognition cleanup warning:", error);
      }
      recognitionRef.current = null;
    };
  }, [pushTranscript, scheduleCoach]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition || legalTerms.length === 0) return;

    const speechWindow = window as SpeechWindow;
    const GrammarCtor = speechWindow.SpeechGrammarList || speechWindow.webkitSpeechGrammarList;
    if (!GrammarCtor) return;

    try {
      const grammarList = new GrammarCtor();
      const jsgfTerms = legalTerms
        .map((term) => term.replace(/[^a-zA-Z0-9 ]/g, "").trim())
        .filter(Boolean)
        .join(" | ");

      if (jsgfTerms.length > 0) {
        grammarList.addFromString(`#JSGF V1.0; grammar legalTerms; public <term> = ${jsgfTerms} ;`, 1);
        recognition.grammars = grammarList;
      }
    } catch (error) {
      console.warn("Could not apply recognition grammar hints:", error);
    }
  }, [legalTerms]);

  useEffect(() => {
    setCoach(getFallbackCoach(selectedMode));
  }, [selectedMode]);

  useEffect(() => {
    return () => {
      if (coachDebounceRef.current) {
        window.clearTimeout(coachDebounceRef.current);
      }
      coachAbortRef.current?.abort();
    };
  }, []);

  const handleStartSimulation = () => {
    if (!selectedCase) {
      toast({
        title: "Select a case first",
        description: "Choose a case to activate case-aware courtroom guidance.",
        variant: "destructive",
      });
      return;
    }

    setTranscript([]);
    setInterimText("");
    setManualInput("");
    setRecognitionError(null);
    setLastRecognitionLatencyMs(null);
    setCoachLatencyMs(null);
    askedQuestionsRef.current = [];
    setSessionStartedAt(Date.now());
    setClockTick(Date.now());
    setIsSimulating(true);

    if (isMicSupported) {
      startListening();
    }

    scheduleCoach(`Start a ${modeLabelByValue[selectedMode] || selectedMode} simulation.`, true);
  };

  const handleStopSimulation = () => {
    setIsSimulating(false);
    stopListening();
    coachAbortRef.current?.abort();
    setIsCoachLoading(false);
    if (coachDebounceRef.current) {
      window.clearTimeout(coachDebounceRef.current);
    }
  };

  const handleManualSubmit = () => {
    const text = manualInput.trim();
    if (!text) return;

    pushTranscript({
      text,
      confidence: null,
      latencyMs: null,
      source: "manual",
    });
    setManualInput("");
    scheduleCoach(text, true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Text copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Clipboard write was blocked by the browser.",
        variant: "destructive",
      });
    }
  };

  const recognizedLatencies = useMemo(
    () => transcript.map((turn) => turn.latencyMs).filter((value): value is number => typeof value === "number"),
    [transcript]
  );

  const avgRecognitionLatency = useMemo(() => {
    if (recognizedLatencies.length === 0) return null;
    const total = recognizedLatencies.reduce((sum, value) => sum + value, 0);
    return Math.round(total / recognizedLatencies.length);
  }, [recognizedLatencies]);

  const wordsPerMinute = useMemo(() => {
    if (!sessionStartedAt || transcript.length === 0) return 0;
    const totalWords = transcript.reduce((sum, turn) => sum + turn.text.split(/\s+/).filter(Boolean).length, 0);
    const minutes = Math.max((clockTick - sessionStartedAt) / 60000, 0.1);
    return Math.round(totalWords / minutes);
  }, [clockTick, sessionStartedAt, transcript]);

  const sessionDurationLabel = useMemo(() => {
    if (!sessionStartedAt || !isSimulating) return "00:00";
    return formatDuration(clockTick - sessionStartedAt);
  }, [clockTick, isSimulating, sessionStartedAt]);

  const activeModeQuestions = useMemo(
    () => modeQuestionBank[selectedMode] ?? modeQuestionBank["cross-examination"],
    [selectedMode]
  );

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-8"
        >
          <motion.div variants={item}>
            <div className="flex items-center gap-3">
              <Gavel className="h-8 w-8 text-accent" />
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">Trial Preparation & Simulation</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-2">
              Real-time courtroom drill with low-latency voice capture, AI witness response simulation, and exact next-line guidance.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            <motion.div variants={item} className="lg:col-span-2 space-y-6">
              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedCase} onValueChange={setSelectedCase}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a case to practice" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : cases.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">No cases available</div>
                        ) : (
                          cases.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedMode} onValueChange={setSelectedMode}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {simulationModes.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1.5">
                      <Gauge className="h-3.5 w-3.5" />
                      Low Latency Voice Loop
                    </Badge>
                    <Badge variant="outline" className="gap-1.5">
                      <WandSparkles className="h-3.5 w-3.5" />
                      Case-Aware Guidance
                    </Badge>
                    <Badge variant="outline" className="gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      Session Timer + Pace
                    </Badge>
                  </div>
                  {caseContextQuery.data?.name && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Active case context: {caseContextQuery.data.name}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <div className="bg-slate-900 p-6 lg:p-8 min-h-[460px] text-slate-100 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold">Live Courtroom Transcript</h2>
                      <p className="text-sm text-slate-400">
                        {isSimulating
                          ? "Speak naturally. The coach will update in near-real time."
                          : "Select your case and start simulation to begin guided practice."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-600 text-slate-200">
                        {modeLabelByValue[selectedMode] || selectedMode}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-200">
                        {sessionDurationLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={isListening ? "border-emerald-500 text-emerald-300" : "border-slate-600 text-slate-300"}
                      >
                        {isListening ? "Mic Live" : "Mic Idle"}
                      </Badge>
                    </div>
                  </div>

                  <ScrollArea className="h-[220px] rounded-md border border-slate-700 bg-slate-950/60 p-3">
                    <div className="space-y-2">
                      {transcript.length === 0 && (
                        <p className="text-sm text-slate-500">
                          Transcript appears here. Use the mic or type a practice line below.
                        </p>
                      )}
                      {transcript.map((entry) => (
                        <div key={entry.id} className="rounded border border-slate-800 bg-slate-900/80 p-2.5">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="uppercase tracking-wide">{entry.source === "speech" ? "Voice" : "Manual"}</span>
                            <span>{new Date(entry.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-sm text-slate-100">{entry.text}</p>
                        </div>
                      ))}
                      {interimText && (
                        <div className="rounded border border-dashed border-amber-600/60 bg-amber-500/10 p-2.5 text-sm text-amber-200">
                          Interim: {interimText}
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Textarea
                      value={manualInput}
                      onChange={(event) => setManualInput(event.target.value)}
                      placeholder="Type a line you plan to say in court, then submit for immediate coaching..."
                      className="min-h-[72px] resize-none border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                    />
                    <Button
                      onClick={handleManualSubmit}
                      disabled={!isSimulating || !manualInput.trim()}
                      className="sm:h-full sm:px-6"
                    >
                      Submit Line
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isSimulating ? (
                      <Button size="lg" className="gap-2" onClick={handleStartSimulation} disabled={!selectedCase}>
                        <Play className="h-5 w-5" />
                        Start Simulation
                      </Button>
                    ) : (
                      <Button size="lg" variant="destructive" className="gap-2" onClick={handleStopSimulation}>
                        <Square className="h-5 w-5" />
                        Stop Simulation
                      </Button>
                    )}

                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 border-slate-600 text-slate-200 hover:bg-slate-800"
                      onClick={isListening ? stopListening : startListening}
                      disabled={!isSimulating || !isMicSupported}
                    >
                      {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      {isListening ? "Pause Mic" : "Resume Mic"}
                    </Button>
                  </div>

                  {isMicSupported === false && (
                    <p className="text-sm text-amber-300">
                      Browser speech recognition is unavailable here. Manual mode still supports full AI coaching.
                    </p>
                  )}
                  {recognitionError && <p className="text-sm text-red-300">{recognitionError}</p>}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={item} className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Say This Next
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {coachBackendStatus === "ready"
                      ? "Backend coach online."
                      : "Backend coach offline. Local coaching mode active."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {coach.sayThisNext.map((line, index) => (
                    <div key={`${line}-${index}`} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p>{line}</p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(line)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {isCoachLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Updating coaching...
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="h-5 w-5 text-blue-500" />
                    Question Flow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(coach.followUpQuestions.length > 0 ? coach.followUpQuestions : activeModeQuestions).map((question, index) => (
                    <div key={`${question}-${index}`} className="rounded-md border p-2.5 text-sm">
                      {question}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquareQuote className="h-5 w-5 text-emerald-500" />
                    Likely Response + Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>{coach.witnessResponse}</p>
                  <div className="space-y-1">
                    {coach.objectionOpportunities.map((entry, index) => (
                      <div key={`${entry}-${index}`} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                        <span>{entry}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>WPM: {wordsPerMinute}</p>
                    <p>Coach: {coachLatencyMs !== null ? `${coachLatencyMs} ms` : "N/A"}</p>
                    <p>Voice: {lastRecognitionLatencyMs !== null ? `${lastRecognitionLatencyMs} ms` : "N/A"}</p>
                    <p>Avg: {avgRecognitionLatency !== null ? `${avgRecognitionLatency} ms` : "N/A"}</p>
                  </div>
                  <p className="rounded bg-muted/50 p-2 text-xs">{coach.rationale}</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
