/**
 * Case Knowledge Hub
 *
 * Aggregates all analyzed document data for a case into a unified
 * knowledge context that any module can consume. This is the centralized
 * "brain" that trial simulation, strategy, discovery, and all other
 * modules pull from.
 *
 * Inspired by the KnowledgeContext pattern from Casebuddy-AI-Trial-Prep,
 * but backed by the real Supabase database instead of localStorage.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CaseEntity {
  name: string;
  type: "person" | "organization" | "date" | "location" | "amount" | "statute" | "case-citation" | "other";
  context: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
}

export interface CaseFact {
  fact: string;
  significance: "favorable" | "adverse" | "neutral";
  source: string;
  sourceDocumentId: string;
}

export interface CaseTimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  importance: string;
  eventType: string;
  linkedDocumentId: string | null;
  linkedDocumentName: string | null;
}

export interface CaseDocumentSummary {
  id: string;
  name: string;
  aiSuggestedName: string | null;
  documentType: string | null;
  documentDate: string | null;
  batesNumber: string | null;
  summary: string | null;
  classification: string | null;
  keyFacts: string[];
  favorableFindings: string[];
  adverseFindings: string[];
  actionItems: string[];
  ocrProvider: string | null;
  aiAnalyzed: boolean;
}

export interface CaseKnowledge {
  caseId: string;
  caseName: string;
  caseType: string;
  documents: CaseDocumentSummary[];
  entities: CaseEntity[];
  facts: CaseFact[];
  timeline: CaseTimelineEvent[];
  favorableFactors: string[];
  adverseFactors: string[];
  actionItems: string[];
  documentCount: number;
  analyzedCount: number;
  lastUpdated: string;
}

// ─── Knowledge Aggregation ───────────────────────────────────────────────────

/**
 * Build a complete knowledge context for a case.
 * This pulls from documents, timeline_events, and case metadata.
 */
export async function buildCaseKnowledge(caseId: string): Promise<CaseKnowledge> {
  // Fetch case metadata
  const { data: caseData, error: caseError } = await (supabase as any)
    .from("cases")
    .select("id, name, case_type, case_theory, key_issues, winning_factors")
    .eq("id", caseId)
    .single();

  if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

  // Fetch all documents with their analysis
  const { data: documents, error: docError } = await (supabase as any)
    .from("documents")
    .select(
      "id, name, ai_suggested_name, document_type, document_date, bates_number, " +
      "summary, key_facts, favorable_findings, adverse_findings, action_items, " +
      "ocr_provider, ai_analyzed, entities, ocr_text, created_at"
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (docError) throw new Error(`Failed to fetch documents: ${docError.message}`);

  // Fetch timeline events
  const { data: timelineData, error: timelineError } = await (supabase as any)
    .from("timeline_events")
    .select("id, event_date, title, description, importance, event_type, linked_document_id")
    .eq("case_id", caseId)
    .order("event_date", { ascending: true });

  if (timelineError) {
    console.warn("Failed to fetch timeline events:", timelineError.message);
  }

  const docs = (documents || []) as any[];
  const events = (timelineData || []) as any[];

  // Build document summaries
  const documentSummaries: CaseDocumentSummary[] = docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    aiSuggestedName: doc.ai_suggested_name || null,
    documentType: doc.document_type || null,
    documentDate: doc.document_date || null,
    batesNumber: doc.bates_number || null,
    summary: doc.summary || null,
    classification: null,
    keyFacts: doc.key_facts || [],
    favorableFindings: doc.favorable_findings || [],
    adverseFindings: doc.adverse_findings || [],
    actionItems: doc.action_items || [],
    ocrProvider: doc.ocr_provider || null,
    aiAnalyzed: doc.ai_analyzed || false,
  }));

  // Aggregate entities from all documents
  const allEntities: CaseEntity[] = [];
  for (const doc of docs) {
    if (doc.entities && Array.isArray(doc.entities)) {
      for (const entity of doc.entities) {
        allEntities.push({
          name: entity.name || entity.text || "",
          type: entity.type || "other",
          context: entity.context || "",
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.ai_suggested_name || doc.name,
        });
      }
    }
  }

  // Aggregate facts from key_facts across documents
  const allFacts: CaseFact[] = [];
  for (const doc of docs) {
    if (doc.key_facts && Array.isArray(doc.key_facts)) {
      for (const fact of doc.key_facts) {
        const factStr = typeof fact === "string" ? fact : (fact as any).fact || JSON.stringify(fact);
        const sig = typeof fact === "object" && (fact as any).significance
          ? (fact as any).significance
          : "neutral";
        allFacts.push({
          fact: factStr,
          significance: sig,
          source: doc.ai_suggested_name || doc.name,
          sourceDocumentId: doc.id,
        });
      }
    }
  }

  // Build timeline
  const docNameMap = new Map(docs.map((d: any) => [d.id, d.ai_suggested_name || d.name]));
  const timeline: CaseTimelineEvent[] = events.map((event: any) => ({
    id: event.id,
    date: event.event_date?.split("T")[0] || "",
    title: event.title,
    description: event.description || "",
    importance: event.importance || "medium",
    eventType: event.event_type || "general",
    linkedDocumentId: event.linked_document_id || null,
    linkedDocumentName: event.linked_document_id ? docNameMap.get(event.linked_document_id) || null : null,
  }));

  // Aggregate favorable/adverse factors
  const favorableFactors = dedupe(docs.flatMap((d: any) => d.favorable_findings || []));
  const adverseFactors = dedupe(docs.flatMap((d: any) => d.adverse_findings || []));
  const actionItems = dedupe(docs.flatMap((d: any) => d.action_items || []));

  return {
    caseId,
    caseName: caseData.name || "",
    caseType: caseData.case_type || "",
    documents: documentSummaries,
    entities: dedupeEntities(allEntities),
    facts: allFacts,
    timeline,
    favorableFactors,
    adverseFactors,
    actionItems,
    documentCount: docs.length,
    analyzedCount: docs.filter((d: any) => d.ai_analyzed).length,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Context String Builder ──────────────────────────────────────────────────

/**
 * Build a context string suitable for feeding into AI prompts.
 * This is what trial simulation, strategy, and other modules use
 * to give the AI full case awareness.
 */
export function buildContextString(knowledge: CaseKnowledge, maxChars: number = 50000): string {
  const parts: string[] = [];

  parts.push(`CASE: ${knowledge.caseName} (${knowledge.caseType})`);
  parts.push(`Documents: ${knowledge.documentCount} total, ${knowledge.analyzedCount} analyzed`);
  parts.push("");

  // Key facts
  if (knowledge.facts.length > 0) {
    parts.push("KEY FACTS:");
    for (const fact of knowledge.facts.slice(0, 30)) {
      parts.push(`  [${fact.significance.toUpperCase()}] ${fact.fact} (Source: ${fact.source})`);
    }
    parts.push("");
  }

  // Favorable factors
  if (knowledge.favorableFactors.length > 0) {
    parts.push("FAVORABLE FACTORS:");
    for (const factor of knowledge.favorableFactors.slice(0, 15)) {
      parts.push(`  ✓ ${factor}`);
    }
    parts.push("");
  }

  // Adverse factors
  if (knowledge.adverseFactors.length > 0) {
    parts.push("ADVERSE FACTORS:");
    for (const factor of knowledge.adverseFactors.slice(0, 15)) {
      parts.push(`  ✗ ${factor}`);
    }
    parts.push("");
  }

  // Timeline
  if (knowledge.timeline.length > 0) {
    parts.push("TIMELINE:");
    for (const event of knowledge.timeline.slice(0, 40)) {
      parts.push(`  ${event.date} — ${event.title}${event.description ? `: ${event.description.slice(0, 120)}` : ""}`);
    }
    parts.push("");
  }

  // Key entities
  if (knowledge.entities.length > 0) {
    parts.push("KEY ENTITIES:");
    const entityGroups = groupBy(knowledge.entities, (e) => e.type);
    for (const [type, entities] of Object.entries(entityGroups)) {
      const unique = [...new Set(entities.map((e) => e.name))].slice(0, 10);
      parts.push(`  ${type}: ${unique.join(", ")}`);
    }
    parts.push("");
  }

  // Document summaries
  if (knowledge.documents.some((d) => d.summary)) {
    parts.push("DOCUMENT SUMMARIES:");
    for (const doc of knowledge.documents.filter((d) => d.summary)) {
      const label = doc.aiSuggestedName || doc.name;
      const bates = doc.batesNumber ? ` [${doc.batesNumber}]` : "";
      parts.push(`  ${label}${bates}: ${doc.summary!.slice(0, 200)}`);
    }
    parts.push("");
  }

  // Action items
  if (knowledge.actionItems.length > 0) {
    parts.push("ACTION ITEMS:");
    for (const item of knowledge.actionItems.slice(0, 10)) {
      parts.push(`  → ${item}`);
    }
  }

  let result = parts.join("\n");
  if (result.length > maxChars) {
    result = result.slice(0, maxChars) + "\n\n[... case context truncated ...]";
  }

  return result;
}

// ─── React Hook ──────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UseCaseKnowledgeReturn {
  knowledge: CaseKnowledge | null;
  contextString: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * React hook that provides case knowledge for any component.
 *
 * Usage:
 *   const { knowledge, contextString, refresh } = useCaseKnowledge(caseId);
 */
export function useCaseKnowledge(caseId: string | undefined): UseCaseKnowledgeReturn {
  const [knowledge, setKnowledge] = useState<CaseKnowledge | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const k = await buildCaseKnowledge(caseId);
      setKnowledge(k);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build case knowledge");
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  // Auto-refresh when documents or timeline queries invalidate
  useEffect(() => {
    if (caseId) {
      refresh();
    }
  }, [caseId, refresh]);

  const contextString = knowledge ? buildContextString(knowledge) : "";

  return { knowledge, contextString, isLoading, error, refresh };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeEntities(entities: CaseEntity[]): CaseEntity[] {
  const seen = new Map<string, CaseEntity>();
  for (const entity of entities) {
    const key = `${entity.name.toLowerCase().trim()}|${entity.type}`;
    if (!seen.has(key)) {
      seen.set(key, entity);
    }
  }
  return Array.from(seen.values());
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}
