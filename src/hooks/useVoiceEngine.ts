import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceMode = "push-to-talk" | "hands-free" | "off";

interface VoiceEngineOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onAutoSend?: (text: string) => void;
  onError?: (message: string) => void;
  initialVoiceMode?: VoiceMode;
  silenceTimeout?: number; // ms before auto-sending in hands-free mode
  lang?: string;
}

interface VoiceEngineState {
  isListening: boolean;
  isSpeaking: boolean;
  voiceMode: VoiceMode;
  interimTranscript: string;
  audioLevel: number;
  speechSupported: boolean;
  ttsSupported: boolean;
}

const COURTROOM_VOICES: Record<string, { pitch: number; rate: number; voiceKeywords: string[] }> = {
  judge: { pitch: 0.85, rate: 0.92, voiceKeywords: ["guy", "davis", "james", "david", "daniel"] },
  witness: { pitch: 1.03, rate: 0.98, voiceKeywords: ["jenny", "aria", "samantha", "sara", "fiona"] },
  "opposing counsel": { pitch: 0.95, rate: 1.0, voiceKeywords: ["guy", "alex", "tom", "fred"] },
  "court clerk": { pitch: 1.0, rate: 0.96, voiceKeywords: ["jenny", "victoria", "kate", "moira"] },
  "potential juror": { pitch: 1.02, rate: 0.98, voiceKeywords: ["jenny", "samantha", "tessa"] },
  deponent: { pitch: 0.98, rate: 0.95, voiceKeywords: ["guy", "daniel", "tom"] },
  default: { pitch: 0.98, rate: 0.97, voiceKeywords: [] },
};

function findVoiceForRole(role: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const config = COURTROOM_VOICES[role.toLowerCase()] || COURTROOM_VOICES.default;
  const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith("en"));
  const candidateVoices = englishVoices.length ? englishVoices : voices;
  const naturalHints = [
    "neural",
    "natural",
    "premium",
    "enhanced",
    "wavenet",
    "aria",
    "jenny",
    "guy",
    "google us english",
    "samantha",
    "zira",
    "david",
  ];

  const scored = candidateVoices
    .map((voice) => {
      const name = voice.name.toLowerCase();
      const lang = voice.lang.toLowerCase();
      let score = 0;

      if (lang.startsWith("en-us")) score += 30;
      else if (lang.startsWith("en")) score += 20;

      if (!voice.localService) score += 10;
      if (voice.default) score += 6;

      if (naturalHints.some((hint) => name.includes(hint))) score += 20;
      if (config.voiceKeywords.some((hint) => name.includes(hint.toLowerCase()))) score += 16;

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice || null;
}

function normalizeSpeechText(text: string): string {
  return text
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSpeechChunks(text: string): string[] {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return [];

  const sentenceChunks =
    normalized.match(/[^.!?;:]+[.!?;:]?/g)?.map((chunk) => chunk.trim()).filter(Boolean) ?? [normalized];

  const chunks: string[] = [];
  for (const sentence of sentenceChunks) {
    if (sentence.length <= 220) {
      chunks.push(sentence);
      continue;
    }

    const clauses = sentence.split(/,\s+/).map((part) => part.trim()).filter(Boolean);
    if (!clauses.length) {
      chunks.push(sentence);
      continue;
    }

    let current = "";
    for (const clause of clauses) {
      if (!current) {
        current = clause;
        continue;
      }

      const candidate = `${current}, ${clause}`;
      if (candidate.length <= 220) {
        current = candidate;
      } else {
        chunks.push(current);
        current = clause;
      }
    }

    if (current) chunks.push(current);
  }

  return chunks.slice(0, 16);
}

export function useVoiceEngine(options: VoiceEngineOptions) {
  const {
    onTranscript,
    onAutoSend,
    onError,
    initialVoiceMode = "push-to-talk",
    silenceTimeout = 1800,
    lang = "en-US",
  } = options;

  const [state, setState] = useState<VoiceEngineState>({
    isListening: false,
    isSpeaking: false,
    voiceMode: initialVoiceMode,
    interimTranscript: "",
    audioLevel: 0,
    speechSupported: false,
    ttsSupported: false,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef<string>("");
  const interimRef = useRef<string>("");
  const voiceModeRef = useRef<VoiceMode>(initialVoiceMode);
  const restartRequestedRef = useRef<boolean>(false);
  const lastAutoSentRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    voiceModeRef.current = state.voiceMode;
  }, [state.voiceMode]);

  // Check support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setState(prev => ({
      ...prev,
      speechSupported: !!SpeechRecognitionAPI,
      ttsSupported: "speechSynthesis" in window,
    }));

    // Preload voices
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_e) { /* already stopped */ }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  // Audio level monitoring
  const startAudioMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const normalized = Math.min(average / 128, 1);
        setState(prev => ({ ...prev, audioLevel: normalized }));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Mic access denied - continue without audio visualization
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setState(prev => ({ ...prev, audioLevel: 0 }));
  }, []);

  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalText) {
        accumulatedRef.current += " " + finalText;
        const trimmed = accumulatedRef.current.trim();
        onTranscript(trimmed, true);
        interimRef.current = "";
        setState(prev => ({ ...prev, interimTranscript: "" }));

        // Reset silence timer for auto-send
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        if (onAutoSend && voiceModeRef.current === "hands-free") {
          silenceTimerRef.current = setTimeout(() => {
            const textToSend = accumulatedRef.current.trim();
            if (textToSend) {
              const now = Date.now();
              if (lastAutoSentRef.current.text !== textToSend || now - lastAutoSentRef.current.at > 1000) {
                onAutoSend(textToSend);
                lastAutoSentRef.current = { text: textToSend, at: now };
              }
              accumulatedRef.current = "";
              interimRef.current = "";
              setState(prev => ({ ...prev, interimTranscript: "" }));
            }
          }, silenceTimeout);
        }
      }

      if (interim) {
        interimRef.current = interim.trim();
        setState(prev => ({ ...prev, interimTranscript: interim }));
        onTranscript(accumulatedRef.current + " " + interim, false);

        // Some browsers never emit `isFinal`; this fallback promotes interim speech after silence.
        if (onAutoSend && voiceModeRef.current === "hands-free") {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            const combined = `${accumulatedRef.current} ${interimRef.current}`.trim();
            if (!combined) return;

            onTranscript(combined, true);
            const now = Date.now();
            if (lastAutoSentRef.current.text !== combined || now - lastAutoSentRef.current.at > 1000) {
              onAutoSend(combined);
              lastAutoSentRef.current = { text: combined, at: now };
            }
            accumulatedRef.current = "";
            interimRef.current = "";
            setState(prev => ({ ...prev, interimTranscript: "" }));
          }, silenceTimeout + 350);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
      let message = `Speech recognition error: ${event.error}`;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        message = "Microphone access denied. Allow mic permission in your browser and try again.";
      } else if (event.error === "audio-capture") {
        message = "No microphone detected. Check your audio input device and try again.";
      } else if (event.error === "network") {
        message = "Voice recognition network issue. Check your connection and try again.";
      }
      onError?.(message);
      restartRequestedRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      stopAudioMonitoring();
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onend = () => {
      const shouldRestart = voiceModeRef.current === "hands-free" && restartRequestedRef.current;

      // Auto-restart in hands-free mode if still requested by user.
      if (shouldRestart && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          restartRequestedRef.current = false;
          stopAudioMonitoring();
          setState(prev => ({ ...prev, isListening: false }));
        }
      } else {
        restartRequestedRef.current = false;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        stopAudioMonitoring();
        setState(prev => ({ ...prev, isListening: false }));

        const combinedText = `${accumulatedRef.current} ${interimRef.current}`.trim();

        // Finalize remaining interim text so user doesn't lose their last words.
        if (interimRef.current.trim()) {
          onTranscript(combinedText, true);
        }

        // Auto-send in active voice modes to reduce manual friction.
        if (combinedText && onAutoSend && voiceModeRef.current !== "off") {
          const now = Date.now();
          if (lastAutoSentRef.current.text !== combinedText || now - lastAutoSentRef.current.at > 1000) {
            onAutoSend(combinedText);
            lastAutoSentRef.current = { text: combinedText, at: now };
          }
        }

        if (combinedText) {
          accumulatedRef.current = "";
          interimRef.current = "";
        }
      }
    };

    return recognition;
  }, [lang, onTranscript, onAutoSend, onError, silenceTimeout, stopAudioMonitoring]);

  const startListening = useCallback(() => {
    if (state.isListening) return;

    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      setState(prev => ({ ...prev, isSpeaking: false }));
    }

    accumulatedRef.current = "";
    interimRef.current = "";
    restartRequestedRef.current = true;
    const recognition = initRecognition();
    if (!recognition) {
      onError?.("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setState(prev => ({ ...prev, isListening: true, interimTranscript: "" }));
      startAudioMonitoring();
    } catch (error) {
      restartRequestedRef.current = false;
      stopAudioMonitoring();
      console.error("Failed to start recognition:", error);
      onError?.("Unable to start microphone capture. Check mic permission and try again.");
    }
  }, [initRecognition, onError, startAudioMonitoring, state.isListening, state.isSpeaking, stopAudioMonitoring]);

  const stopListening = useCallback(() => {
    restartRequestedRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_e) { /* already stopped */ }
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    stopAudioMonitoring();
    setState(prev => ({ ...prev, isListening: false, interimTranscript: "" }));
  }, [stopAudioMonitoring]);

  const speak = useCallback((text: string, role: string = "default") => {
    if (!("speechSynthesis" in window)) return;

    const chunks = splitIntoSpeechChunks(text);
    if (!chunks.length) return;

    // Cancel current speech queue before speaking a new response.
    window.speechSynthesis.cancel();

    const config = COURTROOM_VOICES[role.toLowerCase()] || COURTROOM_VOICES.default;
    const selectedVoice = findVoiceForRole(role);
    let remaining = chunks.length;

    setState(prev => ({ ...prev, isSpeaking: true }));

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.pitch = Math.max(0.7, Math.min(1.3, config.pitch + (chunk.endsWith("?") ? 0.06 : 0)));
      utterance.rate = Math.max(0.85, Math.min(1.15, config.rate + (index % 2 === 0 ? 0.01 : -0.01)));
      utterance.volume = 0.95;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        remaining -= 1;
        if (remaining <= 0) {
          setState(prev => ({ ...prev, isSpeaking: false }));
        }
      };
      utterance.onerror = () => {
        remaining -= 1;
        if (remaining <= 0) {
          setState(prev => ({ ...prev, isSpeaking: false }));
        }
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const setVoiceMode = useCallback((mode: VoiceMode) => {
    voiceModeRef.current = mode;
    if (mode === "off") {
      stopListening();
      stopSpeaking();
    }
    setState(prev => ({ ...prev, voiceMode: mode }));
  }, [stopListening, stopSpeaking]);

  return {
    ...state,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setVoiceMode,
  };
}
