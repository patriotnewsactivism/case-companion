/**
 * VoiceEngine — Web Speech API wrapper for STT and TTS.
 * No external API keys required. Degrades gracefully when unsupported.
 */

export interface CharacterVoiceProfile {
  pitch: number;
  rate: number;
  preferredVoiceName: string;
}

export const CHARACTER_VOICES: Record<string, CharacterVoiceProfile> = {
  judge: { pitch: 0.85, rate: 0.9, preferredVoiceName: "Google US English" },
  witness: { pitch: 1.0, rate: 1.0, preferredVoiceName: "Google US English" },
  opposing_counsel: { pitch: 1.05, rate: 1.1, preferredVoiceName: "Google US English" },
  clerk: { pitch: 1.15, rate: 0.95, preferredVoiceName: "Google US English Female" },
};

// Legacy role names used by trial simulation UI
export type VoiceRole = "witness" | "judge" | "juror" | "default";

export interface VoiceEngineOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

function findBestVoice(preferredName: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Exact match
  const exact = voices.find(
    (v) => v.name.toLowerCase() === preferredName.toLowerCase()
  );
  if (exact) return exact;

  // Partial match
  const partial = voices.find((v) =>
    v.name.toLowerCase().includes(preferredName.toLowerCase())
  );
  if (partial) return partial;

  // Any English voice
  const english = voices.find((v) => v.lang.startsWith("en"));
  return english ?? voices[0] ?? null;
}

export class VoiceEngine {
  private recognition: any | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private options: VoiceEngineOptions;
  private _listening = false;
  private _speaking = false;
  private _supported: boolean;

  constructor(options: VoiceEngineOptions = {}) {
    this.options = options;

    if (typeof window === "undefined") {
      this._supported = false;
      return;
    }

    // SpeechSynthesis
    this.synthesis = window.speechSynthesis ?? null;

    // any (vendor-prefixed)
    const SRClass =
      (window as unknown as Record<string, unknown>)["any"] as
        | (new () => any)
        | undefined ??
      (window as unknown as Record<string, unknown>)["webkitany"] as
        | (new () => any)
        | undefined;

    if (SRClass) {
      this.recognition = new SRClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event: anyEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) {
          this.options.onTranscript?.(final.trim(), true);
        } else if (interim) {
          this.options.onTranscript?.(interim.trim(), false);
        }
      };

      this.recognition.onerror = (event: anyErrorEvent) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          this.options.onError?.(`Speech recognition error: ${event.error}`);
        }
        this._listening = false;
        this.options.onSpeechEnd?.();
      };

      this.recognition.onend = () => {
        this._listening = false;
        this.options.onSpeechEnd?.();
      };

      this.recognition.onstart = () => {
        this._listening = true;
        this.options.onSpeechStart?.();
      };
    } else {
      console.warn(
        "[VoiceEngine] any is not supported in this browser. " +
          "Voice input features will be unavailable."
      );
    }

    this._supported = !!(this.recognition || this.synthesis);
  }

  // ─── Static / instance support checks ──────────────────────────────────────

  static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return (
      "any" in window ||
      "webkitany" in window ||
      "speechSynthesis" in window
    );
  }

  isSupported(): boolean {
    return this._supported;
  }

  get isSTTSupported(): boolean {
    return this.recognition !== null;
  }

  get isTTSSupported(): boolean {
    return this.synthesis !== null;
  }

  get isListening(): boolean {
    return this._listening;
  }

  get isSpeaking(): boolean {
    return this._speaking;
  }

  // ─── Speech-to-Text ─────────────────────────────────────────────────────────

  /**
   * Start continuous speech recognition.
   * @param onInterim - called with interim (partial) transcription text
   * @param onFinal   - called with finalized transcription text
   */
  startListening(
    onInterim?: (text: string) => void,
    onFinal?: (text: string) => void
  ): void {
    if (!this.recognition) {
      const msg = "Speech recognition not supported in this browser.";
      console.warn("[VoiceEngine]", msg);
      this.options.onError?.(msg);
      return;
    }
    if (this._listening) return;

    // Wire callbacks if provided directly (overrides constructor options)
    if (onInterim || onFinal) {
      this.recognition.onresult = (event: anyEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (interim) onInterim?.(interim.trim());
        if (final) {
          onFinal?.(final.trim());
          this.options.onTranscript?.(final.trim(), true);
        }
      };
    }

    try {
      this.recognition.start();
    } catch {
      // Recognition may already be started — ignore
    }
  }

  stopListening(): void {
    if (!this.recognition || !this._listening) return;
    try {
      this.recognition.stop();
    } catch {
      // Ignore
    }
    this._listening = false;
  }

  // ─── Text-to-Speech ─────────────────────────────────────────────────────────

  /**
   * Speak text using a named character profile or legacy VoiceRole.
   * @param text      - text to speak
   * @param character - character name (e.g. 'judge', 'witness', 'opposing_counsel')
   *                    OR legacy VoiceRole ('judge', 'juror', 'default')
   * @param onEnd     - optional callback when speech finishes
   */
  speak(text: string, character: string = "default", onEnd?: () => void): void {
    if (!this.synthesis) {
      console.warn("[VoiceEngine] speechSynthesis is not available.");
      onEnd?.();
      return;
    }

    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.volume = 1.0;

    // Resolve profile — prefer CHARACTER_VOICES, fall back to legacy role map
    const profile = CHARACTER_VOICES[character];
    if (profile) {
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
    } else {
      // Legacy role defaults
      switch (character as VoiceRole) {
        case "judge":
          utterance.pitch = 0.8;
          utterance.rate = 0.85;
          break;
        case "juror":
          utterance.pitch = 1.0;
          utterance.rate = 0.95;
          break;
        default:
          utterance.pitch = 1.0;
          utterance.rate = 0.95;
      }
    }

    utterance.onstart = () => {
      this._speaking = true;
      this.options.onSpeechStart?.();
    };
    utterance.onend = () => {
      this._speaking = false;
      this.options.onSpeechEnd?.();
      onEnd?.();
    };
    utterance.onerror = () => {
      this._speaking = false;
      this.options.onSpeechEnd?.();
      onEnd?.();
    };

    const doSpeak = () => {
      if (profile) {
        const voice = findBestVoice(profile.preferredVoiceName);
        if (voice) utterance.voice = voice;
      }
      this.synthesis!.speak(utterance);
    };

    if (this.synthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      this.synthesis.onvoiceschanged = () => {
        doSpeak();
        if (this.synthesis) this.synthesis.onvoiceschanged = null;
      };
    }
  }

  stopSpeaking(): void {
    this.synthesis?.cancel();
    this._speaking = false;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
  }

  updateOptions(options: Partial<VoiceEngineOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// Singleton for app-wide use (can also instantiate per-component)
export const voiceEngine = new VoiceEngine();
