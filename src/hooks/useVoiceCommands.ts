import { useState, useCallback, useEffect, useRef } from 'react';

interface CommandHandler {
  pattern: RegExp;
  handler: (params: Record<string, string>) => void;
}

export interface VoiceCommand {
  command: string;
  params: Record<string, string>;
}

export interface UseVoiceCommandsReturn {
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
  transcript: string;
  error: Error | null;
  lastCommand: VoiceCommand | null;
  registerCommand: (pattern: string, handler: (params: Record<string, string>) => void) => void;
  unregisterCommand: (pattern: string) => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoiceCommands(): UseVoiceCommandsReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const commandsRef = useRef<CommandHandler[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const processCommand = useCallback((text: string) => {
    for (const { pattern, handler } of commandsRef.current) {
      const match = text.match(pattern);
      if (match) {
        const params: Record<string, string> = {};
        if (match.groups) {
          Object.assign(params, match.groups);
        } else if (match[1]) {
          params.query = match[1];
        }
        setLastCommand({ command: text, params });
        handler(params);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      setError(new Error('Speech recognition not supported in this browser'));
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        processCommand(finalTranscript.toLowerCase().trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        setError(new Error(`Speech recognition error: ${event.error}`));
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [processCommand]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError(new Error('Speech recognition not initialized'));
      return;
    }

    try {
      setError(null);
      recognitionRef.current.start();
    } catch (err) {
      if (err instanceof Error && err.message.includes('already started')) {
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to start speech recognition'));
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const registerCommand = useCallback((pattern: string, handler: (params: Record<string, string>) => void) => {
    const namedPattern = pattern.replace(/\{(\w+)\}/g, '(?<$1>.+?)');
    const regex = new RegExp(namedPattern, 'i');
    commandsRef.current.push({ pattern: regex, handler });
  }, []);

  const unregisterCommand = useCallback((pattern: string) => {
    const namedPattern = pattern.replace(/\{(\w+)\}/g, '(?<$1>.+?)');
    const regex = new RegExp(namedPattern, 'i');
    commandsRef.current = commandsRef.current.filter((cmd) => cmd.pattern.source !== regex.source);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    startListening,
    stopListening,
    isListening,
    transcript,
    error,
    lastCommand,
    registerCommand,
    unregisterCommand,
  };
}
