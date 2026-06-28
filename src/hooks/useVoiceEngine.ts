/**
 * useVoiceEngine — production voice pipeline for CaseBuddy Voice Courtroom.
 *
 * STT: Deepgram Nova-3 via real-time WebSocket (ephemeral token from deepgram-token
 *      edge function). Falls back to Web Speech API if key unavailable.
 *
 * TTS: ElevenLabs (eleven_turbo_v2_5) via tts-generate edge function with
 *      per-character voice mapping. Falls back to browser speechSynthesis if
 *      key unavailable.
 *
 * Environment:
 *   DEEPGRAM_API_KEY   — set via `npx supabase secrets set DEEPGRAM_API_KEY=...`
 *   ELEVENLABS_API_KEY — set via `npx supabase secrets set ELEVENLABS_API_KEY=...`
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceMode = 'push-to-talk' | 'hands-free' | 'off';
export type VoiceProvider = 'deepgram' | 'webspeech';
export type TTSProvider = 'elevenlabs' | 'webspeech';

export interface VoiceEngineOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onAutoSend?: (text: string) => void;
  onError?: (message: string) => void;
  initialVoiceMode?: VoiceMode;
  /** ms of silence before auto-sending in hands-free mode */
  silenceTimeout?: number;
  lang?: string;
}

export interface VoiceEngineState {
  isListening: boolean;
  isSpeaking: boolean;
  voiceMode: VoiceMode;
  interimTranscript: string;
  audioLevel: number;
  sttProvider: VoiceProvider;
  ttsProvider: TTSProvider;
  deepgramReady: boolean;
  elevenLabsReady: boolean;
}

// ---------------------------------------------------------------------------
// Deepgram WebSocket URL builder
// ---------------------------------------------------------------------------

function buildDeepgramUrl(token: string): string {
  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'en-US',
    punctuate: 'true',
    smart_format: 'true',
    interim_results: 'true',
    endpointing: '400',   // ms of silence before marking utterance complete
    utterance_end_ms: '1000',
    token,
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Text cleanup for TTS
// ---------------------------------------------------------------------------

function sanitizeForTTS(text: string): string {
  return text
    .replace(/[*_`#>~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Courtroom voices for Web Speech API fallback
// ---------------------------------------------------------------------------

const WEB_SPEECH_VOICES: Record<string, { pitch: number; rate: number; keywords: string[] }> = {
  judge:             { pitch: 0.80, rate: 0.88, keywords: ['guy', 'david', 'daniel', 'james'] },
  witness:           { pitch: 1.05, rate: 0.98, keywords: ['jenny', 'aria', 'samantha', 'sara'] },
  'opposing counsel':{ pitch: 0.92, rate: 1.02, keywords: ['guy', 'alex', 'tom', 'fred'] },
  'court clerk':     { pitch: 1.00, rate: 0.95, keywords: ['jenny', 'victoria', 'kate'] },
  'potential juror': { pitch: 1.02, rate: 0.97, keywords: ['samantha', 'tessa', 'fiona'] },
  deponent:          { pitch: 0.97, rate: 0.95, keywords: ['daniel', 'tom', 'james'] },
  default:           { pitch: 0.97, rate: 0.95, keywords: [] },
};

function findWebSpeechVoice(character: string): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const cfg = WEB_SPEECH_VOICES[character.toLowerCase()] ?? WEB_SPEECH_VOICES.default;
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const pool = english.length ? english : voices;

  const QUALITY_HINTS = ['neural', 'natural', 'premium', 'enhanced', 'wavenet', 'google'];
  const scored = pool.map(v => {
    const name = v.name.toLowerCase();
    let score = 0;
    if (v.lang.toLowerCase().startsWith('en-us')) score += 30;
    else if (v.lang.toLowerCase().startsWith('en')) score += 20;
    if (!v.localService) score += 10;
    if (QUALITY_HINTS.some(h => name.includes(h))) score += 20;
    if (cfg.keywords.some(k => name.includes(k))) score += 16;
    return { v, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.v ?? null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceEngine(options: VoiceEngineOptions) {
  const {
    onTranscript,
    onAutoSend,
    onError,
    initialVoiceMode = 'push-to-talk',
    silenceTimeout = 1800,
    lang = 'en-US',
  } = options;

  const [state, setState] = useState<VoiceEngineState>({
    isListening: false,
    isSpeaking: false,
    voiceMode: initialVoiceMode,
    interimTranscript: '',
    audioLevel: 0,
    sttProvider: 'webspeech',
    ttsProvider: 'webspeech',
    deepgramReady: false,
    elevenLabsReady: false,
  });

  // ── STT refs ──────────────────────────────────────────────────────────────
  const deepgramWsRef       = useRef<WebSocket | null>(null);
  const deepgramTokenRef    = useRef<string | null>(null);
  const webSpeechRef        = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const streamRef           = useRef<MediaStream | null>(null);

  // ── TTS refs ──────────────────────────────────────────────────────────────
  const audioElRef          = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef         = useRef<AbortController | null>(null);

  // ── Shared refs ───────────────────────────────────────────────────────────
  const voiceModeRef        = useRef<VoiceMode>(initialVoiceMode);
  const accumulatedRef      = useRef<string>('');
  const interimRef          = useRef<string>('');
  const silenceTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSentRef     = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const audioContextRef     = useRef<AudioContext | null>(null);
  const analyserRef         = useRef<AnalyserNode | null>(null);
  const animFrameRef        = useRef<number>(0);
  const sttProviderRef      = useRef<VoiceProvider>('webspeech');

  // Keep voiceModeRef in sync
  useEffect(() => {
    voiceModeRef.current = state.voiceMode;
  }, [state.voiceMode]);

  // ── Provider detection & token fetch ────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function detectProviders() {
      // 1) Try to fetch a Deepgram ephemeral token — if this succeeds, Deepgram is available
      try {
        const { data, error } = await supabase.functions.invoke('deepgram-token', { body: {} });
        if (!error && (data as { key?: string })?.key) {
          deepgramTokenRef.current = (data as { key: string }).key;
          if (!cancelled) {
            sttProviderRef.current = 'deepgram';
            setState(prev => ({
              ...prev,
              sttProvider: 'deepgram',
              deepgramReady: true,
            }));
          }
        }
      } catch {
        // Deepgram not configured — use Web Speech API fallback
        console.info('[VoiceEngine] Deepgram unavailable, falling back to Web Speech API');
      }

      // 2) Check ElevenLabs availability (try a 0-char probe call just to see if the key works)
      try {
        const probe = await supabase.functions.invoke('tts-generate', {
          body: { text: 'test', character: 'default' },
        });
        // A non-auth-error response means the key exists
        if (!probe.error || (probe.error as { status?: number })?.status !== 401) {
          if (!cancelled) {
            setState(prev => ({ ...prev, ttsProvider: 'elevenlabs', elevenLabsReady: true }));
          }
        }
      } catch {
        console.info('[VoiceEngine] ElevenLabs unavailable, falling back to browser TTS');
      }
    }

    detectProviders();
    return () => { cancelled = true; };
    // Only run once on mount
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownSTT();
      teardownTTS();
      stopAudioMonitoring();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-send helper ─────────────────────────────────────────────────────

  const maybeTriggerAutoSend = useCallback((text: string) => {
    if (!text || !onAutoSend || voiceModeRef.current !== 'hands-free') return;
    const now = Date.now();
    if (lastAutoSentRef.current.text === text && now - lastAutoSentRef.current.at < 1000) return;
    onAutoSend(text);
    lastAutoSentRef.current = { text, at: now };
    accumulatedRef.current = '';
    interimRef.current = '';
    setState(prev => ({ ...prev, interimTranscript: '' }));
  }, [onAutoSend]);

  const armSilenceTimer = useCallback((text: string) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      maybeTriggerAutoSend(text);
    }, silenceTimeout);
  }, [silenceTimeout, maybeTriggerAutoSend]);

  // ── Audio level monitoring ───────────────────────────────────────────────

  const startAudioMonitoring = useCallback(async (existingStream?: MediaStream) => {
    try {
      const stream = existingStream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!existingStream) streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setState(prev => ({ ...prev, audioLevel: Math.min(avg / 128, 1) }));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic denied — silent failure; visualization just stays at 0
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setState(prev => ({ ...prev, audioLevel: 0 }));
  }, []);

  // ── STT teardown ─────────────────────────────────────────────────────────

  const teardownSTT = useCallback(() => {
    // Deepgram
    if (deepgramWsRef.current) {
      deepgramWsRef.current.onclose = null;
      deepgramWsRef.current.onerror = null;
      try { deepgramWsRef.current.close(1000, 'user_stop'); } catch { /* ignore */ }
      deepgramWsRef.current = null;
    }
    // MediaRecorder
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    // MediaStream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    // Web Speech
    if (webSpeechRef.current) {
      try { webSpeechRef.current.stop(); } catch { /* ignore */ }
      webSpeechRef.current = null;
    }
  }, []);

  // ── TTS teardown ─────────────────────────────────────────────────────────

  const teardownTTS = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  // ── STT — Deepgram WebSocket ─────────────────────────────────────────────

  const startDeepgramSTT = useCallback(async () => {
    // Refresh token if stale (shouldn't be needed in a single session, but defensive)
    let token = deepgramTokenRef.current;
    if (!token) {
      try {
        const { data } = await supabase.functions.invoke('deepgram-token', { body: {} });
        token = (data as { key: string }).key;
        deepgramTokenRef.current = token;
      } catch (err) {
        onError?.('Could not obtain Deepgram token. Check DEEPGRAM_API_KEY secret.');
        return false;
      }
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
    } catch (err) {
      onError?.('Microphone access denied. Enable mic permissions and try again.');
      return false;
    }

    const ws = new WebSocket(buildDeepgramUrl(token));
    ws.binaryType = 'arraybuffer';
    deepgramWsRef.current = ws;

    ws.onopen = () => {
      // Start streaming audio chunks to Deepgram
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };
      recorder.start(250); // 250ms chunks for low latency
      setState(prev => ({ ...prev, isListening: true, interimTranscript: '' }));
      startAudioMonitoring(stream);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          channel?: { alternatives?: Array<{ transcript?: string }> };
          is_final?: boolean;
          speech_final?: boolean;
        };

        if (msg.type !== 'Results') return;
        const transcript = msg.channel?.alternatives?.[0]?.transcript ?? '';
        if (!transcript) return;

        if (msg.is_final) {
          accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + transcript;
          const full = accumulatedRef.current.trim();
          onTranscript(full, true);
          interimRef.current = '';
          setState(prev => ({ ...prev, interimTranscript: '' }));

          if (msg.speech_final && voiceModeRef.current === 'hands-free') {
            armSilenceTimer(full);
          }
        } else {
          interimRef.current = transcript;
          setState(prev => ({ ...prev, interimTranscript: transcript }));
          onTranscript(accumulatedRef.current + ' ' + transcript, false);
        }
      } catch { /* malformed JSON from Deepgram — ignore */ }
    };

    ws.onerror = () => {
      onError?.('Deepgram WebSocket error. Check your connection and try again.');
      teardownSTT();
      stopAudioMonitoring();
      setState(prev => ({ ...prev, isListening: false }));
    };

    ws.onclose = (ev) => {
      // Code 1000 = normal close (user stopped), anything else is unexpected
      if (ev.code !== 1000) {
        console.warn(`[VoiceEngine] Deepgram WS closed unexpectedly: ${ev.code} ${ev.reason}`);
      }
      mediaRecorderRef.current?.stop();
      stopAudioMonitoring();
      setState(prev => ({ ...prev, isListening: false }));

      // Finalize any pending text
      const final = (accumulatedRef.current + ' ' + interimRef.current).trim();
      if (final) {
        onTranscript(final, true);
        if (onAutoSend && voiceModeRef.current !== 'off') {
          maybeTriggerAutoSend(final);
        }
      }
      accumulatedRef.current = '';
      interimRef.current = '';
    };

    return true;
  }, [onTranscript, onError, onAutoSend, armSilenceTimer, maybeTriggerAutoSend, startAudioMonitoring, stopAudioMonitoring, teardownSTT]);

  // ── STT — Web Speech API fallback ────────────────────────────────────────

  const startWebSpeechSTT = useCallback(() => {
    const SRClass = (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SRClass) {
      onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    const rec = new SRClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    webSpeechRef.current = rec;

    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (final) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + final;
        const full = accumulatedRef.current.trim();
        onTranscript(full, true);
        interimRef.current = '';
        setState(prev => ({ ...prev, interimTranscript: '' }));
        if (voiceModeRef.current === 'hands-free') armSilenceTimer(full);
      }
      if (interim) {
        interimRef.current = interim;
        setState(prev => ({ ...prev, interimTranscript: interim }));
        onTranscript(accumulatedRef.current + ' ' + interim, false);
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      const msgs: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Enable mic permissions and try again.',
        'service-not-allowed': 'Microphone access denied.',
        'audio-capture': 'No microphone detected.',
        'network': 'Voice recognition network error.',
      };
      onError?.(msgs[ev.error] ?? `Speech error: ${ev.error}`);
      setState(prev => ({ ...prev, isListening: false }));
    };

    rec.onend = () => {
      const final = (accumulatedRef.current + ' ' + interimRef.current).trim();
      if (interimRef.current.trim()) onTranscript(final, true);
      if (final && onAutoSend && voiceModeRef.current !== 'off') maybeTriggerAutoSend(final);
      accumulatedRef.current = '';
      interimRef.current = '';
      stopAudioMonitoring();
      setState(prev => ({ ...prev, isListening: false, interimTranscript: '' }));
    };

    try {
      rec.start();
      setState(prev => ({ ...prev, isListening: true, interimTranscript: '' }));
      startAudioMonitoring();
      return true;
    } catch {
      onError?.('Unable to start microphone. Check permissions and try again.');
      return false;
    }
  }, [lang, onTranscript, onError, onAutoSend, armSilenceTimer, maybeTriggerAutoSend, startAudioMonitoring, stopAudioMonitoring]);

  // ── Public STT controls ──────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (state.isListening) return;
    teardownTTS(); // Stop any ongoing speech
    accumulatedRef.current = '';
    interimRef.current = '';
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (sttProviderRef.current === 'deepgram' && deepgramTokenRef.current) {
      await startDeepgramSTT();
    } else {
      startWebSpeechSTT();
    }
  }, [state.isListening, teardownTTS, startDeepgramSTT, startWebSpeechSTT]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    teardownSTT();
    stopAudioMonitoring();
    setState(prev => ({ ...prev, isListening: false, interimTranscript: '' }));
  }, [teardownSTT, stopAudioMonitoring]);

  // ── TTS — ElevenLabs ─────────────────────────────────────────────────────

  const speakElevenLabs = useCallback(async (text: string, character: string) => {
    const cleanText = sanitizeForTTS(text);
    if (!cleanText) return;

    setState(prev => ({ ...prev, isSpeaking: true }));
    const abort = new AbortController();
    ttsAbortRef.current = abort;

    try {
      const { data: rawData, error } = await supabase.functions.invoke('tts-generate', {
        body: { text: cleanText, character },
      });

      if (abort.signal.aborted) return;

      if (error) {
        throw new Error((error as { message?: string }).message ?? 'TTS request failed');
      }

      // Guard against edge function returning a JSON error instead of binary audio
      if (!(rawData instanceof ArrayBuffer) && !(rawData instanceof Uint8Array)) {
        console.warn('[VoiceEngine] TTS response is not binary audio — falling back to browser TTS');
        throw new Error('TTS response is not valid audio data');
      }

      // Edge function returns an ArrayBuffer via the Supabase functions client
      const audioData = rawData instanceof ArrayBuffer
        ? rawData
        : rawData as Uint8Array;

      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioElRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState(prev => ({ ...prev, isSpeaking: false }));
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setState(prev => ({ ...prev, isSpeaking: false }));
        console.error('[VoiceEngine] ElevenLabs audio playback error');
      };

      await audio.play();
    } catch (err) {
      if (abort.signal.aborted) return;
      console.error('[VoiceEngine] ElevenLabs TTS error, falling back to browser TTS:', err);
      toast.error('Voice generation unavailable — using browser TTS');
      speakWebSpeech(sanitizeForTTS(text), character);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakWebSpeech = useCallback((text: string, character: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const cfg = WEB_SPEECH_VOICES[character.toLowerCase()] ?? WEB_SPEECH_VOICES.default;
    utterance.pitch = cfg.pitch;
    utterance.rate = cfg.rate;
    utterance.volume = 0.95;
    utterance.lang = 'en-US';

    const doSpeak = () => {
      const voice = findWebSpeechVoice(character);
      if (voice) utterance.voice = voice;
      setState(prev => ({ ...prev, isSpeaking: true }));
      utterance.onend = () => setState(prev => ({ ...prev, isSpeaking: false }));
      utterance.onerror = () => setState(prev => ({ ...prev, isSpeaking: false }));
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => { doSpeak(); window.speechSynthesis.onvoiceschanged = null; };
    }
  }, []);

  // ── Public TTS controls ──────────────────────────────────────────────────

  const speak = useCallback((text: string, character = 'default') => {
    teardownTTS();
    if (state.elevenLabsReady) {
      speakElevenLabs(text, character);
    } else {
      speakWebSpeech(sanitizeForTTS(text), character);
    }
  }, [state.elevenLabsReady, teardownTTS, speakElevenLabs, speakWebSpeech]);

  const stopSpeaking = useCallback(() => {
    teardownTTS();
  }, [teardownTTS]);

  // ── Voice mode ───────────────────────────────────────────────────────────

  const setVoiceMode = useCallback((mode: VoiceMode) => {
    voiceModeRef.current = mode;
    if (mode === 'off') {
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
