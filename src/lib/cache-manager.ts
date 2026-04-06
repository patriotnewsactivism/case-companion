// Unified cache manager that checks all cache tables before any processing
// EVERY processing function must call checkCache() before doing work
// EVERY processing function must call storeCache() after completing work

import { supabase } from '@/integrations/supabase/client';

interface CacheResult<T> {
  hit: boolean;
  data?: T;
  provider?: string;
}

export class CacheManager {
  static async checkOCRCache(contentHash: string): Promise<CacheResult<{ text: string; confidence: number }>> {
    const { data } = await (supabase as any)
      .from('document_hash_cache')
      .select('ocr_text, ocr_confidence, ocr_provider')
      .eq('content_hash', contentHash)
      .single();
    
    if (data?.ocr_text) {
      // Update access stats
      await (supabase as any).rpc('increment_cache_access', { 
        cache_table: 'document_hash_cache', 
        hash: contentHash 
      });
      return { hit: true, data: { text: data.ocr_text, confidence: data.ocr_confidence }, provider: data.ocr_provider };
    }
    return { hit: false };
  }

  static async storeOCRCache(contentHash: string, text: string, confidence: number, provider: string, fileType: string, fileSize: number): Promise<void> {
    await (supabase as any).from('document_hash_cache').upsert({
      content_hash: contentHash,
      ocr_text: text,
      ocr_confidence: confidence,
      ocr_provider: provider,
      file_type: fileType,
      file_size_bytes: fileSize,
    }, { onConflict: 'content_hash' });
  }

  static async checkAICache(contentHash: string, analysisType: string, promptVersion: string): Promise<CacheResult<any>> {
    const { data } = await (supabase as any)
      .from('ai_analysis_cache')
      .select('result, model_used')
      .eq('content_hash', contentHash)
      .eq('analysis_type', analysisType)
      .eq('prompt_version', promptVersion)
      .single();
    
    if (data?.result) {
      await (supabase as any).rpc('increment_cache_access', { 
        cache_table: 'ai_analysis_cache', 
        hash: contentHash 
      });
      return { hit: true, data: data.result, provider: data.model_used };
    }
    return { hit: false };
  }

  static async storeAICache(contentHash: string, analysisType: string, promptVersion: string, result: any, model: string, tokens: number): Promise<void> {
    await (supabase as any).from('ai_analysis_cache').upsert({
      content_hash: contentHash,
      analysis_type: analysisType,
      prompt_version: promptVersion,
      result,
      model_used: model,
      tokens_used: tokens,
    }, { onConflict: 'content_hash,analysis_type,prompt_version' });
  }

  static async checkTranscriptCache(contentHash: string): Promise<CacheResult<{ text: string; segments: any; speakers: any; duration: number }>> {
    const { data } = await (supabase as any)
      .from('transcription_cache')
      .select('*')
      .eq('content_hash', contentHash)
      .single();
    
    if (data?.transcript_text) {
      await (supabase as any).rpc('increment_cache_access', { 
        cache_table: 'transcription_cache', 
        hash: contentHash 
      });
      return { 
        hit: true, 
        data: { 
          text: data.transcript_text, 
          segments: data.transcript_segments, 
          speakers: data.speakers, 
          duration: data.duration_seconds 
        }, 
        provider: data.provider 
      };
    }
    return { hit: false };
  }

  static async storeTranscriptCache(contentHash: string, text: string, segments: any, speakers: any, duration: number, provider: string): Promise<void> {
    await (supabase as any).from('transcription_cache').upsert({
      content_hash: contentHash,
      transcript_text: text,
      transcript_segments: segments,
      speakers,
      duration_seconds: duration,
      provider,
    }, { onConflict: 'content_hash' });
  }
}
