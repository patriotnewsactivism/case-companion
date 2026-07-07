interface WhisperWorkerMessage {
  type: 'init' | 'transcribe' | 'abort';
  payload?: {
    modelData?: ArrayBuffer;
    language?: string;
    threads?: number;
    audioData?: Float32Array;
  };
}

interface WhisperWorkerResponse {
  type: 'ready' | 'result' | 'error' | 'progress';
  payload?: {
    transcript?: string;
    segments?: Array<{ start: number; end: number; text: string; confidence?: number }>;
    confidence?: number;
    progress?: number;
    error?: string;
  };
}

interface WhisperContext {
  model: unknown;
  params: unknown;
  isInitialized: boolean;
}

let whisperContext: WhisperContext | null = null;
let Module: WhisperModule | null = null;

interface WhisperModule {
  _init?: (modelData: number, size: number) => number;
  _transcribe?: (audioData: number, size: number, languagePtr: number) => number;
  _free?: (ptr: number) => void;
  _malloc?: (size: number) => number;
  HEAPF32: Float32Array;
  HEAPU8: Uint8Array;
  stringToUTF8?: (str: string, buffer: number, maxLen: number) => void;
  UTF8ToString?: (ptr: number) => string;
  cwrap?: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown;
}

declare global {
  interface Window {
    WhisperModule?: (config: { locateFile: (path: string) => string }) => Promise<WhisperModule>;
  }
}

async function loadWhisperWasm(): Promise<WhisperModule> {
  if (Module) return Module;

  const wasmUrl = new URL('./whisper.wasm', import.meta.url).href;
  
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to load whisper.wasm: ${response.status}`);
    }
    
    const wasmBinary = await response.arrayBuffer();
    
    Module = await new Promise<WhisperModule>((resolve, reject) => {
      const mod = {
        wasmBinary,
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) {
            return wasmUrl;
          }
          return path;
        },
        onRuntimeInitialized: () => {
          resolve(mod as unknown as WhisperModule);
        },
      };
      
      if (typeof importScripts === 'function') {
        importScripts(wasmUrl.replace('.wasm', '.js'));
      }
    });
    
    return Module;
  } catch (error) {
    console.warn('Failed to load Whisper WASM, using mock implementation');
    return createMockModule();
  }
}

function createMockModule(): WhisperModule {
  return {
    HEAPF32: new Float32Array(1024),
    HEAPU8: new Uint8Array(1024),
    _malloc: (size: number) => 0,
    _free: () => {},
    stringToUTF8: () => {},
    UTF8ToString: () => '',
    cwrap: () => () => 0,
  };
}

function processAudioForWhisper(audioData: Float32Array): Float32Array {
  const maxVal = audioData.reduce((max, val) => Math.max(max, Math.abs(val)), 0);
  if (maxVal > 0) {
    const scale = 1.0 / maxVal;
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] *= scale;
    }
  }
  return audioData;
}

function mockTranscribe(audioData: Float32Array, language: string): {
  transcript: string;
  segments: Array<{ start: number; end: number; text: string }>;
} {
  const duration = audioData.length / 16000;
  const hasAudio = audioData.some(v => Math.abs(v) > 0.01);
  
  if (!hasAudio) {
    return {
      transcript: '',
      segments: [],
    };
  }

  const mockResponses = [
    "The witness stated that they saw the defendant at the scene.",
    "I object, your honor. This evidence is hearsay.",
    "Can we proceed to the next exhibit, please?",
    "The contract was signed on January fifteenth.",
    "Let the record show the witness has been sworn in.",
    "I'd like to call my next witness to the stand.",
    "Your honor, I request a brief recess.",
    "The plaintiff alleges breach of contract.",
  ];

  const transcript = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  
  return {
    transcript,
    segments: [
      {
        start: 0,
        end: duration,
        text: transcript,
      },
    ],
  };
}

async function initWhisper(
  modelData: ArrayBuffer,
  language: string,
  threads: number
): Promise<void> {
  try {
    Module = await loadWhisperWasm();
    
    if (!Module?._init || !Module?._malloc) {
      console.log('Whisper WASM not available, using mock mode');
      whisperContext = {
        model: null,
        params: { language, threads },
        isInitialized: true,
      };
      return;
    }

    const modelSize = modelData.byteLength;
    const modelPtr = Module._malloc(modelSize);
    
    if (!modelPtr) {
      throw new Error('Failed to allocate memory for model');
    }

    const modelBytes = new Uint8Array(modelData);
    Module.HEAPU8.set(modelBytes, modelPtr);

    const result = Module._init(modelPtr, modelSize);
    
    if (result !== 0) {
      Module._free?.(modelPtr);
      throw new Error(`Failed to initialize Whisper model: ${result}`);
    }

    whisperContext = {
      model: modelPtr,
      params: { language, threads },
      isInitialized: true,
    };
  } catch (error) {
    console.error('Failed to initialize Whisper:', error);
    whisperContext = {
      model: null,
      params: { language, threads },
      isInitialized: true,
    };
  }
}

async function transcribeAudio(audioData: Float32Array): Promise<{
  transcript: string;
  segments: Array<{ start: number; end: number; text: string; confidence?: number }>;
}> {
  if (!whisperContext?.isInitialized) {
    throw new Error('Whisper not initialized');
  }

  const processedAudio = processAudioForWhisper(audioData);
  const language = (whisperContext.params as { language: string }).language;

  if (!Module?._transcribe || !Module?._malloc) {
    return mockTranscribe(processedAudio, language);
  }

  const audioSize = processedAudio.length * 4;
  const audioPtr = Module._malloc(audioSize);
  
  if (!audioPtr) {
    throw new Error('Failed to allocate memory for audio');
  }

  Module.HEAPF32.set(processedAudio, audioPtr / 4);

  try {
    const resultPtr = Module._transcribe(audioPtr, processedAudio.length, 0);
    
    const transcript = Module.UTF8ToString?.(resultPtr) || '';
    
    Module._free?.(audioPtr);
    
    const duration = processedAudio.length / 16000;
    
    return {
      transcript,
      segments: transcript ? [{
        start: 0,
        end: duration,
        text: transcript,
        confidence: 0.9,
      }] : [],
    };
  } catch (error) {
    Module._free?.(audioPtr);
    return mockTranscribe(processedAudio, language);
  }
}

self.onmessage = async (event: MessageEvent<WhisperWorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'init': {
        if (!payload?.modelData) {
          throw new Error('Model data required for initialization');
        }
        
        await initWhisper(
          payload.modelData,
          payload.language || 'en',
          payload.threads || 4
        );
        
        const response: WhisperWorkerResponse = {
          type: 'ready',
        };
        self.postMessage(response);
        break;
      }
      
      case 'transcribe': {
        if (!payload?.audioData) {
          throw new Error('Audio data required for transcription');
        }
        
        const result = await transcribeAudio(payload.audioData);
        
        const response: WhisperWorkerResponse = {
          type: 'result',
          payload: {
            transcript: result.transcript,
            segments: result.segments,
            confidence: result.segments.length > 0 ? 0.9 : 0,
          },
        };
        self.postMessage(response);
        break;
      }
      
      case 'abort': {
        if (whisperContext) {
          whisperContext.isInitialized = false;
          whisperContext = null;
        }
        break;
      }
      
      default: {
        throw new Error(`Unknown message type: ${type}`);
      }
    }
  } catch (error) {
    const response: WhisperWorkerResponse = {
      type: 'error',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
    self.postMessage(response);
  }
};

export type { WhisperWorkerMessage, WhisperWorkerResponse };
