import { useState, useRef, useCallback, useEffect } from "react";

interface DeepgramOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  apiKey?: string;
}

export function useDeepgram({ onTranscript, onError, apiKey }: DeepgramOptions) {
  const [isListening, setIsListening] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    setConnectionStatus("disconnected");
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;

    const dgKey = apiKey || Deno.env.get("DEEPGRAM_API_KEY");
    if (!dgKey) {
      onError?.("Deepgram API key is missing.");
      return;
    }

    try {
      setConnectionStatus("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Deepgram WebSocket URL with parameters for low-latency, legal-friendly transcription
      const url = "wss://api.deepgram.com/v1/listen?model=nova-2-legal&smart_format=true&interim_results=true&endpointing=300";
      const socket = new WebSocket(url, ["token", dgKey]);

      socket.onopen = () => {
        setConnectionStatus("connected");
        setIsListening(true);
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunks every 250ms
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.channel?.alternatives?.[0]) {
          const transcript = data.channel.alternatives[0].transcript;
          const isFinal = data.is_final;
          if (transcript) {
            onTranscript(transcript, isFinal);
          }
        }
      };

      socket.onerror = (error) => {
        console.error("Deepgram WebSocket error:", error);
        onError?.("Voice recognition connection error.");
        stopListening();
      };

      socket.onclose = () => {
        setConnectionStatus("disconnected");
        setIsListening(false);
      };

      socketRef.current = socket;
    } catch (error) {
      console.error("Failed to start Deepgram:", error);
      onError?.("Microphone access denied or connection failed.");
      setConnectionStatus("disconnected");
    }
  }, [apiKey, isListening, onTranscript, onError, stopListening]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return {
    isListening,
    connectionStatus,
    startListening,
    stopListening,
  };
}
