import { useState, useCallback, useRef } from "react";

interface AzureTTSOptions {
  apiKey: string;
  region: string;
}

const VOICE_MAPPING: Record<string, string> = {
  judge: "en-US-ChristopherNeural",
  witness: "en-US-JennyNeural",
  "opposing counsel": "en-US-GuyNeural",
  "court clerk": "en-US-SteffanNeural",
  deponent: "en-US-AriaNeural",
  default: "en-US-AndrewNeural"
};

export function useAzureTTS({ apiKey, region }: AzureTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, role: string = "default") => {
    if (!apiKey) return;
    
    stopSpeaking();
    setIsSpeaking(true);

    try {
      const voice = VOICE_MAPPING[role.toLowerCase()] || VOICE_MAPPING.default;
      const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      
      const ssml = `
        <speak version='1.0' xml:lang='en-US'>
          <voice xml:lang='en-US' xml:gender='Male' name='${voice}'>
            <prosody rate='0.95' pitch='-5%'>
              ${text}
            </prosody>
          </voice>
        </speak>
      `;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'CaseCompanion'
        },
        body: ssml
      });

      if (!response.ok) throw new Error(`Azure TTS failed: ${response.statusText}`);

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("Azure TTS Error:", error);
      setIsSpeaking(false);
    }
  }, [apiKey, region, stopSpeaking]);

  return {
    isSpeaking,
    speak,
    stopSpeaking
  };
}
