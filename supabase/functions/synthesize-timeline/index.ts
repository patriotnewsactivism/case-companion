/**
 * synthesize-timeline
 *
 * Reads every timeline event for a case (including duplicates extracted from
 * multiple documents), uses Gemini 2.5 Pro to:
 *   1. Deduplicate events that refer to the same real-world occurrence
 *   2. Correct dates that are inconsistent with surrounding context
 *   3. Enrich descriptions by merging details from duplicate sources
 *   4. Re-rank importance with full-case context
 *   5. Assign legal phase based on the overall case arc
 *
 * Then upserts the synthesized events back and deletes stale AI duplicates.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, createErrorResponse, validateEnvVars } from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { getDocumentAIProvider, callChatCompletion } from '../_shared/aiConfig.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawEvent {
  id: string;
  event_date: string;
  title: string;
  description: string | null;
  importance: string | null;
  event_type: string | null;
  phase: string;
  entities: unknown;
  linked_document_id: string | null;
  source_document_name: string | null;
  next_required_action: string | null;
  is_verified: boolean | null;
  is_ai_generated: boolean | null;
}

interface SynthesizedEvent {
  event_date: string;           // YYYY-MM-DD
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  event_type: string;
  phase: string;
  entities: string[];
  next_required_action: string;
  source_doc_ids: string[];     // all doc IDs that mentioned this event
  confidence: number;           // 0–1
  merge_notes: string;          // why events were merged
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateOnly(iso: string): string {
  return iso.substring(0, 10);
}

function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/** Group events that share the same date (±2 days) and similar title words */
function buildCandidateClusters(events: RawEvent[]): RawEvent[][] {
  const used = new Set<string>();
  const clusters: RawEvent[][] = [];

  const sorted = [...events].sort((a, b) =>
    toDateOnly(a.event_date).localeCompare(toDateOnly(b.event_date))
  );

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    const cluster: RawEvent[] = [sorted[i]];
    used.add(sorted[i].id);

    const dateA = new Date(sorted[i].event_date).getTime();
    const wordsA = new Set(sorted[i].title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      const dateB = new Date(sorted[j].event_date).getTime();
      const dayDiff = Math.abs(dateA - dateB) / 86_400_000;
      if (dayDiff > 7) break; // events sorted by date; no point scanning further

      const wordsB = sorted[j].title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const overlap = wordsB.filter((w) => wordsA.has(w)).length;
      const similarity = overlap / Math.max(wordsA.size, wordsB.length, 1);

      if (dayDiff <= 3 && similarity >= 0.35) {
        cluster.push(sorted[j]);
        used.add(sorted[j].id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/** Build a concise text representation of an event cluster for the AI prompt */
function clusterToText(cluster: RawEvent[], idx: number): string {
  if (cluster.length === 1) {
    const e = cluster[0];
    return `[${idx}] ${toDateOnly(e.event_date)} | ${e.title} | ${e.importance ?? 'medium'} | ${e.description ?? ''}`;
  }
  const lines = cluster.map(
    (e, ci) =>
      `  [${idx}.${ci}] ${toDateOnly(e.event_date)} | ${e.title} | src:${e.source_document_name ?? 'unknown'} | ${e.description ?? ''}`
  );
  return `[${idx}] DUPLICATE CLUSTER (${cluster.length} docs):\n${lines.join('\n')}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'synthesize-timeline', corsHeaders);
    }

    const { user, supabase } = authResult;
    const body = await req.json() as { caseId?: string; dryRun?: boolean };
    const caseId = validateUUID(body.caseId ?? '', 'caseId');
    const dryRun = body.dryRun === true;

    // ── 1. Load case metadata ──────────────────────────────────────────────
    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('name, case_type, client_name, representation, case_theory, key_issues')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single();

    if (caseErr || !caseData) {
      return createErrorResponse(new Error('Case not found or access denied'), 404, 'synthesize-timeline', corsHeaders);
    }

    // ── 2. Load all timeline events for the case ───────────────────────────
    const { data: events, error: eventsErr } = await supabase
      .from('timeline_events')
      .select('id, event_date, title, description, importance, event_type, phase, entities, linked_document_id, source_document_name, next_required_action, is_verified, is_ai_generated')
      .eq('case_id', caseId)
      .order('event_date', { ascending: true });

    if (eventsErr) {
      return createErrorResponse(new Error(`Failed to load events: ${eventsErr.message}`), 500, 'synthesize-timeline', corsHeaders);
    }

    const rawEvents = (events ?? []) as RawEvent[];
    if (rawEvents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No events to synthesize', synthesized: 0, removed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preserve verified (human-edited) events — never touch them
    const verifiedEvents = rawEvents.filter((e) => e.is_verified === true);
    const aiEvents = rawEvents.filter((e) => e.is_verified !== true);

    console.log(`Loaded ${rawEvents.length} events (${verifiedEvents.length} verified, ${aiEvents.length} AI-generated)`);

    // ── 3. Cluster duplicate candidates ───────────────────────────────────
    const clusters = buildCandidateClusters(aiEvents);
    const duplicateClusters = clusters.filter((c) => c.length > 1);
    const singletonClusters = clusters.filter((c) => c.length === 1);
    console.log(`Clusters: ${clusters.length} total, ${duplicateClusters.length} multi-doc duplicates`);

    // ── 4. Build AI prompt ─────────────────────────────────────────────────
    const caseContext = [
      `Case: ${caseData.name}`,
      `Type: ${caseData.case_type ?? 'Unknown'}`,
      `Client: ${caseData.client_name ?? 'Unknown'}`,
      `Theory: ${caseData.case_theory ?? 'Not specified'}`,
    ].join('\n');

    const eventLines = clusters
      .map((cluster, idx) => clusterToText(cluster, idx))
      .join('\n\n');

    const systemPrompt = `You are a senior litigation analyst performing a cross-document timeline synthesis for a legal case.
Your job is to produce the single most accurate, deduplicated, and enriched timeline possible from raw AI-extracted events.

CASE CONTEXT:
${caseContext}

RULES:
- Merge duplicate-cluster events into ONE canonical entry with the best description.
- Correct dates that are clearly wrong (e.g., a "2023-00-15" or an event dated before the case was filed).
- Re-rank importance: "high" for court dates, filings, injuries, breaches, judgments; "medium" for communications, meetings; "low" for administrative items.
- Assign phase from: pre-suit, pleadings, discovery, dispositive, trial, post-trial.
- For source_doc_ids, list ALL document IDs from the cluster.
- confidence: 0.9+ if date/title are consistent across sources; 0.6-0.89 if only one source; lower if date is approximate.
- merge_notes: brief explanation (e.g., "3 docs agree on date and substance" or "date corrected from 2023-13-01 to 2023-03-01").
- Preserve all singleton events as-is unless clearly OCR junk (page headers, case numbers alone, Bates stamps).
- Return ONLY valid JSON, no prose.`;

    const userPrompt = `Synthesize the following ${clusters.length} event clusters into a clean unified timeline.
Return JSON: { "events": [ { "event_date": "YYYY-MM-DD", "title": "...", "description": "...", "importance": "high|medium|low", "event_type": "...", "phase": "...", "entities": [], "next_required_action": "...", "source_doc_ids": [], "confidence": 0.9, "merge_notes": "..." } ] }

EVENTS:
${eventLines}`;

    // ── 5. Call AI ─────────────────────────────────────────────────────────
    const aiProvider = getDocumentAIProvider();
    const aiResponse = await callChatCompletion(
      aiProvider,
      [{ role: 'user', content: userPrompt }],
      { temperature: 0.1, responseFormat: 'json', systemPrompt }
    );

    let synthesized: SynthesizedEvent[];
    try {
      const parsed = JSON.parse(aiResponse) as { events?: SynthesizedEvent[] };
      synthesized = parsed.events ?? [];
    } catch {
      return createErrorResponse(new Error('AI returned invalid JSON for synthesized timeline'), 500, 'synthesize-timeline', corsHeaders);
    }

    if (synthesized.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'AI returned no events', synthesized: 0, removed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dryRun: true, synthesized: synthesized.length, preview: synthesized.slice(0, 5) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Delete old AI-generated events (keep verified ones) ─────────────
    const aiEventIds = aiEvents.map((e) => e.id);
    if (aiEventIds.length > 0) {
      const { error: delErr } = await supabase
        .from('timeline_events')
        .delete()
        .in('id', aiEventIds);
      if (delErr) {
        console.error('Failed to delete old AI events:', delErr);
      }
    }

    // ── 7. Insert synthesized events ───────────────────────────────────────
    const now = new Date().toISOString();

    // Build a map from doc IDs to the first linked_document_id for FK integrity
    const docIdSet = new Set(aiEvents.map((e) => e.linked_document_id).filter(Boolean));
    const docIdArray = [...docIdSet] as string[];

    const rows = synthesized.map((e) => {
      // Pick the primary linked doc (first source_doc_id that exists in our set)
      const primaryDocId = (e.source_doc_ids ?? []).find((id) => docIdArray.includes(id)) ?? null;
      const eventDate = e.event_date && /^\d{4}-\d{2}-\d{2}$/.test(e.event_date)
        ? new Date(`${e.event_date}T00:00:00.000Z`).toISOString()
        : null;
      if (!eventDate || !e.title?.trim()) return null;

      return {
        case_id: caseId,
        user_id: user.id,
        event_date: eventDate,
        title: e.title.trim().slice(0, 180),
        description: (e.description ?? '').trim().slice(0, 2000),
        importance: ['high', 'medium', 'low'].includes(e.importance) ? e.importance : 'medium',
        event_type: (e.event_type ?? 'general').slice(0, 100),
        phase: ['pre-suit', 'pleadings', 'discovery', 'dispositive', 'trial', 'post-trial'].includes(e.phase)
          ? e.phase
          : 'discovery',
        entities: Array.isArray(e.entities) ? e.entities.slice(0, 20) : [],
        next_required_action: (e.next_required_action ?? '').slice(0, 240) || null,
        linked_document_id: primaryDocId,
        is_ai_generated: true,
        is_verified: false,
        ai_confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.7,
        legal_significance: e.merge_notes?.slice(0, 500) ?? null,
        created_at: now,
        updated_at: now,
      };
    }).filter(Boolean);

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('timeline_events').insert(rows);
      if (insertErr) {
        return createErrorResponse(new Error(`Failed to insert synthesized events: ${insertErr.message}`), 500, 'synthesize-timeline', corsHeaders);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synthesized: rows.length,
        removed: aiEventIds.length,
        duplicatesResolved: duplicateClusters.length,
        singletons: singletonClusters.length,
        verifiedPreserved: verifiedEvents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in synthesize-timeline:', error);
    return createErrorResponse(
      error instanceof Error ? error : new Error(String(error)),
      500,
      'synthesize-timeline',
      corsHeaders
    );
  }
});
