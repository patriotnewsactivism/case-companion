/**
 * tts-generate — ElevenLabs TTS proxy with per-character voice mapping.
 *
 * Accepts: { text: string; character: string; stability?: number; similarityBoost?: number }
 * Returns: audio/mpeg binary
 *
 * Set Supabase secret:
 *   npx supabase secrets set ELEVENLABS_API_KEY=<your_key>
 *
 * Character → ElevenLabs voice:
 *   judge            → Adam    (pNInz6obpgDQGcFmaJgB) — deep, authoritative
 *   witness          → Bella   (EXAVITQu4vr4xnSDxMaL) — neutral female
 *   opposing counsel → Arnold  (VR6AewLTigWG4xSOukaG) — assertive male
 *   court clerk      → Rachel  (21m00Tcm4TlvDq8ikWAM) — professional female
 *   potential juror  → Domi    (AZnzlk1XvdvUeBnXmlld) — casual
 *   deponent         → Antoni  (ErXwobaYiN019PkySvjV) — measured male
 *
 * Agent characters:
 *   maya → Bella  (warm, professional intake specialist)
 *   rex  → Adam   (authoritative, energetic trial coach)
 *   doc  → Rachel (precise, methodical drafting attorney)
 *   lex  → Antoni (scholarly, measured research lead)
 *   sol  → Rachel (sharp, efficient deadlines tracker)
 *   sierra → Bella (friendly, approachable client relations)
 *   jules → Domi  (perceptive, curious jury psychologist)
 *   max  → Antoni (thorough, methodical filing clerk)
 *   default          → Adam    (pNInz6obpgDQGcFmaJgB)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, createErrorResponse } from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
// eleven_turbo_v2_5 = lowest latency; swap for eleven_multilingual_v2 for higher quality
const TTS_MODEL = 'eleven_turbo_v2_5';

interface VoiceProfile {
  voiceId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

const VOICE_MAP: Record<string, VoiceProfile> = {
  judge: {
    voiceId: 'pNInz6obpgDQGcFmaJgB',   // Adam — deep, measured authority
    stability: 0.80, similarityBoost: 0.85, style: 0.10, useSpeakerBoost: true,
  },
  witness: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',   // Bella — neutral, slightly nervous
    stability: 0.55, similarityBoost: 0.75, style: 0.20, useSpeakerBoost: false,
  },
  'opposing counsel': {
    voiceId: 'VR6AewLTigWG4xSOukaG',   // Arnold — assertive, combative
    stability: 0.70, similarityBoost: 0.80, style: 0.25, useSpeakerBoost: true,
  },
  'court clerk': {
    voiceId: '21m00Tcm4TlvDq8ikWAM',   // Rachel — professional, efficient
    stability: 0.85, similarityBoost: 0.80, style: 0.05, useSpeakerBoost: false,
  },
  'potential juror': {
    voiceId: 'AZnzlk1XvdvUeBnXmlld',   // Domi — casual, opinionated
    stability: 0.50, similarityBoost: 0.70, style: 0.30, useSpeakerBoost: false,
  },
  deponent: {
    voiceId: 'ErXwobaYiN019PkySvjV',   // Antoni — measured, cautious
    stability: 0.65, similarityBoost: 0.75, style: 0.15, useSpeakerBoost: false,
  },
  // Agent character mappings
  maya: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',   // Bella — warm, professional female
    stability: 0.70, similarityBoost: 0.80, style: 0.15, useSpeakerBoost: false,
  },
  rex: {
    voiceId: 'pNInz6obpgDQGcFmaJgB',    // Adam — authoritative, energetic
    stability: 0.75, similarityBoost: 0.85, style: 0.30, useSpeakerBoost: true,
  },
  doc: {
    voiceId: '21m00Tcm4TlvDq8ikWAM',   // Rachel — precise, professional
    stability: 0.80, similarityBoost: 0.85, style: 0.10, useSpeakerBoost: false,
  },
  lex: {
    voiceId: 'ErXwobaYiN019PkySvjV',    // Antoni — scholarly, measured
    stability: 0.75, similarityBoost: 0.80, style: 0.10, useSpeakerBoost: false,
  },
  sol: {
    voiceId: '21m00Tcm4TlvDq8ikWAM',    // Rachel — sharp, efficient
    stability: 0.70, similarityBoost: 0.75, style: 0.20, useSpeakerBoost: false,
  },
  sierra: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',    // Bella — friendly, approachable
    stability: 0.65, similarityBoost: 0.75, style: 0.25, useSpeakerBoost: false,
  },
  jules: {
    voiceId: 'AZnzlk1XvdvUeBnXmlld',    // Domi — perceptive, curious
    stability: 0.55, similarityBoost: 0.70, style: 0.35, useSpeakerBoost: false,
  },
  max: {
    voiceId: 'ErXwobaYiN019PkySvjV',    // Antoni — thorough, methodical
    stability: 0.85, similarityBoost: 0.80, style: 0.05, useSpeakerBoost: false,
  },
  default: {
    voiceId: 'pNInz6obpgDQGcFmaJgB',   // Adam
    stability: 0.70, similarityBoost: 0.75, style: 0.10, useSpeakerBoost: false,
  },
};

function getProfile(character: string): VoiceProfile {
  return VOICE_MAP[character.toLowerCase().trim()] ?? VOICE_MAP.default;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[*_`#>~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);   // ElevenLabs max per request
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user) {
      return createErrorResponse(
        new Error(authResult.error ?? 'Unauthorized'),
        401,
        'tts-generate',
        corsHeaders
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return createErrorResponse(
        new Error('ElevenLabs is not configured. Set ELEVENLABS_API_KEY in Supabase secrets.'),
        503,
        'tts-generate',
        corsHeaders
      );
    }

    const body = await req.json() as {
      text?: string;
      character?: string;
      stability?: number;
      similarityBoost?: number;
    };

    const rawText = body.text?.trim();
    if (!rawText) {
      return createErrorResponse(
        new Error('text is required'),
        400,
        'tts-generate',
        corsHeaders
      );
    }

    const text = sanitizeText(rawText);
    const character = body.character ?? 'default';
    const profile = getProfile(character);
    const stability = body.stability ?? profile.stability;
    const similarityBoost = body.similarityBoost ?? profile.similarityBoost;

    const ttsRes = await fetch(
      `${ELEVENLABS_API}/text-to-speech/${profile.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: TTS_MODEL,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style: profile.style,
            use_speaker_boost: profile.useSpeakerBoost,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => ttsRes.statusText);
      console.error(`[tts-generate] ElevenLabs ${ttsRes.status}: ${errText}`);
      return createErrorResponse(
        new Error(`TTS generation failed (${ttsRes.status}): ${errText}`),
        ttsRes.status === 401 ? 401 : 502,
        'tts-generate',
        corsHeaders
      );
    }

    // Pipe audio buffer straight back to the client
    const audioBuffer = await ttsRes.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Voice-Id': profile.voiceId,
        'X-Character': character,
      },
    });
  } catch (err) {
    console.error('[tts-generate] Unexpected error:', err);
    return createErrorResponse(
      err instanceof Error ? err : new Error(String(err)),
      500,
      'tts-generate',
      corsHeaders
    );
  }
});
