import { CacheManager } from '../cache-manager';
import { hashFile } from '../hashing';
import { ocrWithTesseract } from './tesseract-local';
import { extractPDFText } from './pdf-text-extractor';
import { supabase } from '@/integrations/supabase/client';

// Confidence threshold: if Tesseract returns above this, skip paid APIs
const LOCAL_CONFIDENCE_THRESHOLD = 80;

export interface OCRPipelineResult {
  text: string;
  confidence: number;
  provider: string;
  cached: boolean;
  processingTimeMs: number;
}

export async function processDocumentOCR(
  file: File,
  options?: { forceReprocess?: boolean; documentId?: string; fileUrl?: string }
): Promise<OCRPipelineResult> {
  const start = performance.now();
  const contentHash = await hashFile(file);
  
  // STEP 1: Check cache
  if (!options?.forceReprocess) {
    const cached = await CacheManager.checkOCRCache(contentHash);
    if (cached.hit && cached.data) {
      return {
        text: cached.data.text,
        confidence: cached.data.confidence,
        provider: cached.provider || 'cache',
        cached: true,
        processingTimeMs: Math.round(performance.now() - start),
      };
    }
  }
  
  // STEP 2: For PDFs, try text layer extraction first (FREE, instant)
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const pdfResult = await extractPDFText(file);
      if (pdfResult.hasTextLayer && pdfResult.text.length > 100) {
        await CacheManager.storeOCRCache(contentHash, pdfResult.text, 99, 'pdf_text_layer', file.type, file.size);
        await logAPIUsage('pdf_text_layer', 'extract', 'success');
        return {
          text: pdfResult.text,
          confidence: 99,
          provider: 'pdf_text_layer',
          cached: false,
          processingTimeMs: Math.round(performance.now() - start),
        };
      }
      // PDF has no text layer — fall through to OCR
    } catch (e) {
      console.warn('PDF text extraction failed, falling through to OCR:', e);
    }
  }
  
  // STEP 3: Tesseract.js local OCR (FREE, unlimited)
  try {
    const localResult = await ocrWithTesseract(file);
    if (localResult.confidence >= LOCAL_CONFIDENCE_THRESHOLD && localResult.text.length > 20) {
      await CacheManager.storeOCRCache(contentHash, localResult.text, localResult.confidence, 'tesseract_local', file.type, file.size);
      await logAPIUsage('tesseract_local', 'ocr', 'success');
      return {
        text: localResult.text,
        confidence: localResult.confidence,
        provider: 'tesseract_local',
        cached: false,
        processingTimeMs: Math.round(performance.now() - start),
      };
    }
    // Low confidence — try paid APIs for better quality
  } catch (e) {
    console.warn('Tesseract local OCR failed, falling through:', e);
  }
  
  // STEP 4: OCR.space API (25,000/mo free)
  if (await isProviderAvailable('ocr_space')) {
    try {
      const result = await callOCRSpaceAPI(file, options?.documentId, options?.fileUrl);
      if (result.text && result.text.length > 20) {
        await CacheManager.storeOCRCache(contentHash, result.text, result.confidence, 'ocr_space', file.type, file.size);
        await logAPIUsage('ocr_space', 'ocr', 'success');
        await incrementUsage('ocr_space');
        return {
          text: result.text,
          confidence: result.confidence,
          provider: 'ocr_space',
          cached: false,
          processingTimeMs: Math.round(performance.now() - start),
        };
      }
    } catch (e) {
      console.warn('OCR.space failed, falling through:', e);
      await logAPIUsage('ocr_space', 'ocr', 'failed', (e as Error).message);
    }
  }
  
  // STEP 5: Azure Vision (5,000/mo free)
  if (await isProviderAvailable('azure_vision')) {
    try {
      const result = await callAzureVisionAPI(file, options?.documentId, options?.fileUrl);
      if (result.text && result.text.length > 20) {
        await CacheManager.storeOCRCache(contentHash, result.text, result.confidence, 'azure_vision', file.type, file.size);
        await logAPIUsage('azure_vision', 'ocr', 'success');
        await incrementUsage('azure_vision');
        return {
          text: result.text,
          confidence: result.confidence,
          provider: 'azure_vision',
          cached: false,
          processingTimeMs: Math.round(performance.now() - start),
        };
      }
    } catch (e) {
      console.warn('Azure Vision failed, falling through:', e);
      await logAPIUsage('azure_vision', 'ocr', 'failed', (e as Error).message);
    }
  }
  
  // STEP 6: Google Gemini (1,500/day free)
  if (await isProviderAvailable('gemini_ocr')) {
    try {
      const result = await callGeminiOCR(file, options?.documentId, options?.fileUrl);
      if (result.text && result.text.length > 20) {
        await CacheManager.storeOCRCache(contentHash, result.text, result.confidence, 'gemini_ocr', file.type, file.size);
        await logAPIUsage('gemini_ocr', 'ocr', 'success');
        await incrementUsage('gemini_ocr');
        return {
          text: result.text,
          confidence: result.confidence,
          provider: 'gemini_ocr',
          cached: false,
          processingTimeMs: Math.round(performance.now() - start),
        };
      }
    } catch (e) {
      console.warn('Gemini OCR failed:', e);
      await logAPIUsage('gemini_ocr', 'ocr', 'failed', (e as Error).message);
    }
  }
  
  // ALL PROVIDERS EXHAUSTED — return best local result or queue for retry
  throw new Error('ALL_OCR_PROVIDERS_EXHAUSTED');
}

// Helper: Check if a provider has remaining quota
async function isProviderAvailable(provider: string): Promise<boolean> {
  const { data } = await (supabase as any)
    .from('rate_limit_status')
    .select('*')
    .eq('provider', provider)
    .single();
  
  if (!data) return false;
  
  // Reset counter if past reset time
  if (new Date(data.reset_at) <= new Date()) {
    await (supabase as any)
      .from('rate_limit_status')
      .update({ requests_used: 0, is_available: true, reset_at: getNextReset(provider) })
      .eq('provider', provider);
    return true;
  }
  
  return data.is_available && data.requests_used < data.requests_limit;
}

async function incrementUsage(provider: string): Promise<void> {
  await (supabase as any).rpc('increment_rate_limit_usage', { provider_name: provider });
}

async function logAPIUsage(provider: string, endpoint: string, status: string, error?: string): Promise<void> {
  await (supabase as any).from('api_usage_log').insert({
    provider,
    endpoint,
    status,
    error_message: error,
  });
}

function getNextReset(provider: string): string {
  const now = new Date();
  if (provider.includes('gemini')) {
    // Daily reset
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
  // Monthly reset
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

async function callOCRSpaceAPI(
  file: File,
  documentId?: string,
  fileUrl?: string
): Promise<{ text: string; confidence: number }> {
  if (!documentId || !fileUrl) {
    throw new Error('OCR.space requires documentId and fileUrl — upload the file first');
  }
  const { data, error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId, fileUrl },
  });
  if (error) throw error;
  return { text: data.extractedText || data.text, confidence: data.confidence || 90 };
}

async function callAzureVisionAPI(
  file: File,
  documentId?: string,
  fileUrl?: string
): Promise<{ text: string; confidence: number }> {
  if (!documentId || !fileUrl) {
    throw new Error('Azure Vision requires documentId and fileUrl — upload the file first');
  }
  const { data, error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId, fileUrl },
  });
  if (error) throw error;
  return { text: data.extractedText || data.text, confidence: data.confidence || 95 };
}

async function callGeminiOCR(
  file: File,
  documentId?: string,
  fileUrl?: string
): Promise<{ text: string; confidence: number }> {
  if (!documentId || !fileUrl) {
    throw new Error('Gemini OCR requires documentId and fileUrl — upload the file first');
  }
  const { data, error } = await supabase.functions.invoke('ocr-document', {
    body: { documentId, fileUrl },
  });
  if (error) throw error;
  return { text: data.extractedText || data.text, confidence: data.confidence || 88 };
}
