import { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: number;
}

export function VoiceMicButton({ onTranscript, className = "", size = 18 }: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  const toggle = () => {
    const SpeechRec = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
      || (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRec) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      onTranscript(e.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={listening ? "text-destructive animate-pulse" : ""}
    >
      {listening ? <MicOff size={size} /> : <Mic size={size} />}
    </Button>
  );
}
