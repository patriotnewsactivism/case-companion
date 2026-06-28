/**
 * Thin wrapper around supabase.functions.invoke().
 * All AI calls go directly to Supabase Edge Functions — no /api/ middleware,
 * no mock fallback. Errors surface as thrown exceptions so callers can handle
 * them with toast notifications.
 */

import { supabase } from '@/integrations/supabase/client';

export interface InvokeFunctionOptions {
  body?: Record<string, unknown>;
}

export async function invokeFunction(
  functionName: string,
  options?: InvokeFunctionOptions
): Promise<{ data: unknown; error: null }> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: options?.body,
  });

  if (error) {
    const message =
      typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : String(error);
    throw new Error(`[${functionName}] ${message}`);
  }

  return { data, error: null };
}
