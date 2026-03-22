import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { validateUUID, validateString } from '../_shared/validation.ts';

type DiscoveryDocType = 'interrogatory' | 'request_for_production' | 'request_for_admission' | 'deposition' | 'document_production' | 'subpoena' | 'expert_disclosure' | 'other';

interface DiscoveryQuestion {
  id: string;
  number: string;
  question: string;
  response?: string;
  objections?: string[];
  status: 'pending' | 'responded' | 'objected' | 'partial' | 'overdue';
  response_due_date?: string;
  served_date?: string;
  notes?: string;
  cross_references?: string[];
  privileged?: boolean;
  bates_range?: string;
}

interface DiscoveryAnalysisResult {
  document_type: DiscoveryDocType;
  questions_extracted: number;
  questions: DiscoveryQuestion[];
  suggested_responses: Record<string, string>;
  objection_analysis: Record<string, string[]>;
  cross_references: string[];
  key_admissions: string[];
  potential_impeachment: string[];
  timeline_events: Array<{
    date: string;
    event: string;
    significance: string;
  }>;
  recommended_strategy: string[];
  summary: string;
}

function buildDiscoveryAnalysisPrompt(
  documentText: string,
  documentType: DiscoveryDocType,
  partyName?: string
): string {
  const typeInstructions: Record<DiscoveryDocType, string> = {
    interrogatory: `Analyze these interrogatories:
    - Extract each numbered question completely
    - Identify any implied subparts
    - Note temporal scope (dates, events referenced)
    - Flag questions that may require expert consultation
    - Identify privilege implications`,
    
    request_for_production: `Analyze these requests for production:
    - Categorize documents requested
    - Identify overly broad or burdensome requests
    - Note specific objection grounds
    - Identify responsive document categories
    - Flag ESI and electronically stored information issues`,
    
    request_for_admission: `Analyze these requests for admission:
    - Identify factual admissions sought
    - Note legal conclusions disguised as facts
    - Flag already admitted matters
    - Identify denial implications`,
    
    deposition: `Analyze this deposition transcript:
    - Extract key testimony
    - Identify inconsistencies
    - Note admissions against interest
    - Flag favorable cross-examination points
    - Identify impeachment opportunities
    - Extract dates, names, locations mentioned`,
    
    document_production: `Analyze this document production:
    - Categorize documents produced
    - Identify key evidence
    - Note privilege log entries
    - Flag potentially responsive documents not produced`,
    
    subpoena: `Analyze this subpoena:
    - Identify requirements
    - Note objection grounds
    - Identify compliance burden
    - Flag jurisdictional issues`,
    
    expert_disclosure: `Analyze this expert disclosure:
    - Summarize expert opinions
    - Note qualifications
    - Identify Rule 26(a)(2) compliance
    - Flag Daubert challenges`,
    
    other: `Analyze this discovery document:`
  };

  return `You are an expert legal document analyst specializing in discovery responses for litigation. 
Analyze the following ${documentType} ${partyName ? `from ${partyName}` : ''}.

${typeInstructions[documentType]}

Provide a comprehensive analysis in valid JSON format with this structure:
{
  "document_type": "${documentType}",
  "questions_extracted": number,
  "questions": [
    {
      "id": "unique identifier",
      "number": "question number",
      "question": "full question text",
      "response": "proposed response or null",
      "objections": ["objection 1", "objection 2"] or null,
      "status": "pending|responded|objected|partial|overdue",
      "notes": "attorney notes or null"
    }
  ],
  "suggested_responses": {
    "question_id": "draft response text"
  },
  "objection_analysis": {
    "question_id": ["applicable objections"]
  },
  "cross_references": ["references to other discovery", "exhibit numbers"],
  "key_admissions": ["significant admissions made"],
  "potential_impeachment": ["inconsistencies for impeachment"],
  "timeline_events": [
    {
      "date": "YYYY-MM-DD",
      "event": "event description",
      "significance": "legal significance"
    }
  ],
  "recommended_strategy": ["strategic recommendations"],
  "summary": "overall document summary"
}

DOCUMENT TEXT:
${documentText.slice(0, 80000)}

Respond ONLY with valid JSON, no markdown, no preamble.`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    let user: { id: string };
    let supabase: SupabaseClient;
    let isServiceRole = false;

    if (serviceRoleKey && bearerToken === serviceRoleKey) {
      console.log('Service role authentication detected');
      isServiceRole = true;
      supabase = createClient(supabaseUrl, serviceRoleKey);
      user = { id: 'service-role' };
    } else {
      const authResult = await verifyAuth(req);
      if (!authResult.authorized || !authResult.user || !authResult.supabase) {
        return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'discovery-analysis', corsHeaders);
      }
      user = authResult.user;
      supabase = authResult.supabase;
    }

    const requestBody = await req.json() as Record<string, unknown>;
    const { documentId, documentText, documentType, partyName } = requestBody as {
      documentId?: string;
      documentText: string;
      documentType?: DiscoveryDocType;
      partyName?: string;
    };

    if (!documentText || typeof documentText !== 'string') {
      throw new Error('documentText is required');
    }

    const docType = (documentType || 'other') as DiscoveryDocType;
    const party = partyName || '';

    console.log(`Analyzing discovery document: type=${docType}, textLength=${documentText.length}`);

    let analysisResult: DiscoveryAnalysisResult;

    if (googleApiKey) {
      try {
        const prompt = buildDiscoveryAnalysisPrompt(documentText, docType, party);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Referer': 'https://supabase.com',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 32768,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const payload = await response.json() as any;
        const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!content) {
          throw new Error('Empty response from Gemini');
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        analysisResult = {
          document_type: parsed.document_type || docType,
          questions_extracted: parsed.questions_extracted || 0,
          questions: parsed.questions || [],
          suggested_responses: parsed.suggested_responses || {},
          objection_analysis: parsed.objection_analysis || {},
          cross_references: parsed.cross_references || [],
          key_admissions: parsed.key_admissions || [],
          potential_impeachment: parsed.potential_impeachment || [],
          timeline_events: parsed.timeline_events || [],
          recommended_strategy: parsed.recommended_strategy || [],
          summary: parsed.summary || '',
        };

        console.log(`Discovery analysis complete: ${analysisResult.questions_extracted} questions extracted`);

      } catch (aiError) {
        console.error('AI analysis error:', aiError);
        throw new Error(`AI analysis failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
      }
    } else {
      throw new Error('Google AI API key not configured');
    }

    if (documentId && isServiceRole) {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          summary: analysisResult.summary,
          key_facts: analysisResult.key_admissions,
          adverse_findings: analysisResult.potential_impeachment,
          action_items: analysisResult.recommended_strategy,
        })
        .eq('id', documentId);

      if (updateError) {
        console.warn('Failed to update document:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...analysisResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Discovery Analysis Error:', error);
    return createErrorResponse(error instanceof Error ? error : new Error('An unknown error occurred'), 500, 'discovery-analysis', getCorsHeaders(req));
  }
});
