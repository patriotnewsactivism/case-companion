import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceMode = "push-to-talk" | "hands-free" | "off";

interface VoiceEngineOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onAutoSend?: (text: string) => void;
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
  judge: { pitch: 0.8, rate: 0.9, voiceKeywords: ["male", "daniel", "james", "david"] },
  witness: { pitch: 1.1, rate: 1.0, voiceKeywords: ["female", "samantha", "karen", "fiona"] },
  "opposing counsel": { pitch: 0.95, rate: 1.05, voiceKeywords: ["male", "alex", "tom", "fred"] },
  "court clerk": { pitch: 1.0, rate: 0.95, voiceKeywords: ["female", "victoria", "kate", "moira"] },
  "potential juror": { pitch: 1.05, rate: 1.0, voiceKeywords: ["female", "samantha", "tessa"] },
  deponent: { pitch: 1.0, rate: 0.95, voiceKeywords: ["male", "daniel", "tom"] },
  default: { pitch: 1.0, rate: 0.95, voiceKeywords: [] },
};

function findVoiceForRole(role: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const config = COURTROOM_VOICES[role.toLowerCase()] || COURTROOM_VOICES.default;
  const englishVoices = voices.filter(v => v.lang.startsWith("en"));

  // Try to find a matching voice by keyword
  for (const keyword of config.voiceKeywords) {
    const match = englishVoices.find(v => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }

  // Fallback to any English voice
  return englishVoices[0] || voices[0] || null;
}

export function useVoiceEngine(options: VoiceEngineOptions) {
  const { onTranscript, onAutoSend, silenceTimeout = 1800, lang = "en-US" } = options;

  const [state, setState] = useState<VoiceEngineState>({
    isListening: false,
    isSpeaking: false,
    voiceMode: "push-to-talk",
    interimTranscript: "",
    audioLevel: 0,
    speechSupported: false,
    ttsSupported: false,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Refs for stable closures — keeps recognition callbacks fresh
  const voiceModeRef = useRef<VoiceMode>(state.voiceMode);
  const onTranscriptRef = useRef(onTranscript);
  const onAutoSendRef = useRef(onAutoSend);
  const silenceTimeoutRef = useRef(silenceTimeout);

  useEffect(() => { voiceModeRef.current = state.voiceMode; }, [state.voiceMode]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onAutoSendRef.current = onAutoSend; }, [onAutoSend]);
  useEffect(() => { silenceTimeoutRef.current = silenceTimeout; }, [silenceTimeout]);

  // Check support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
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
    } catch (_e) {
      // Mic access denied — continue without audio visualization
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

  // Recognition factory — uses refs so callbacks always read fresh state
  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
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
        onTranscriptRef.current(trimmed, true);
        setState(prev => ({ ...prev, interimTranscript: "" }));

        // Reset silence timer for auto-send in hands-free mode
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        if (onAutoSendRef.current && voiceModeRef.current === "hands-free") {
          silenceTimerRef.current = setTimeout(() => {
            if (accumulatedRef.current.trim()) {
              onAutoSendRef.current?.(accumulatedRef.current.trim());
              accumulatedRef.current = "";
            }
          }, silenceTimeoutRef.current);
        }
      }

      if (interim) {
        setState(prev => ({ ...prev, interimTranscript: interim }));
        onTranscriptRef.current(accumulatedRef.current + " " + interim, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onend = () => {
      // Auto-restart in hands-free mode
      if (voiceModeRef.current === "hands-free" && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (_e) {
          setState(prev => ({ ...prev, isListening: false }));
        }
      } else {
        setState(prev => ({ ...prev, isListening: false }));
        // Auto-send accumulated text when stopping in push-to-talk
        if (accumulatedRef.current.trim() && onAutoSendRef.current) {
          onAutoSendRef.current(accumulatedRef.current.trim());
          accumulatedRef.current = "";
        }
      }
    };

    return recognition;
  }, [lang]); // Only depends on lang — everything else uses refs

  const startListening = useCallback(() => {
    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      setState(prev => ({ ...prev, isSpeaking: false }));
    }

    accumulatedRef.current = "";
    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setState(prev => ({ ...prev, isListening: true, interimTranscript: "" }));
      startAudioMonitoring();
    } catch (error) {
      console.error("Failed to start recognition:", error);
    }
  }, [initRecognition, startAudioMonitoring, state.isSpeaking]);

  const stopListening = useCallback(() => {
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

    // Cancel current speech
    window.speechSynthesis.cancel();

    const config = COURTROOM_VOICES[role.toLowerCase()] || COURTROOM_VOICES.default;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;
    utterance.volume = 0.9;

    const selectedVoice = findVoiceForRole(role);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onstart = () => setState(prev => ({ ...prev, isSpeaking: true }));
    utterance.onend = () => setState(prev => ({ ...prev, isSpeaking: false }));
    utterance.onerror = () => setState(prev => ({ ...prev, isSpeaking: false }));

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const setVoiceMode = useCallback((mode: VoiceMode) => {
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
