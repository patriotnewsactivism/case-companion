import { CacheManager } from '../cache-manager';
import { hashText } from '../hashing';
import { supabase } from '@/integrations/supabase/client';

// Prompt version tracking — increment when prompts change to invalidate cache
const PROMPT_VERSION = '1.0.0';

export interface LegalAnalysisResult {
  summary: string;
  keyFacts: Array<{ fact: string; significance: 'favorable' | 'adverse' | 'neutral'; source: string }>;
  entities: Array<{ name: string; type: 'person' | 'organization' | 'date' | 'location' | 'amount'; context: string }>;
  timelineEvents: Array<{ date: string; event: string; source: string }>;
  inconsistencies: string[];
  privilegeFlags: string[];
  hearsayFlags: string[];
  authenticationNotes: string;
  classification: 'favorable' | 'adverse' | 'neutral' | 'mixed';
  model: string;
  cached: boolean;
}

const LEGAL_ANALYSIS_SYSTEM_PROMPT = `You are an expert legal document analyst. You analyze documents with the precision and thoroughness expected by trial attorneys. You MUST return valid JSON matching the exact schema provided.

Your analysis must:
1. Extract every material fact with its significance to litigation
2. Identify all entities (people, organizations, dates, locations, dollar amounts)
3. Flag potential inconsistencies with other case materials
4. Identify timeline events with specific dates
5. Flag potential privilege issues (attorney-client, work product, etc.)
6. Flag potential hearsay issues and note applicable exceptions
7. Note authentication requirements (who can lay foundation for this exhibit)
8. Classify the document's overall impact as favorable, adverse, neutral, or mixed

CRITICAL: You are assisting, not replacing, legal judgment. Flag issues for attorney review.`;

const LEGAL_ANALYSIS_USER_PROMPT = (documentText: string, caseContext?: string) => `
Analyze this document for litigation purposes.
${caseContext ? `\nCase Context: ${caseContext}` : ''}

Document Text:
---
${documentText.slice(0, 100000)}
---

Return a JSON object with this EXACT structure:
{
  "summary": "2-3 sentence summary of the document",
  "keyFacts": [{"fact": "...", "significance": "favorable|adverse|neutral", "source": "quote or reference from doc"}],
  "entities": [{"name": "...", "type": "person|organization|date|location|amount", "context": "..."}],
  "timelineEvents": [{"date": "YYYY-MM-DD or description", "event": "...", "source": "..."}],
  "inconsistencies": ["potential inconsistency 1", ...],
  "privilegeFlags": ["potential privilege issue 1", ...],
  "hearsayFlags": ["potential hearsay issue with exception note", ...],
  "authenticationNotes": "Who can authenticate this document and how",
  "classification": "favorable|adverse|neutral|mixed"
}`;

export async function analyzeDocument(
  documentText: string,
  caseContext?: string,
  options?: { forceReprocess?: boolean }
): Promise<LegalAnalysisResult> {
  const contentHash = await hashText(documentText);
  
  // STEP 1: Check cache
  if (!options?.forceReprocess) {
    const cached = await CacheManager.checkAICache(contentHash, 'legal_analysis', PROMPT_VERSION);
    if (cached.hit && cached.data) {
      return { ...cached.data, model: cached.provider, cached: true };
    }
  }
  
  // STEP 2: Try Gemini Flash first (FREE 1,500/day)
  if (await isProviderAvailable('gemini_ai')) {
    try {
      const result = await callGeminiFlash(documentText, caseContext);
      await CacheManager.storeAICache(contentHash, 'legal_analysis', PROMPT_VERSION, result, 'gemini-2.0-flash', 0);
      await incrementUsage('gemini_ai');
      return { ...result, model: 'gemini-2.0-flash', cached: false };
    } catch (e) {
      console.warn('Gemini Flash failed, falling through:', e);
    }
  }
  
  // STEP 3: GPT-4o-mini fallback (paid)
  try {
    const result = await callGPT4oMini(documentText, caseContext);
    await CacheManager.storeAICache(contentHash, 'legal_analysis', PROMPT_VERSION, result, 'gpt-4o-mini', 0);
    return { ...result, model: 'gpt-4o-mini', cached: false };
  } catch (e) {
    console.warn('GPT-4o-mini failed:', e);
  }
  
  throw new Error('ALL_AI_PROVIDERS_EXHAUSTED');
}

async function callGeminiFlash(text: string, context?: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('ai-analyze', {
    body: {
      provider: 'gemini',
      model: 'gemini-2.0-flash-exp',
      systemPrompt: LEGAL_ANALYSIS_SYSTEM_PROMPT,
      userPrompt: LEGAL_ANALYSIS_USER_PROMPT(text, context),
      responseFormat: 'json',
    },
  });
  if (error) throw error;
  return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
}

async function callGPT4oMini(text: string, context?: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('ai-analyze', {
    body: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: LEGAL_ANALYSIS_SYSTEM_PROMPT,
      userPrompt: LEGAL_ANALYSIS_USER_PROMPT(text, context),
      responseFormat: 'json',
    },
  });
  if (error) throw error;
  return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
}

// Reuse rate limit helpers from OCR pipeline
async function isProviderAvailable(provider: string): Promise<boolean> {
  const { data } = await supabase
    .from('rate_limit_status')
    .select('*')
    .eq('provider', provider)
    .single();
  if (!data) return false;
  if (new Date(data.reset_at) <= new Date()) {
    await supabase
      .from('rate_limit_status')
      .update({ requests_used: 0, is_available: true })
      .eq('provider', provider);
    return true;
  }
  return data.is_available && data.requests_used < data.requests_limit;
}

async function incrementUsage(provider: string): Promise<void> {
  await supabase.rpc('increment_rate_limit_usage', { provider_name: provider });
}
