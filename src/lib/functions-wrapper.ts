// Supabase functions wrapper — intercepts AI-related edge function calls
// and routes them to Vercel serverless functions (/api/).
// Falls back to mock responses if API is unavailable.

import { mockChatResponse, mockTrialSimulationResponse } from '@/sandbox/mock-ai';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const AI_FUNCTIONS = new Set([
  'chat',
  'trial-simulation',
  'gemini-proxy',
  'trial-assistant',
  'analyze-evidence',
  'generate-motion',
  'document-aware-chat',
]);

async function callRealAI(functionName: string, body: any): Promise<{ data: any; error: any }> {
  // Map function names to API endpoints
  const endpoint = functionName === 'gemini-proxy' || functionName === 'trial-assistant' || functionName === 'document-aware-chat'
    ? 'chat'
    : functionName;

  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`AI API ${endpoint} returned ${res.status}, falling back to mock`);
      return { data: null, error: { message: `API returned ${res.status}` } };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    console.warn(`AI API ${endpoint} failed, falling back to mock:`, err);
    return { data: null, error: err };
  }
}

function getMockResponse(functionName: string, body: any): any {
  switch (functionName) {
    case 'chat':
    case 'document-aware-chat':
    case 'gemini-proxy':
    case 'trial-assistant':
      return mockChatResponse(body.messages || []);
    case 'trial-simulation':
      return mockTrialSimulationResponse(body);
    case 'analyze-evidence':
      return {
        admissible: true,
        confidence: 0.85,
        hearsayAnalysis: 'Document may qualify as business record under FRE 803(6).',
        authenticationRequirements: ['Custodian testimony', 'Regular course of business'],
        foundationQuestions: ['Are you the custodian of records?'],
        favorableFindings: ['Timeline inconsistencies support case theory'],
        adverseFindings: ['Potential hearsay — prepare exception'],
        keyFacts: ['Key document for case timeline'],
        actionItems: ['Mark as exhibit', 'Prepare foundation'],
      };
    case 'generate-motion':
      return {
        content: `## ${body.motionType || 'Motion'}\n\n## I. INTRODUCTION\n\nThis motion is filed seeking the requested relief.\n\n## II. LEGAL STANDARD\n\nThe applicable standard requires [analysis].\n\n## III. ARGUMENT\n\nThe facts support granting this motion.\n\n## IV. CONCLUSION\n\nFor the foregoing reasons, the motion should be granted.`,
        motionType: body.motionType || 'Motion',
        generatedAt: new Date().toISOString(),
      };
    default:
      return null;
  }
}

export async function invokeFunction(
  functionName: string,
  options?: { body?: any }
): Promise<{ data: any; error: any }> {
  const body = options?.body || {};

  if (AI_FUNCTIONS.has(functionName)) {
    const result = await callRealAI(functionName, body);
    
    if (result.data) {
      // Normalize trial-simulation response
      if (functionName === 'trial-simulation') {
        return {
          data: {
            id: result.data.id,
            message: result.data.characterResponse || result.data.message,
            coaching: result.data.coaching || '',
            objectionTypes: result.data.objection ? [result.data.objection.type] : undefined,
            performanceHints: result.data.hints || undefined,
            questions: result.data.questions || undefined,
            phase: result.data.phase || undefined,
          },
          error: null,
        };
      }
      return result;
    }

    // Fall back to mock
    console.log(`[AI] Using mock response for ${functionName}`);
    const mockData = getMockResponse(functionName, body);
    return { data: mockData, error: null };
  }

  return { data: null, error: { message: `Function ${functionName} not available` } };
}
