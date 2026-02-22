import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { validateEmail, sanitizeString, validateUUID } from '../_shared/validation.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, getNumericDate, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_ANON_KEY') || 'fallback-secret-key';
const MAGIC_LINK_EXPIRY_HOURS = 24;
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type AccessLevel = 'view' | 'comment' | 'upload' | 'full';
type AuthAction = 'login' | 'magic-link' | 'verify-magic' | 'reset-password' | 'logout';

interface ClientPortalUser {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  case_id: string;
  access_level: AccessLevel;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface MagicLink {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface LoginRequest {
  action: 'login';
  email: string;
  password: string;
  caseId?: string;
}

interface MagicLinkRequest {
  action: 'magic-link';
  email: string;
  caseId: string;
}

interface VerifyMagicRequest {
  action: 'verify-magic';
  token: string;
}

interface ResetPasswordRequest {
  action: 'reset-password';
  email: string;
}

interface LogoutRequest {
  action: 'logout';
}

type AuthRequest = LoginRequest | MagicLinkRequest | VerifyMagicRequest | ResetPasswordRequest | LogoutRequest;

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    caseId: string;
    accessLevel: string;
  };
  error?: string;
  message?: string;
}

interface JwtPayload {
  sub: string;
  role: 'client';
  case_id: string;
  access_level: AccessLevel;
  exp: number;
  iat: number;
}

async function getJwtKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function generateJwt(
  userId: string,
  caseId: string,
  accessLevel: AccessLevel,
  expiresInSeconds: number = 60 * 60 * 24 * 7
): Promise<string> {
  const key = await getJwtKey();
  const now = Math.floor(Date.now() / 1000);
  
  const payload: JwtPayload = {
    sub: userId,
    role: 'client',
    case_id: caseId,
    access_level: accessLevel,
    exp: now + expiresInSeconds,
    iat: now,
  };

  return await create({ alg: 'HS256', typ: 'JWT' }, payload, key);
}

async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const key = await getJwtKey();
    const payload = await verify(token, key);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json() as AuthRequest;
    const action = body.action;

    switch (action) {
      case 'login': {
        const { email, password, caseId } = body as LoginRequest;
        const normalizedEmail = validateEmail(email);
        
        if (!password || typeof password !== 'string') {
          return new Response(
            JSON.stringify({ success: false, error: 'Password is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const rateLimitKey = `login:${normalizedEmail}`;
        const rateLimit = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS);
        
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Too many login attempts. Please try again later.',
              resetAt: new Date(rateLimit.resetAt).toISOString(),
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase
          .from('client_portal_users')
          .select('*')
          .eq('email', normalizedEmail)
          .eq('is_active', true);

        if (caseId) {
          query = query.eq('case_id', validateUUID(caseId, 'caseId'));
        }

        const { data: users, error: userError } = await query;

        if (userError) {
          console.error('Database error:', userError);
          return new Response(
            JSON.stringify({ success: false, error: 'Authentication failed' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!users || users.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid credentials' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const user = users[0] as unknown as ClientPortalUser;

        if (!user.password_hash) {
          return new Response(
            JSON.stringify({ success: false, error: 'Password not set. Please use magic link login.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordValid) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid credentials' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('client_portal_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id);

        const token = await generateJwt(user.id, user.case_id, user.access_level);

        const response: AuthResponse = {
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            caseId: user.case_id,
            accessLevel: user.access_level,
          },
        };

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'magic-link': {
        const { email, caseId } = body as MagicLinkRequest;
        const normalizedEmail = validateEmail(email);
        const validatedCaseId = validateUUID(caseId, 'caseId');

        const rateLimitKey = `magic-link:${normalizedEmail}`;
        const rateLimit = checkRateLimit(rateLimitKey, 3, LOGIN_RATE_LIMIT_WINDOW_MS);
        
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Too many magic link requests. Please try again later.',
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: user, error: userError } = await supabase
          .from('client_portal_users')
          .select('*')
          .eq('email', normalizedEmail)
          .eq('case_id', validatedCaseId)
          .eq('is_active', true)
          .single();

        if (userError || !user) {
          return new Response(
            JSON.stringify({ success: true, message: 'If an account exists, a magic link has been sent.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const portalUser = user as unknown as ClientPortalUser;
        const token = generateSecureToken();
        const tokenHash = await hashToken(token);
        const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

        await supabase
          .from('client_magic_links')
          .insert({
            user_id: portalUser.id,
            token: tokenHash,
            expires_at: expiresAt,
          });

        console.log(`Magic link generated for ${normalizedEmail}: ${token}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'If an account exists, a magic link has been sent.',
            _devToken: Deno.env.get('ENVIRONMENT') === 'development' ? token : undefined,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify-magic': {
        const { token } = body as VerifyMagicRequest;
        
        if (!token || typeof token !== 'string') {
          return new Response(
            JSON.stringify({ success: false, error: 'Token is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedToken = sanitizeString(token, 'token', 128);
        const tokenHash = await hashToken(sanitizedToken);

        const { data: magicLink, error: linkError } = await supabase
          .from('client_magic_links')
          .select('*')
          .eq('token', tokenHash)
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (linkError || !magicLink) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid or expired magic link' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const link = magicLink as unknown as MagicLink;

        await supabase
          .from('client_magic_links')
          .update({ used_at: new Date().toISOString() })
          .eq('id', link.id);

        const { data: user, error: userError } = await supabase
          .from('client_portal_users')
          .select('*')
          .eq('id', link.user_id)
          .eq('is_active', true)
          .single();

        if (userError || !user) {
          return new Response(
            JSON.stringify({ success: false, error: 'User not found or inactive' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const portalUser = user as unknown as ClientPortalUser;

        await supabase
          .from('client_portal_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', portalUser.id);

        const jwtToken = await generateJwt(portalUser.id, portalUser.case_id, portalUser.access_level);

        const response: AuthResponse = {
          success: true,
          token: jwtToken,
          user: {
            id: portalUser.id,
            name: portalUser.name,
            email: portalUser.email,
            caseId: portalUser.case_id,
            accessLevel: portalUser.access_level,
          },
        };

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset-password': {
        const { email } = body as ResetPasswordRequest;
        const normalizedEmail = validateEmail(email);

        const rateLimitKey = `reset-password:${normalizedEmail}`;
        const rateLimit = checkRateLimit(rateLimitKey, 3, LOGIN_RATE_LIMIT_WINDOW_MS);
        
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Too many reset requests. Please try again later.',
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: user } = await supabase
          .from('client_portal_users')
          .select('id')
          .eq('email', normalizedEmail)
          .eq('is_active', true)
          .single();

        if (user) {
          const token = generateSecureToken();
          const tokenHash = await hashToken(token);
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

          await supabase
            .from('client_password_resets')
            .insert({
              user_id: user.id,
              token: tokenHash,
              expires_at: expiresAt,
            });

          console.log(`Password reset token generated for ${normalizedEmail}: ${token}`);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'If an account exists, a password reset link has been sent.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        const authHeader = req.headers.get('Authorization');
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          const payload = await verifyJwt(token);
          
          if (payload) {
            const expiresAt = new Date(payload.exp * 1000).toISOString();
            await supabase
              .from('token_blacklist')
              .insert({
                token_hash: await hashToken(token),
                expires_at: expiresAt,
              });
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Logged out successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('client-auth error:', error);
    return createErrorResponse(error, 500, 'client-auth', corsHeaders);
  }
});