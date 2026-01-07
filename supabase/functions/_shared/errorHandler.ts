/**
 * Centralized error handling utilities for edge functions
 */

export interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
}

// Phase 1D: CORS Hardening
const BASE_ALLOWED_ORIGINS = [
  'https://plcvjadartxntnurhcua.lovableproject.com', // Lovable project URL (current)
  'https://casebuddypro.lovable.app', // Production domain
  'http://localhost:8080', // Development
  'http://localhost:5173', // Vite dev server alternative port
];

const ENV_ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(
  new Set([...BASE_ALLOWED_ORIGINS, ...ENV_ALLOWED_ORIGINS])
);

/**
 * Get CORS headers based on request origin
 * Returns allowed origin only if it's in the whitelist
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const environment = Deno.env.get('ENVIRONMENT') || 'production';

  // In development, allow localhost
  const isAllowedOrigin = !!origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    (environment === 'development' && origin.startsWith('http://localhost')) ||
    origin.includes('.lovable.app') || // Allow all Lovable domains
    origin.includes('.lovableproject.com') // Allow all Lovable project domains
  );

  const allowOrigin = isAllowedOrigin ? origin : (origin ? 'null' : '*');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': isAllowedOrigin ? 'true' : 'false',
    'Vary': 'Origin',
  };
}

// Legacy export for backward compatibility (will be removed)
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500,
  context?: string,
  corsHeadersOverride: Record<string, string> = corsHeaders
): Response {
  const timestamp = new Date().toISOString();

  let errorMessage = 'Unknown error occurred';
  let errorDetails: string | undefined;
  let errorCode: string | undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack;
    if ('code' in error) {
      const codeValue = (error as { code?: unknown }).code;
      if (typeof codeValue === 'string') {
        errorCode = codeValue;
      }
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Log error for monitoring
  console.error(`[${timestamp}] ${context ? `[${context}] ` : ''}Error:`, {
    message: errorMessage,
    code: errorCode,
    details: errorDetails,
  });

  const responseBody: ErrorResponse = {
    error: errorMessage,
    timestamp,
  };

  // Only include details in development/staging
  if (Deno.env.get('ENVIRONMENT') !== 'production') {
    responseBody.details = errorDetails;
    responseBody.code = errorCode;
  }

  return new Response(
    JSON.stringify(responseBody),
    {
      status: statusCode,
      headers: { ...corsHeadersOverride, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => !Deno.env.get(varName));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Validate request body has required fields
 */
export function validateRequestBody<T>(
  body: Record<string, unknown>,
  requiredFields: (keyof T)[]
): asserts body is T {
  const missing = requiredFields.filter(field => !(field in body) || body[field] === undefined);

  if (missing.length > 0) {
    throw new Error(
      `Missing required fields in request body: ${missing.join(', ')}`
    );
  }
}

/**
 * Wrap an async handler with standardized error handling
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>,
  context?: string
) {
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: getCorsHeaders(req) });
    }

    try {
      return await handler(req);
    } catch (error) {
      return createErrorResponse(error, 500, context, getCorsHeaders(req));
    }
  };
}

/**
 * Rate limiting helper (simple in-memory implementation)
 * For production, use Redis or Supabase rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetAt < now) {
    // Create new window
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

/**
 * Clean old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute
