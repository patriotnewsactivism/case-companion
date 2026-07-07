/**
 * Supabase client — production mode when real credentials are present.
 * All AI calls go directly to Supabase Edge Functions (no /api/ middleware).
 * Sandbox/mock mode is completely removed.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    '[CaseBuddy] Missing Supabase credentials. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  );
}

// Always production — real Supabase auth + database + edge functions
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'casebuddy-web/1.0',
    },
  },
});

// Deprecated — kept for backward compat imports; always false now
export const SANDBOX_MODE = false;

console.log(
  '%c⚖️ CaseBuddy — Production Mode',
  'font-size:14px;font-weight:bold;color:#22c55e;background:#0f172a;padding:4px 12px;border-radius:4px'
);
console.log(
  `%cConnected to ${SUPABASE_URL}`,
  'color:#64748b;font-size:11px'
);
