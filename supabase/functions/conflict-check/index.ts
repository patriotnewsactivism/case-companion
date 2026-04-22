import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
} from "../_shared/errorHandler.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { sanitizeString } from "../_shared/validation.ts";

interface ConflictCheckRequest {
  clientName: string;
  opposingParty?: string;
  additionalParties?: string[];
  caseType?: string;
}

interface ConflictMatch {
  caseId: string;
  caseName: string;
  caseNumber: string | null;
  caseStatus: string | null;
  matchedField: string;
  matchedValue: string;
  searchedName: string;
  matchType: "exact" | "substring" | "similarity";
  similarityScore: number;
  conflictType: "direct" | "adverse";
}

/**
 * Calculate a simple similarity score between two strings (Dice coefficient).
 * Used as a fallback when pg_trgm similarity() is not available.
 */
function diceCoefficient(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim();
  const bNorm = b.toLowerCase().trim();

  if (aNorm === bNorm) return 1.0;
  if (aNorm.length < 2 || bNorm.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < aNorm.length - 1; i++) {
    bigramsA.add(aNorm.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < bNorm.length - 1; i++) {
    bigramsB.add(bNorm.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigramsB) {
    if (bigramsA.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Search cases table for matches against a given name using ILIKE.
 * Returns raw rows for post-processing.
 */
async function searchCasesIlike(
  supabase: ReturnType<typeof createClient>,
  searchName: string
): Promise<Record<string, unknown>[]> {
  const pattern = `%${searchName}%`;

  // Search client_name
  const { data: clientMatches } = await supabase
    .from("cases")
    .select("id, name, case_number, status, client_name, opposing_party")
    .ilike("client_name", pattern);

  // Search opposing_party
  const { data: opposingMatches } = await supabase
    .from("cases")
    .select("id, name, case_number, status, client_name, opposing_party")
    .ilike("opposing_party", pattern);

  // Deduplicate by case id
  const seen = new Set<string>();
  const results: Record<string, unknown>[] = [];

  for (const row of [...(clientMatches || []), ...(opposingMatches || [])]) {
    const id = row.id as string;
    if (!seen.has(id)) {
      seen.add(id);
      results.push(row);
    }
  }

  return results;
}

/**
 * Try pg_trgm similarity search. Returns null if pg_trgm is not available.
 */
async function searchCasesSimilarity(
  supabase: ReturnType<typeof createClient>,
  searchName: string,
  threshold: number
): Promise<Record<string, unknown>[] | null> {
  try {
    // Attempt similarity search on client_name via raw RPC
    const { data, error } = await supabase.rpc("search_cases_by_similarity", {
      search_term: searchName,
      similarity_threshold: threshold,
    });

    if (error) {
      // pg_trgm likely not enabled or function doesn't exist - fall back
      console.warn("Similarity search unavailable:", error.message);
      return null;
    }

    return data as Record<string, unknown>[];
  } catch {
    return null;
  }
}

/**
 * Search depositions table for deponent name matches
 */
async function searchDepositions(
  supabase: ReturnType<typeof createClient>,
  searchName: string
): Promise<ConflictMatch[]> {
  const pattern = `%${searchName}%`;
  const matches: ConflictMatch[] = [];

  const { data: depoMatches } = await supabase
    .from("depositions")
    .select("id, case_id, deponent_name, cases(id, name, case_number, status)")
    .ilike("deponent_name", pattern);

  if (depoMatches) {
    for (const depo of depoMatches) {
      const caseInfo = depo.cases as Record<string, unknown> | null;
      const deponentName = (depo.deponent_name as string) || "";
      const score = diceCoefficient(searchName, deponentName);

      matches.push({
        caseId: (depo.case_id as string) || "",
        caseName: (caseInfo?.name as string) || "Unknown Case",
        caseNumber: (caseInfo?.case_number as string) || null,
        caseStatus: (caseInfo?.status as string) || null,
        matchedField: "depositions.deponent_name",
        matchedValue: deponentName,
        searchedName: searchName,
        matchType: deponentName.toLowerCase() === searchName.toLowerCase() ? "exact" : "substring",
        similarityScore: score,
        conflictType: "direct",
      });
    }
  }

  return matches;
}

/**
 * Search witness_prep table for witness name matches
 */
async function searchWitnesses(
  supabase: ReturnType<typeof createClient>,
  searchName: string
): Promise<ConflictMatch[]> {
  const pattern = `%${searchName}%`;
  const matches: ConflictMatch[] = [];

  const { data: witnessMatches } = await supabase
    .from("witness_prep")
    .select("id, case_id, witness_name, cases(id, name, case_number, status)")
    .ilike("witness_name", pattern);

  if (witnessMatches) {
    for (const w of witnessMatches) {
      const caseInfo = w.cases as Record<string, unknown> | null;
      const witnessName = (w.witness_name as string) || "";
      const score = diceCoefficient(searchName, witnessName);

      matches.push({
        caseId: (w.case_id as string) || "",
        caseName: (caseInfo?.name as string) || "Unknown Case",
        caseNumber: (caseInfo?.case_number as string) || null,
        caseStatus: (caseInfo?.status as string) || null,
        matchedField: "witness_prep.witness_name",
        matchedValue: witnessName,
        searchedName: searchName,
        matchType: witnessName.toLowerCase() === searchName.toLowerCase() ? "exact" : "substring",
        similarityScore: score,
        conflictType: "direct",
      });
    }
  }

  return matches;
}

/**
 * Process case rows into ConflictMatch records for a given search name
 */
function processCaseMatches(
  cases: Record<string, unknown>[],
  searchName: string,
  searchRole: "client" | "opposing"
): ConflictMatch[] {
  const matches: ConflictMatch[] = [];

  for (const c of cases) {
    const clientName = (c.client_name as string) || "";
    const opposingParty = (c.opposing_party as string) || "";
    const searchLower = searchName.toLowerCase();

    // Check client_name field
    if (clientName && clientName.toLowerCase().includes(searchLower)) {
      const isExact = clientName.toLowerCase() === searchLower;
      const score = diceCoefficient(searchName, clientName);

      matches.push({
        caseId: c.id as string,
        caseName: (c.name as string) || "Untitled Case",
        caseNumber: (c.case_number as string) || null,
        caseStatus: (c.status as string) || null,
        matchedField: "cases.client_name",
        matchedValue: clientName,
        searchedName: searchName,
        matchType: isExact ? "exact" : "substring",
        similarityScore: score,
        // If we searched a client name and matched a client_name, it's direct;
        // if we searched an opposing party and matched a client_name, it's adverse
        conflictType: searchRole === "client" ? "direct" : "adverse",
      });
    }

    // Check opposing_party field
    if (opposingParty && opposingParty.toLowerCase().includes(searchLower)) {
      const isExact = opposingParty.toLowerCase() === searchLower;
      const score = diceCoefficient(searchName, opposingParty);

      matches.push({
        caseId: c.id as string,
        caseName: (c.name as string) || "Untitled Case",
        caseNumber: (c.case_number as string) || null,
        caseStatus: (c.status as string) || null,
        matchedField: "cases.opposing_party",
        matchedValue: opposingParty,
        searchedName: searchName,
        matchType: isExact ? "exact" : "substring",
        similarityScore: score,
        // If we searched a client name and matched opposing_party, it's adverse;
        // if we searched an opposing party and matched opposing_party, it's direct
        conflictType: searchRole === "client" ? "adverse" : "direct",
      });
    }
  }

  return matches;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

    // Authenticate user
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || "Unauthorized"),
        401,
        "conflict-check",
        corsHeaders
      );
    }

    const body: ConflictCheckRequest = await req.json();
    const { clientName, opposingParty, additionalParties, caseType } = body;

    // Validate clientName is provided
    if (!clientName) {
      return new Response(
        JSON.stringify({ error: "clientName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedClientName = sanitizeString(clientName, "clientName", 500);

    const userId = authResult.user.id;

    // Use service role client for cross-user conflict checks
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const allConflicts: ConflictMatch[] = [];
    const SIMILARITY_THRESHOLD = 0.3;

    // Build the list of names to search
    const namesToSearch: Array<{ name: string; role: "client" | "opposing" }> = [
      { name: sanitizedClientName, role: "client" },
    ];

    if (opposingParty) {
      namesToSearch.push({
        name: sanitizeString(opposingParty, "opposingParty", 500),
        role: "opposing",
      });
    }

    if (additionalParties && Array.isArray(additionalParties)) {
      for (const party of additionalParties) {
        if (typeof party === "string" && party.trim()) {
          namesToSearch.push({
            name: sanitizeString(party, "additionalParty", 500),
            role: "client", // Additional parties treated as client-side for conflict purposes
          });
        }
      }
    }

    let totalChecked = 0;

    // Search each name against cases, depositions, and witnesses
    for (const { name, role } of namesToSearch) {
      // Try pg_trgm similarity search first
      const similarityResults = await searchCasesSimilarity(
        supabase,
        name,
        SIMILARITY_THRESHOLD
      );

      if (similarityResults && similarityResults.length > 0) {
        // Process similarity results
        const simMatches = processCaseMatches(similarityResults, name, role);
        // Override match type to "similarity" for pg_trgm results
        for (const m of simMatches) {
          m.matchType = "similarity";
        }
        allConflicts.push(...simMatches);
        totalChecked += similarityResults.length;
      }

      // Always do ILIKE fallback (catches cases similarity might miss)
      const ilikeResults = await searchCasesIlike(supabase, name);
      totalChecked += ilikeResults.length;

      const ilikeMatches = processCaseMatches(ilikeResults, name, role);
      allConflicts.push(...ilikeMatches);

      // Search depositions and witnesses
      const [depoMatches, witnessMatches] = await Promise.all([
        searchDepositions(supabase, name),
        searchWitnesses(supabase, name),
      ]);

      allConflicts.push(...depoMatches);
      allConflicts.push(...witnessMatches);
    }

    // Deduplicate conflicts by caseId + matchedField + matchedValue + searchedName
    const deduped = new Map<string, ConflictMatch>();
    for (const conflict of allConflicts) {
      const key = `${conflict.caseId}:${conflict.matchedField}:${conflict.matchedValue}:${conflict.searchedName}`;
      const existing = deduped.get(key);
      if (!existing || conflict.similarityScore > existing.similarityScore) {
        deduped.set(key, conflict);
      }
    }

    const uniqueConflicts = Array.from(deduped.values()).sort(
      (a, b) => b.similarityScore - a.similarityScore
    );

    // Determine overall status
    const hasExactMatch = uniqueConflicts.some((c) => c.matchType === "exact");
    const hasSubstringMatch = uniqueConflicts.some(
      (c) => c.matchType === "substring" || c.matchType === "similarity"
    );

    let status: "clear" | "conflict" | "potential";
    if (hasExactMatch) {
      status = "conflict";
    } else if (hasSubstringMatch) {
      status = "potential";
    } else {
      status = "clear";
    }

    // Log the check to conflict_checks audit table
    let checkId: string | null = null;
    try {
      const { data: checkRecord } = await supabase
        .from("conflict_checks")
        .insert({
          user_id: userId,
          client_name: sanitizedClientName,
          opposing_party: opposingParty || null,
          additional_parties: additionalParties || [],
          case_type: caseType || null,
          status,
          conflicts_found: uniqueConflicts.length,
          results: uniqueConflicts,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      checkId = (checkRecord?.id as string) || null;
    } catch (auditError) {
      // Audit logging failure should not block the response
      console.warn("Failed to log conflict check audit:", auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        conflicts: uniqueConflicts,
        totalChecked,
        checkId: checkId || crypto.randomUUID(),
        status,
        searchedNames: namesToSearch.map((n) => n.name),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("conflict-check error:", e);
    return createErrorResponse(e, 500, "conflict-check", corsHeaders);
  }
});
