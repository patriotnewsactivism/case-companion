/**
 * Premium TTS Service - ElevenLabs integration for realistic courtroom voices
 */

export interface TTSCredentials {
  elevenlabs_api_key?: string;
  elevenlabs_voice_id?: string;
  azure_tts_key?: string;
  azure_tts_region?: string;
  azure_tts_voice?: string;
}

export interface VoiceProfile {
  name: string;
  description: string;
  elevenlabs_id?: string;
  azure_voice?: string;
  gender: 'male' | 'female';
  age: 'young' | 'middle' | 'senior';
  style: 'authoritative' | 'nervous' | 'confident' | 'neutral' | 'formal' | 'hesitant' | 'calm' | 'assertive';
  personality: string; // Detailed personality description for AI prompting
  pitch: number; // 0.5-2.0
  speed: number; // 0.5-2.0
  emphasis?: 'soft' | 'moderate' | 'strong'; // Speech emphasis style
}

export const COURTROOM_VOICES: Record<string, VoiceProfile> = {
  judge: {
    name: "Judge Harlan",
    description: "Authoritative, measured, experienced judge with gravitas",
    elevenlabs_id: "pNInz6obpgDQGcFmaJgB", // Adam (deep, authoritative)
    azure_voice: "en-US-AriaRUS",
    gender: 'male',
    age: 'senior',
    style: 'authoritative',
    personality: "A stern but fair jurist with 25 years on the bench. Speaks deliberately with judicial temperament, occasionally showing impatience with frivolous arguments. Uses formal, precise language and commands respect in the courtroom.",
    pitch: 0.8,
    speed: 0.85,
    emphasis: 'strong',
  },
  witness_hostile: {
    name: "Sarah Mitchell",
    description: "Evasive, defensive witness under cross-examination",
    elevenlabs_id: "EXAVITQu4vr4xnSDxMaL", // Bella (female, tense)
    azure_voice: "en-US-ZiraRUS",
    gender: 'female',
    age: 'middle',
    style: 'nervous',
    personality: "A reluctant witness who doesn't want to be here. Defensive and evasive, answers questions minimally, occasionally shows frustration or anxiety. Speaks quickly when nervous, pauses frequently, and uses phrases like 'I don't recall' or 'That's not how I remember it.'",
    pitch: 1.1,
    speed: 0.95,
    emphasis: 'moderate',
  },
  witness_cooperative: {
    name: "David Chen",
    description: "Helpful, forthcoming witness on direct examination",
    elevenlabs_id: "29vD33N1CtxCmqQRPOHJ", // Drew (calm, clear)
    azure_voice: "en-US-BenjaminRUS",
    gender: 'male',
    age: 'middle',
    style: 'calm',
    personality: "A cooperative professional witness who wants to be helpful. Speaks clearly and patiently, elaborates when asked, shows appropriate emotion. Uses transitional phrases like 'What happened next was...' or 'I remember clearly that...'. Professional but relatable tone.",
    pitch: 1.0,
    speed: 0.9,
    emphasis: 'moderate',
  },
  opposing_counsel: {
    name: "Marcus Reynolds",
    description: "Confident, aggressive opposing counsel",
    elevenlabs_id: "21m00Tcm4TlvDq8ikWAM", // Rachel (assertive female)
    azure_voice: "en-US-AriaRUS",
    gender: 'female',
    age: 'middle',
    style: 'assertive',
    personality: "A sharp, aggressive litigator who fights for every inch. Speaks with confidence and occasional sarcasm, interrupts when appropriate, uses rhetorical questions. Professional but combative tone, masters objections and legal arguments.",
    pitch: 1.0,
    speed: 0.95,
    emphasis: 'strong',
  },
  clerk: {
    name: "Emily Parker",
    description: "Efficient, procedural court clerk",
    elevenlabs_id: "AZnzlk1XvdvUeBnXmlld", // Domi (clear, professional)
    azure_voice: "en-US-HeddaRUS",
    gender: 'female',
    age: 'young',
    style: 'formal',
    personality: "A young, efficient court clerk who handles procedural matters. Speaks clearly and precisely, maintains courtroom decorum, announces proceedings formally. Professional, no-nonsense tone with just the right amount of helpfulness.",
    pitch: 1.05,
    speed: 1.0,
    emphasis: 'moderate',
  },
  juror: {
    name: "John Ramirez",
    description: "Regular person serving as juror",
    elevenlabs_id: "onwK4e9ZLuTAKqWW03F9", // Josh (everyman)
    azure_voice: "en-US-ZiraRUS",
    gender: 'male',
    age: 'middle',
    style: 'neutral',
    personality: "An ordinary person serving jury duty, slightly uncomfortable but trying to do the right thing. Speaks conversationally like a regular person, not a lawyer. Shows common sense reasoning, occasional confusion about legal terms, genuine reactions to testimony.",
    pitch: 0.95,
    speed: 0.9,
    emphasis: 'soft',
  },
};

export class PremiumTTSService {
  private credentials: TTSCredentials;
  private audioContext: AudioContext | null = null;

  constructor(credentials: TTSCredentials = {}) {
    this.credentials = credentials;
  }

  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      return true;
    } catch (error) {
      console.warn('Audio context not available:', error);
      return false;
    }
  }

  async speak(text: string, role: string = 'default', options: {
    pitch?: number;
    speed?: number;
    volume?: number;
  } = {}): Promise<void> {
    const voiceProfile = COURTROOM_VOICES[role] || COURTROOM_VOICES.judge;

    // Try ElevenLabs first, fallback to Azure, then browser TTS
    try {
      if (this.credentials.elevenlabs_api_key && voiceProfile.elevenlabs_id) {
        await this.speakElevenLabs(text, voiceProfile, options);
        return;
      }
    } catch (error) {
      console.warn('ElevenLabs TTS failed:', error);
    }

    try {
      if (this.credentials.azure_tts_key && voiceProfile.azure_voice) {
        await this.speakAzure(text, voiceProfile, options);
        return;
      }
    } catch (error) {
      console.warn('Azure TTS failed:', error);
    }

    // Fallback to browser TTS with enhanced settings
    await this.speakBrowser(text, voiceProfile, options);
  }

  private async speakElevenLabs(
    text: string,
    voiceProfile: VoiceProfile,
    options: { pitch?: number; speed?: number; volume?: number }
  ): Promise<void> {
    if (!this.credentials.elevenlabs_api_key || !voiceProfile.elevenlabs_id) {
      throw new Error('ElevenLabs credentials not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceProfile.elevenlabs_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.credentials.elevenlabs_api_key,
      },
      body: JSON.stringify({
        text: this.normalizeText(text),
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    await this.playAudioBuffer(audioBuffer);
  }

  private async speakAzure(
    text: string,
    voiceProfile: VoiceProfile,
    options: { pitch?: number; speed?: number; volume?: number }
  ): Promise<void> {
    if (!this.credentials.azure_tts_key || !this.credentials.azure_tts_region || !voiceProfile.azure_voice) {
      throw new Error('Azure TTS credentials not configured');
    }

    const ssml = `<speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' xml:gender='${voiceProfile.gender}' name='${voiceProfile.azure_voice}'>
        <prosody pitch='${options.pitch || voiceProfile.pitch}' rate='${options.speed || voiceProfile.speed}' volume='${options.volume || 1.0}'>
          ${this.escapeXml(this.normalizeText(text))}
        </prosody>
      </voice>
    </speak>`;

    const response = await fetch(`https://${this.credentials.azure_tts_region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.credentials.azure_tts_key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!response.ok) {
      throw new Error(`Azure TTS API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    await this.playAudioBuffer(audioBuffer);
  }

  private async speakBrowser(
    text: string,
    voiceProfile: VoiceProfile,
    options: { pitch?: number; speed?: number; volume?: number }
  ): Promise<void> {
    if (!window.speechSynthesis) {
      throw new Error('Speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(this.normalizeText(text));

      // Find best matching voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.name.toLowerCase().includes(voiceProfile.name.toLowerCase()) ||
        v.name.toLowerCase().includes(voiceProfile.gender) ||
        (voiceProfile.gender === 'male' && v.name.toLowerCase().includes('male')) ||
        (voiceProfile.gender === 'female' && v.name.toLowerCase().includes('female'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.pitch = options.pitch || voiceProfile.pitch;
      utterance.rate = options.speed || voiceProfile.speed;
      utterance.volume = options.volume || 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);

      window.speechSynthesis.speak(utterance);
    });
  }

  private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const audioData = await this.audioContext.decodeAudioData(audioBuffer);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioData;
    source.connect(this.audioContext.destination);
    source.start();

    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  }

  private normalizeText(text: string): string {
    return text
      .replace(/[`*_#>]/g, '') // Remove markdown
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  getAvailableVoices(): VoiceProfile[] {
    return Object.values(COURTROOM_VOICES);
  }

  isPremiumTTSAvailable(): boolean {
    return !!(this.credentials.elevenlabs_api_key || this.credentials.azure_tts_key);
  }
}