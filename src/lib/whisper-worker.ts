export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium';

export interface WhisperConfig {
  modelSize: WhisperModelSize;
  modelUrl?: string;
  wasmUrl?: string;
  language: string;
  threads: number;
}

export interface TranscriptionResult {
  transcript: string;
  segments: TranscriptSegment[];
  confidence: number;
  processingTime: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface WhisperProgress {
  stage: 'loading' | 'initializing' | 'transcribing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export type ProgressCallback = (progress: WhisperProgress) => void;

const MODEL_URLS: Record<WhisperModelSize, string> = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
  medium: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
};

const MODEL_SIZES: Record<WhisperModelSize, number> = {
  tiny: 75 * 1024 * 1024,
  base: 142 * 1024 * 1024,
  small: 466 * 1024 * 1024,
  medium: 1500 * 1024 * 1024,
};

const DB_NAME = 'whisper-models';
const DB_VERSION = 1;
const STORE_NAME = 'models';

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });

    return this.initPromise;
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async set(key: string, value: ArrayBuffer): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async has(key: string): Promise<boolean> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(!!request.result);
    });
  }
}

const cache = new IndexedDBCache();

export interface WhisperWorkerInstance {
  isReady: boolean;
  isLoaded: boolean;
  init: (config: Partial<WhisperConfig>, onProgress?: ProgressCallback) => Promise<void>;
  transcribe: (audioData: Float32Array) => Promise<TranscriptionResult>;
  abort: () => void;
  destroy: () => void;
}

export function createWhisperWorker(): WhisperWorkerInstance {
  let worker: Worker | null = null;
  let isReady = false;
  let isLoaded = false;
  let abortController: AbortController | null = null;

  const getWorker = (): Worker => {
    if (!worker) {
      worker = new Worker(
        new URL('../workers/whisper.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return worker;
  };

  async function downloadModel(
    modelSize: WhisperModelSize,
    onProgress?: ProgressCallback
  ): Promise<ArrayBuffer> {
    const cacheKey = `whisper-${modelSize}`;
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      onProgress?.({
        stage: 'loading',
        progress: 100,
        message: 'Model loaded from cache',
      });
      return cached;
    }

    const url = MODEL_URLS[modelSize];
    const totalSize = MODEL_SIZES[modelSize];

    onProgress?.({
      stage: 'loading',
      progress: 0,
      message: `Downloading ${modelSize} model (~${Math.round(totalSize / 1024 / 1024)}MB)...`,
    });

    abortController = new AbortController();
    const response = await fetch(url, { signal: abortController.signal });
    
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const chunks: Uint8Array[] = [];
    let receivedSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      receivedSize += value.length;
      
      const progress = Math.min((receivedSize / totalSize) * 100, 99);
      onProgress?.({
        stage: 'loading',
        progress,
        message: `Downloading ${modelSize} model: ${Math.round(progress)}%`,
      });
    }

    const modelData = new Uint8Array(receivedSize);
    let offset = 0;
    for (const chunk of chunks) {
      modelData.set(chunk, offset);
      offset += chunk.length;
    }

    await cache.set(cacheKey, modelData.buffer);

    onProgress?.({
      stage: 'loading',
      progress: 100,
      message: 'Model downloaded and cached',
    });

    return modelData.buffer;
  }

  async function init(
    config: Partial<WhisperConfig> = {},
    onProgress?: ProgressCallback
  ): Promise<void> {
    const modelSize = config.modelSize || 'tiny';
    
    onProgress?.({
      stage: 'loading',
      progress: 0,
      message: 'Initializing Whisper...',
    });

    const modelData = await downloadModel(modelSize, onProgress);
    
    onProgress?.({
      stage: 'initializing',
      progress: 50,
      message: 'Loading model into memory...',
    });

    const w = getWorker();
    
    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent) => {
        const { type, payload } = event.data;
        
        if (type === 'ready') {
          w.removeEventListener('message', handleMessage);
          isReady = true;
          isLoaded = true;
          onProgress?.({
            stage: 'complete',
            progress: 100,
            message: 'Whisper ready',
          });
          resolve();
        } else if (type === 'error') {
          w.removeEventListener('message', handleMessage);
          onProgress?.({
            stage: 'error',
            progress: 0,
            message: payload.error || 'Failed to initialize Whisper',
          });
          reject(new Error(payload.error));
        }
      };

      w.addEventListener('message', handleMessage);
      
      w.postMessage({
        type: 'init',
        payload: {
          modelData,
          language: config.language || 'en',
          threads: config.threads || navigator.hardwareConcurrency || 4,
        },
      });
    });
  }

  async function transcribe(audioData: Float32Array): Promise<TranscriptionResult> {
    if (!isReady) {
      throw new Error('Whisper worker not initialized. Call init() first.');
    }

    const w = getWorker();
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent) => {
        const { type, payload } = event.data;
        
        if (type === 'result') {
          w.removeEventListener('message', handleMessage);
          const processingTime = performance.now() - startTime;
          resolve({
            transcript: payload.transcript,
            segments: payload.segments || [],
            confidence: payload.confidence || 0.9,
            processingTime,
          });
        } else if (type === 'error') {
          w.removeEventListener('message', handleMessage);
          reject(new Error(payload.error));
        }
      };

      w.addEventListener('message', handleMessage);
      
      w.postMessage({
        type: 'transcribe',
        payload: { audioData },
      });
    });
  }

  function abort(): void {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    
    if (worker && isReady) {
      worker.postMessage({ type: 'abort' });
    }
  }

  function destroy(): void {
    abort();
    if (worker) {
      worker.terminate();
      worker = null;
    }
    isReady = false;
    isLoaded = false;
  }

  return {
    get isReady() { return isReady; },
    get isLoaded() { return isLoaded; },
    init,
    transcribe,
    abort,
    destroy,
  };
}

export interface AudioProcessor {
  sampleRate: number;
  process: (audioBuffer: AudioBuffer) => Float32Array;
  resample: (audioData: Float32Array, fromRate: number, toRate: number) => Float32Array;
}

export function createAudioProcessor(targetSampleRate: number = 16000): AudioProcessor {
  return {
    sampleRate: targetSampleRate,
    
    process(audioBuffer: AudioBuffer): Float32Array {
      const channelData = audioBuffer.getChannelData(0);
      
      if (audioBuffer.sampleRate === targetSampleRate) {
        return channelData;
      }
      
      return this.resample(channelData, audioBuffer.sampleRate, targetSampleRate);
    },
    
    resample(
      audioData: Float32Array,
      fromRate: number,
      toRate: number
    ): Float32Array {
      if (fromRate === toRate) return audioData;
      
      const ratio = fromRate / toRate;
      const newLength = Math.round(audioData.length / ratio);
      const result = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
        const t = srcIndex - srcIndexFloor;
        
        result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
      }
      
      return result;
    },
  };
}

export async function captureAudio(durationMs: number = 5000): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    } 
  });
  
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  const chunks: Float32Array[] = [];
  let totalLength = 0;
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      const result = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(result);
    }, durationMs);
    
    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(inputData);
      chunks.push(chunk);
      totalLength += chunk.length;
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    function cleanup() {
      clearTimeout(timeout);
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
    }
    
    processor.onerror = (error) => {
      cleanup();
      reject(error);
    };
  });
}

export { cache as modelCache };
