import { CacheManager } from '../cache-manager';
import { hashFile } from '../hashing';

const WHISPER_MAX_DURATION_SECONDS = 1800; // 30 min max for local processing

export interface TranscriptionResult {
  text: string;
  segments?: Array<{ start: number; end: number; text: string; speaker?: string }>;
  speakers?: string[];
  durationSeconds: number;
  provider: string;
  cached: boolean;
}

export async function transcribeMedia(
  file: File,
  options?: { 
    forceReprocess?: boolean;
    needSpeakerDiarization?: boolean;
  }
): Promise<TranscriptionResult> {
  const contentHash = await hashFile(file);
  
  // STEP 1: Check cache
  if (!options?.forceReprocess) {
    const cached = await CacheManager.checkTranscriptCache(contentHash);
    if (cached.hit && cached.data) {
      return {
        text: cached.data.text,
        segments: cached.data.segments,
        speakers: cached.data.speakers,
        durationSeconds: cached.data.duration,
        provider: cached.provider || 'cache',
        cached: true,
      };
    }
  }
  
  // STEP 2: Get audio duration estimate
  const estimatedDuration = await estimateAudioDuration(file);
  
  // STEP 3: Local Whisper (FREE, unlimited) — for files under 30 min without diarization needs
  if (estimatedDuration <= WHISPER_MAX_DURATION_SECONDS && !options?.needSpeakerDiarization) {
    try {
      const result = await transcribeWithLocalWhisper(file);
      await CacheManager.storeTranscriptCache(
        contentHash, result.text, result.segments, null, estimatedDuration, 'whisper_local'
      );
      return { ...result, cached: false };
    } catch (e) {
      console.warn('Local Whisper failed, falling through:', e);
    }
  }
  
  // STEP 4: AssemblyAI (5 hrs/mo free — has speaker diarization)
  try {
    const result = await transcribeWithAssemblyAI(file);
    await CacheManager.storeTranscriptCache(
      contentHash, result.text, result.segments, result.speakers, result.durationSeconds, 'assemblyai'
    );
    return { ...result, cached: false };
  } catch (e) {
    console.warn('AssemblyAI failed, falling through:', e);
  }
  
  // STEP 5: OpenAI Whisper API ($0.006/min — reliable fallback)
  try {
    const result = await transcribeWithOpenAIWhisper(file);
    await CacheManager.storeTranscriptCache(
      contentHash, result.text, result.segments, null, result.durationSeconds, 'openai_whisper'
    );
    return { ...result, cached: false };
  } catch (e) {
    console.warn('OpenAI Whisper failed:', e);
  }
  
  throw new Error('ALL_TRANSCRIPTION_PROVIDERS_EXHAUSTED');
}

async function transcribeWithLocalWhisper(file: File): Promise<TranscriptionResult> {
  // Use @xenova/transformers Whisper pipeline
  const { pipeline } = await import('@xenova/transformers');
  const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
    // Use quantized model for faster loading
    quantized: true,
  });
  
  const audioBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const decoded = await audioContext.decodeAudioData(audioBuffer);
  const audioData = decoded.getChannelData(0); // mono
  
  const result = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });
  
  return {
    text: (result as any).text,
    segments: (result as any).chunks?.map((c: any) => ({
      start: c.timestamp[0],
      end: c.timestamp[1],
      text: c.text,
    })),
    durationSeconds: decoded.duration,
    provider: 'whisper_local',
    cached: false,
  };
}

async function transcribeWithAssemblyAI(file: File): Promise<TranscriptionResult> {
  // Call existing Supabase edge function
  const { data, error } = await (await import('@/integrations/supabase/client')).supabase
    .functions.invoke('transcribe-media', {
      body: { /* file upload data */ },
    });
  if (error) throw error;
  return {
    text: data.text,
    segments: data.segments,
    speakers: data.speakers,
    durationSeconds: data.duration,
    provider: 'assemblyai',
    cached: false,
  };
}

async function transcribeWithOpenAIWhisper(file: File): Promise<TranscriptionResult> {
  // Call Supabase edge function that proxies to OpenAI Whisper
  const { data, error } = await (await import('@/integrations/supabase/client')).supabase
    .functions.invoke('transcribe-media', {
      body: { provider: 'openai_whisper', /* file data */ },
    });
  if (error) throw error;
  return {
    text: data.text,
    segments: data.segments,
    durationSeconds: data.duration,
    provider: 'openai_whisper',
    cached: false,
  };
}

async function estimateAudioDuration(file: File): Promise<number> {
  // Rough estimate based on file size and type
  const bytesPerSecond: Record<string, number> = {
    'audio/mp3': 16000,
    'audio/mpeg': 16000,
    'audio/wav': 176400,
    'audio/m4a': 16000,
    'audio/ogg': 12000,
    'video/mp4': 500000,
    'video/quicktime': 500000,
  };
  const bps = bytesPerSecond[file.type] || 16000;
  return Math.ceil(file.size / bps);
}
