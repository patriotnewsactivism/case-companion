import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { validateUUID, sanitizeString, validateInteger } from '../_shared/validation.ts';

type Provider = 'google_scholar' | 'courtlistener' | 'justia';

interface SearchResult {
  citation: string;
  caseName: string;
  court: string;
  dateDecided: string;
  summary: string;
  holding: string;
  relevanceScore: number;
  source: string;
  sourceUrl: string;
}

interface SearchRequest {
  action: 'search' | 'get' | 'save' | 'history';
  caseId: string;
  query?: string;
  providers?: Provider[];
  limit?: number;
  court?: string;
  dateRange?: { start: string; end: string };
  citation?: string;
  researchId?: string;
  researchData?: {
    citation: string;
    caseName: string;
    court: string;
    dateDecided: string;
    summary: string;
    holding: string;
    sourceUrl: string;
    notes?: string;
    relevanceTags?: string[];
  };
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  provider: string;
}

interface CourtListenerSearchResult {
  id: number;
  case_name: string;
  citation: string[];
  court: string;
  date_filed: string;
  snippet: string;
  absolute_url: string;
  score: number;
}

interface CourtListenerOpinion {
  id: number;
  cluster: {
    case_name: string;
    citation: string[];
    court: string;
    date_filed: string;
    judges: string;
    absolute_url: string;
  };
  plain_text: string;
  html: string;
  html_with_citations: string;
}

const COURTLISTENER_BASE_URL = 'https://www.courtlistener.com/api/rest/v3';
const COURTLISTENER_RATE_LIMIT_PER_HOUR = 5000;

const courtAbbreviations: Record<string, string> = {
  'SCOTUS': 'United States Supreme Court',
  'U.S.': 'United States Reports',
  'S. Ct.': 'Supreme Court Reporter',
  'L. Ed.': 'United States Supreme Court Reports, Lawyers Edition',
  'F.': 'Federal Reporter',
  'F.2d': 'Federal Reporter, Second Series',
  'F.3d': 'Federal Reporter, Third Series',
  'F.4th': 'Federal Reporter, Fourth Series',
  'F. Supp.': 'Federal Supplement',
  'F. Supp. 2d': 'Federal Supplement, Second Series',
  'F. Supp. 3d': 'Federal Supplement, Third Series',
  'B.R.': 'Bankruptcy Reporter',
  'A.': 'Atlantic Reporter',
  'A.2d': 'Atlantic Reporter, Second Series',
  'A.3d': 'Atlantic Reporter, Third Series',
  'N.E.': 'North Eastern Reporter',
  'N.E.2d': 'North Eastern Reporter, Second Series',
  'N.E.3d': 'North Eastern Reporter, Third Series',
  'N.W.': 'North Western Reporter',
  'N.W.2d': 'North Western Reporter, Second Series',
  'N.W.3d': 'North Western Reporter, Third Series',
  'S.W.': 'South Western Reporter',
  'S.W.2d': 'South Western Reporter, Second Series',
  'S.W.3d': 'South Western Reporter, Third Series',
  'So.': 'Southern Reporter',
  'So. 2d': 'Southern Reporter, Second Series',
  'So. 3d': 'Southern Reporter, Third Series',
  'P.': 'Pacific Reporter',
  'P.2d': 'Pacific Reporter, Second Series',
  'P.3d': 'Pacific Reporter, Third Series',
  'P.4th': 'Pacific Reporter, Fourth Series',
  'Cal.': 'California Reports',
  'Cal. App.': 'California Appellate Reports',
  'N.Y.': 'New York Reports',
  'N.Y.S.': 'New York Supplement',
  'N.Y.S.2d': 'New York Supplement, Second Series',
  'Tex.': 'Texas Reports',
  'S.W.': 'South Western Reporter',
};

function parseBluebookCitation(citation: string): {
  caseName: string;
  volume: string;
  reporter: string;
  page: string;
  year: string;
  valid: boolean;
} {
  const standardPattern = /^(.+?)\s*,\s*(\d+)\s+([A-Za-z.0-9]+(?:\s+[0-9]+[a-z]+)?)\s+(\d+)(?:\s*,\s*(\d{4}))?$/;
  const match = citation.trim().match(standardPattern);
  
  if (match) {
    const [, caseName, volume, reporter, page, year] = match;
    const valid = Object.keys(courtAbbreviations).includes(reporter) || 
      reporter.includes('.') || 
      reporter.length >= 2;
    
    return {
      caseName: caseName.trim(),
      volume,
      reporter,
      page,
      year: year || '',
      valid,
    };
  }
  
  return {
    caseName: '',
    volume: '',
    reporter: '',
    page: '',
    year: '',
    valid: false,
  };
}

function validateCitation(citation: string): { valid: boolean; error?: string } {
  const parsed = parseBluebookCitation(citation);
  
  if (!parsed.valid) {
    return {
      valid: false,
      error: 'Invalid citation format. Expected format: "Case Name, Volume Reporter Page"',
    };
  }
  
  return { valid: true };
}

async function searchCourtListener(
  query: string,
  limit: number,
  court?: string,
  dateRange?: { start: string; end: string }
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    search: query,
    format: 'json',
    order_by: 'score desc',
  });
  
  params.append('court_statutes_precedential_status', 'Precedential');
  
  if (court) {
    params.append('court', court);
  }
  
  if (dateRange) {
    params.append('filed_after', dateRange.start);
    params.append('filed_before', dateRange.end);
  }
  
  const response = await fetch(`${COURTLISTENER_BASE_URL}/search/?${params.toString()}`, {
    headers: {
      'User-Agent': 'CaseBuddy Legal Research Tool (https://casebuddy.live)',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('CourtListener rate limit exceeded. Please try again later.');
    }
    throw new Error(`CourtListener API error: ${response.status}`);
  }
  
  const data = await response.json();
  const results: SearchResult[] = (data.results || []).slice(0, limit).map((result: CourtListenerSearchResult) => ({
    citation: result.citation?.[0] || '',
    caseName: result.case_name || '',
    court: result.court || '',
    dateDecided: result.date_filed || '',
    summary: result.snippet?.substring(0, 500) || '',
    holding: '',
    relevanceScore: result.score || 0,
    source: 'courtlistener',
    sourceUrl: `https://www.courtlistener.com${result.absolute_url}`,
  }));
  
  return {
    results,
    total: data.count || results.length,
    provider: 'courtlistener',
  };
}

async function getCourtListenerOpinion(opinionId: number): Promise<CourtListenerOpinion | null> {
  const response = await fetch(`${COURTLISTENER_BASE_URL}/opinions/${opinionId}/?format=json`, {
    headers: {
      'User-Agent': 'CaseBuddy Legal Research Tool (https://casebuddy.live)',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    return null;
  }
  
  return response.json();
}

async function getCaseByCitation(citation: string): Promise<SearchResult | null> {
  const parsed = parseBluebookCitation(citation);
  
  if (!parsed.valid) {
    return null;
  }
  
  const params = new URLSearchParams({
    citation: citation,
    format: 'json',
  });
  
  const response = await fetch(`${COURTLISTENER_BASE_URL}/search/?${params.toString()}`, {
    headers: {
      'User-Agent': 'CaseBuddy Legal Research Tool (https://casebuddy.live)',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  const result = data.results?.[0];
  
  if (!result) {
    return null;
  }
  
  let holding = '';
  if (result.id) {
    const opinion = await getCourtListenerOpinion(result.id);
    if (opinion?.html_with_citations) {
      const holdingMatch = opinion.html_with_citations.match(/(?:Held|Holding|We hold)[:\s]*([^<]{50,500})/i);
      if (holdingMatch) {
        holding = holdingMatch[1].trim();
      }
    }
  }
  
  return {
    citation: result.citation?.[0] || citation,
    caseName: result.case_name || parsed.caseName,
    court: result.court || '',
    dateDecided: result.date_filed || '',
    summary: result.snippet?.substring(0, 500) || '',
    holding,
    relevanceScore: result.score || 100,
    source: 'courtlistener',
    sourceUrl: `https://www.courtlistener.com${result.absolute_url}`,
  };
}

async function searchGoogleScholar(query: string): Promise<SearchResult[]> {
  return [];
}

async function searchJustia(query: string): Promise<SearchResult[]> {
  return [];
}

async function searchAllProviders(
  query: string,
  providers: Provider[],
  limit: number,
  court?: string,
  dateRange?: { start: string; end: string }
): Promise<{ results: SearchResult[]; errors: string[] }> {
  const allResults: SearchResult[] = [];
  const errors: string[] = [];
  
  if (providers.includes('courtlistener')) {
    try {
      const courtListenerResults = await searchCourtListener(query, limit, court, dateRange);
      allResults.push(...courtListenerResults.results);
    } catch (error) {
      errors.push(`CourtListener: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (providers.includes('google_scholar')) {
    try {
      const scholarResults = await searchGoogleScholar(query);
      allResults.push(...scholarResults);
    } catch (error) {
      errors.push(`Google Scholar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (providers.includes('justia')) {
    try {
      const justiaResults = await searchJustia(query);
      allResults.push(...justiaResults);
    } catch (error) {
      errors.push(`Justia: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return {
    results: allResults.slice(0, limit),
    errors,
  };
}

async function handleSearch(
  req: SearchRequest,
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2')['default']>['prototype'],
  userId: string
): Promise<Response> {
  if (!req.query) {
    throw new Error('Query is required for search action');
  }
  
  const query = sanitizeString(req.query, 'query', 1000);
  const providers = req.providers || ['courtlistener'];
  const limit = req.limit ? validateInteger(req.limit, 'limit', 1, 50) : 10;
  
  const caseId = validateUUID(req.caseId, 'caseId');
  
  const { data: caseCheck, error: caseError } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('user_id', userId)
    .single();
  
  if (caseError || !caseCheck) {
    throw new Error('Case not found or access denied');
  }
  
  const { results, errors } = await searchAllProviders(
    query,
    providers,
    limit,
    req.court,
    req.dateRange
  );
  
  await supabase.from('case_law_research').insert({
    case_id: caseId,
    user_id: userId,
    query,
    results: results,
  });
  
  return new Response(JSON.stringify({
    results,
    total: results.length,
    providers: providers,
    errors: errors.length > 0 ? errors : undefined,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGet(
  req: SearchRequest,
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2')['default']>['prototype'],
  userId: string
): Promise<Response> {
  const citation = req.citation || req.query;
  
  if (!citation) {
    throw new Error('Citation is required for get action');
  }
  
  const sanitizedCitation = sanitizeString(citation, 'citation', 200);
  const validation = validateCitation(sanitizedCitation);
  
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid citation format');
  }
  
  const caseResult = await getCaseByCitation(sanitizedCitation);
  
  if (!caseResult) {
    throw new Error('Case not found for the given citation');
  }
  
  if (req.caseId) {
    const caseId = validateUUID(req.caseId, 'caseId');
    
    const { data: caseCheck } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('user_id', userId)
      .single();
    
    if (caseCheck) {
      await supabase.from('case_law_research').insert({
        case_id: caseId,
        user_id: userId,
        query: sanitizedCitation,
        results: [caseResult],
      });
    }
  }
  
  return new Response(JSON.stringify({
    result: caseResult,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSave(
  req: SearchRequest,
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2')['default']>['prototype'],
  userId: string
): Promise<Response> {
  if (!req.researchData) {
    throw new Error('Research data is required for save action');
  }
  
  const caseId = validateUUID(req.caseId, 'caseId');
  
  const { data: caseCheck, error: caseError } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('user_id', userId)
    .single();
  
  if (caseError || !caseCheck) {
    throw new Error('Case not found or access denied');
  }
  
  const { data, error } = await supabase
    .from('case_law_research')
    .insert({
      case_id: caseId,
      user_id: userId,
      query: req.researchData.citation || req.researchData.caseName,
      results: [req.researchData],
      notes: req.researchData.notes,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save research: ${error.message}`);
  }
  
  return new Response(JSON.stringify({
    success: true,
    researchId: data.id,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleHistory(
  req: SearchRequest,
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2')['default']>['prototype'],
  userId: string
): Promise<Response> {
  const caseId = validateUUID(req.caseId, 'caseId');
  
  const { data: caseCheck, error: caseError } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('user_id', userId)
    .single();
  
  if (caseError || !caseCheck) {
    throw new Error('Case not found or access denied');
  }
  
  const { data, error } = await supabase
    .from('case_law_research')
    .select('*')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    throw new Error(`Failed to fetch history: ${error.message}`);
  }
  
  return new Response(JSON.stringify({
    history: data || [],
    total: data?.length || 0,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);
    
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'legal-research',
        corsHeaders
      );
    }
    
    const { user, supabase } = authResult;
    
    const rateLimitCheck = checkRateLimit(`legal-research:${user.id}`, 30, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const requestBody = (await req.json()) as SearchRequest;
    
    if (!requestBody.action) {
      throw new Error('Action is required (search, get, save, or history)');
    }
    
    if (!requestBody.caseId) {
      throw new Error('Case ID is required');
    }
    
    let response: Response;
    
    switch (requestBody.action) {
      case 'search':
        response = await handleSearch(requestBody, supabase, user.id);
        break;
      case 'get':
        response = await handleGet(requestBody, supabase, user.id);
        break;
      case 'save':
        response = await handleSave(requestBody, supabase, user.id);
        break;
      case 'history':
        response = await handleHistory(requestBody, supabase, user.id);
        break;
      default:
        throw new Error(`Unknown action: ${requestBody.action}`);
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, ...Object.fromEntries(response.headers) },
    });
    
  } catch (error) {
    console.error('Legal research error:', error);
    return createErrorResponse(error, 500, 'legal-research', corsHeaders);
  }
});
