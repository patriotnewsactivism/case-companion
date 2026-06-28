// Supabase client — sandbox mode uses mock data + real AI via /api/.
// In production with real credentials, uses real Supabase auth + database.
// AI edge function calls are ALWAYS intercepted and routed to /api/ serverless functions.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { mockSupabaseClient } from '@/sandbox/mock-supabase';
import { invokeFunction as aiInvoke } from '@/lib/functions-wrapper';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasRealCredentials =
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_PUBLISHABLE_KEY.includes('placeholder') &&
  !SUPABASE_URL.includes('your-project');

// Force sandbox mode for demo: mock data + real AI
// Set VITE_FORCE_REAL_AUTH=true in .env to use real Supabase auth
const FORCE_REAL_AUTH = import.meta.env.VITE_FORCE_REAL_AUTH === 'true';

// Sandbox mode = use mock data with demo user auto-login
// AI is always routed to real API regardless of this flag
export const SANDBOX_MODE = FORCE_REAL_AUTH ? !hasRealCredentials : true;

// AI function names that should always go through the /api/ wrapper
const AI_FUNCTIONS = new Set([
  'chat',
  'trial-simulation',
  'gemini-proxy',
  'trial-assistant',
  'analyze-evidence',
  'generate-motion',
  'document-aware-chat',
]);

// Create a proxy that intercepts .functions.invoke for AI calls
function wrapFunctions(client: any) {
  if (!client?.functions?.invoke) return client;

  const originalInvoke = client.functions.invoke.bind(client.functions);
  
  client.functions.invoke = async (functionName: string, options?: { body?: any }) => {
    // AI functions → route to /api/ serverless functions (real GPT-4o)
    if (AI_FUNCTIONS.has(functionName)) {
      return aiInvoke(functionName, options);
    }
    // Non-AI functions → pass through to underlying client
    return originalInvoke(functionName, options);
  };

  return client;
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const baseClient = !SANDBOX_MODE && hasRealCredentials
  ? createClient<Database>(SUPABASE_URL as string, SUPABASE_PUBLISHABLE_KEY as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : (mockSupabaseClient as any);

// Wrap the client to intercept AI edge function calls
export const supabase = wrapFunctions(baseClient);

if (SANDBOX_MODE) {
  console.log(
    '%c⚖️ CaseBuddy Demo Mode Active',
    'font-size:14px;font-weight:bold;color:#c9a227;background:#1a1a2e;padding:4px 12px;border-radius:4px'
  );
  console.log('%cMock data for cases/documents • Real AI via /api/ for chat, trial sim, evidence analysis.', 'color:#888;font-size:12px');
} else {
  console.log('%c⚖️ CaseBuddy Production Mode — Real Supabase + Real AI', 'font-size:14px;font-weight:bold;color:#22c55e;background:#1a1a2e;padding:4px 12px;border-radius:4px');
}
