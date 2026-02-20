import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptEntry } from "@/lib/session-api";
import { Play, Pause, Download } from "lucide-react";

interface SessionPlayerProps {
  audioUrl: string;
  transcript?: TranscriptEntry[];
}

export function SessionPlayer({ audioUrl, transcript = [] }: SessionPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTranscriptIndex, setCurrentTranscriptIndex] = useState(-1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  useEffect(() => {
    if (!transcript.length || currentTime === 0) return;

    const timeInMs = currentTime * 1000;
    let newIndex = -1;

    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].timestamp <= timeInMs) {
        newIndex = i;
        break;
      }
    }

    setCurrentTranscriptIndex(newIndex);
  }, [currentTime, transcript]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  }, []);

  const handleRateChange = useCallback((rate: string) => {
    const audio = audioRef.current;
    const newRate = parseFloat(rate);
    setPlaybackRate(newRate);
    if (audio) {
      audio.playbackRate = newRate;
    }
  }, []);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const exportTranscript = useCallback(() => {
    if (!transcript.length) return;

    const text = transcript
      .map((entry) => {
        const time = formatTime(entry.timestamp / 1000);
        const role = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
        return `[${time}] ${role}: ${entry.content}`;
      })
      .join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcript]);

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          className="h-10 w-10"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[100px]">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <Select value={playbackRate.toString()} onValueChange={handleRateChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.5">0.5x</SelectItem>
            <SelectItem value="1">1x</SelectItem>
            <SelectItem value="1.5">1.5x</SelectItem>
            <SelectItem value="2">2x</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {transcript.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Transcript</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportTranscript}
              className="h-7 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
          <ScrollArea className="h-48 w-full rounded border bg-muted/30 p-3">
            <div className="space-y-3">
              {transcript.map((entry, idx) => {
                const time = formatTime(entry.timestamp / 1000);
                const isActive = idx === currentTranscriptIndex;
                const roleLabel = entry.role === "user" ? "You" : 
                                  entry.role === "assistant" ? "AI" : "System";

                return (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded transition-colors ${
                      isActive ? "bg-primary/10 border border-primary/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${
                        entry.role === "user" ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {roleLabel}
                      </span>
                      <span className="text-muted-foreground text-[10px]">{time}</span>
                    </div>
                    <p className="text-muted-foreground">{entry.content}</p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
