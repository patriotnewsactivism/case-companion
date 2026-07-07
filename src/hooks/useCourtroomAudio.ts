import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceType = 'judge' | 'witness' | 'opposing' | 'clerk' | 'narrator';

interface AudioConfig {
  voiceType: VoiceType;
  rate: number;
  pitch: number;
  volume: number;
}

interface UseCourtroomAudioOptions {
  enabled?: boolean;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

const VOICE_CONFIGS: Record<VoiceType, Omit<AudioConfig, 'voiceType'>> = {
  judge: {
    rate: 0.9,
    pitch: 0.8,
    volume: 1.0,
  },
  witness: {
    rate: 1.0,
    pitch: 1.0,
    volume: 0.9,
  },
  opposing: {
    rate: 1.05,
    pitch: 0.95,
    volume: 0.9,
  },
  clerk: {
    rate: 1.1,
    pitch: 1.1,
    volume: 0.8,
  },
  narrator: {
    rate: 0.95,
    pitch: 1.0,
    volume: 0.85,
  },
};

const OBJECTION_SOUNDS = {
  sustained: { frequency: 440, duration: 0.15, type: 'sine' as OscillatorType },
  overruled: { frequency: 220, duration: 0.2, type: 'triangle' as OscillatorType },
  gavel: { frequency: 150, duration: 0.1, type: 'square' as OscillatorType },
};

function getVoiceTypeFromRole(role: string): VoiceType {
  const lower = role.toLowerCase();
  if (lower.includes('judge')) return 'judge';
  if (lower.includes('witness') || lower.includes('deponent')) return 'witness';
  if (lower.includes('opposing') || lower.includes('counsel')) return 'opposing';
  if (lower.includes('clerk')) return 'clerk';
  return 'narrator';
}

export function useCourtroomAudio(options: UseCourtroomAudioOptions = {}) {
  const { enabled = true, onSpeakStart, onSpeakEnd } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(enabled);
  const [ambienceEnabled, setAmbienceEnabled] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambienceOscillatorRef = useRef<OscillatorNode | null>(null);
  const ambienceGainRef = useRef<GainNode | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((config: { frequency: number; duration: number; type: OscillatorType }) => {
    if (!audioEnabled) return;
    
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration);
    } catch (error) {
      console.error('Failed to play tone:', error);
    }
  }, [audioEnabled, getAudioContext]);

  const playGavel = useCallback(() => {
    playTone(OBJECTION_SOUNDS.gavel);
    setTimeout(() => playTone(OBJECTION_SOUNDS.gavel), 150);
    setTimeout(() => playTone(OBJECTION_SOUNDS.gavel), 300);
  }, [playTone]);

  const playObjectionSound = useCallback((sustained: boolean) => {
    if (sustained) {
      playTone(OBJECTION_SOUNDS.sustained);
    } else {
      playTone(OBJECTION_SOUNDS.overruled);
    }
  }, [playTone]);

  const startAmbience = useCallback(() => {
    if (ambienceOscillatorRef.current) return;
    
    try {
      const ctx = getAudioContext();
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(60, ctx.currentTime);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      
      ambienceOscillatorRef.current = oscillator;
      ambienceGainRef.current = gainNode;
    } catch (error) {
      console.error('Failed to start ambience:', error);
    }
  }, [getAudioContext]);

  const stopAmbience = useCallback(() => {
    if (ambienceOscillatorRef.current) {
      ambienceOscillatorRef.current.stop();
      ambienceOscillatorRef.current = null;
      ambienceGainRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (ambienceEnabled && audioEnabled) {
      startAmbience();
    } else {
      stopAmbience();
    }
    
    return () => stopAmbience();
  }, [ambienceEnabled, audioEnabled, startAmbience, stopAmbience]);

  const speak = useCallback((text: string, role?: string) => {
    if (!audioEnabled || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voiceType = role ? getVoiceTypeFromRole(role) : 'narrator';
    const config = VOICE_CONFIGS[voiceType];

    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;

    const voices = window.speechSynthesis.getVoices();
    
    const preferredVoices = voiceType === 'judge'
      ? voices.filter(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david'))
      : voiceType === 'witness'
        ? voices.filter(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha'))
        : voices;

    if (preferredVoices.length > 0) {
      utterance.voice = preferredVoices[0];
    } else if (voices.length > 0) {
      utterance.voice = voices[0];
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      onSpeakStart?.();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      onSpeakEnd?.();
      currentUtteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      if (event.error !== 'interrupted') {
        console.error('Speech error:', event.error);
      }
      setIsSpeaking(false);
      onSpeakEnd?.();
      currentUtteranceRef.current = null;
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [audioEnabled, onSpeakStart, onSpeakEnd]);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    currentUtteranceRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      stopAmbience();
    };
  }, [stop, stopAmbience]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, []);

  return {
    isSpeaking,
    audioEnabled,
    ambienceEnabled,
    setAudioEnabled,
    setAmbienceEnabled,
    speak,
    stop,
    playGavel,
    playObjectionSound,
    playTone,
  };
}
