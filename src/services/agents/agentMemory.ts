import { supabase } from "@/integrations/supabase/client";
import type { AgentId, AgentMemory, AgentAction, AgentInsight, AgentPattern } from "./types";

const MEMORY_CACHE = new Map<string, AgentMemory>();

function memKey(agentId: AgentId, caseId: string): string {
  return `${agentId}:${caseId}`;
}

function defaultMemory(agentId: AgentId, caseId: string): AgentMemory {
  return {
    agentId,
    caseId,
    shortTerm: { recentActions: [], workingContext: {}, pendingInsights: [] },
    longTerm: { insights: [], patterns: [], interactionCount: 0, lastActiveAt: Date.now() },
    handoffs: [],
    updatedAt: Date.now(),
  };
}

export async function loadMemory(agentId: AgentId, caseId: string): Promise<AgentMemory> {
  const key = memKey(agentId, caseId);
  const cached = MEMORY_CACHE.get(key);
  if (cached) return cached;

  try {
    const { data } = await supabase
      .from("agent_memory")
      .select("memory_data")
      .eq("agent_id", agentId)
      .eq("case_id", caseId)
      .maybeSingle();

    if (data?.memory_data) {
      const mem = data.memory_data as AgentMemory;
      MEMORY_CACHE.set(key, mem);
      return mem;
    }
  } catch {
    // silent fallback
  }

  const mem = defaultMemory(agentId, caseId);
  MEMORY_CACHE.set(key, mem);
  return mem;
}

export async function saveMemory(memory: AgentMemory): Promise<void> {
  memory.updatedAt = Date.now();

  if (memory.shortTerm.recentActions.length > 50) {
    memory.shortTerm.recentActions = memory.shortTerm.recentActions.slice(-50);
  }
  if (memory.longTerm.insights.length > 200) {
    memory.longTerm.insights = memory.longTerm.insights.slice(-200);
  }
  if (memory.longTerm.patterns.length > 50) {
    memory.longTerm.patterns = memory.longTerm.patterns.slice(0, 50);
  }

  MEMORY_CACHE.set(memKey(memory.agentId, memory.caseId), memory);

  try {
    await supabase.from("agent_memory").upsert(
      {
        agent_id: memory.agentId,
        case_id: memory.caseId,
        memory_data: memory as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id, case_id" }
    );
  } catch {
    // silent
  }
}

export async function recordAction(
  agentId: AgentId,
  caseId: string,
  action: Omit<AgentAction, "timestamp">
): Promise<void> {
  const mem = await loadMemory(agentId, caseId);
  mem.shortTerm.recentActions.push({ ...action, timestamp: Date.now() });
  mem.longTerm.interactionCount += 1;
  mem.longTerm.lastActiveAt = Date.now();
  await saveMemory(mem);
}

export async function addInsight(
  agentId: AgentId,
  caseId: string,
  insight: Omit<AgentInsight, "id" | "timestamp" | "read">
): Promise<string> {
  const mem = await loadMemory(agentId, caseId);
  const id = `ins_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const full: AgentInsight = { ...insight, id, timestamp: Date.now(), read: false };

  if (insight.confidence >= 70) {
    mem.longTerm.insights.push(full);
  } else {
    mem.shortTerm.pendingInsights.push(full);
  }

  await saveMemory(mem);
  return id;
}

export async function buildMemoryContext(agentId: AgentId, caseId: string): Promise<string> {
  const mem = await loadMemory(agentId, caseId);
  const parts: string[] = [];

  const recent = mem.shortTerm.recentActions.slice(-5);
  if (recent.length > 0) {
    parts.push(
      `Recent activity:\n${recent
        .map((a) => `\u2022 [${new Date(a.timestamp).toLocaleDateString()}] ${a.type}: ${a.description}`)
        .join("\n")}`
    );
  }

  const topInsights = [...mem.longTerm.insights, ...mem.shortTerm.pendingInsights]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  if (topInsights.length > 0) {
    parts.push(
      `Key insights:\n${topInsights
        .map((i) => `\u2022 [${i.type.toUpperCase()} ${i.confidence}%] ${i.title}: ${i.content}`)
        .join("\n")}`
    );
  }

  if (parts.length === 0) return "";
  return `\n\n--- Agent Long-Term Memory ---\n${parts.join("\n\n")}\n--- End Memory ---`;
}

export async function consolidateMemory(agentId: AgentId, caseId: string): Promise<void> {
  const mem = await loadMemory(agentId, caseId);
  for (const insight of mem.shortTerm.pendingInsights) {
    mem.longTerm.insights.push(insight);
  }
  mem.shortTerm.pendingInsights = [];
  mem.shortTerm.recentActions = mem.shortTerm.recentActions.slice(-10);
  await saveMemory(mem);
}

export async function clearMemory(agentId: AgentId, caseId: string): Promise<void> {
  MEMORY_CACHE.delete(memKey(agentId, caseId));
  try {
    await supabase.from("agent_memory").delete().eq("agent_id", agentId).eq("case_id", caseId);
  } catch {
    // silent
  }
}

export async function upsertPattern(
  agentId: AgentId,
  pattern: Omit<AgentPattern, "id" | "lastSeen">
): Promise<void> {
  // Use "global" caseId for cross-case patterns
  const mem = await loadMemory(agentId, "global");
  const patterns = mem.longTerm.patterns;

  const existing = patterns.find(p => p.pattern === pattern.pattern);
  if (existing) {
    existing.occurrences += 1;
    existing.confidence = Math.min(100, existing.confidence + 3);
    existing.lastSeen = Date.now();
  } else {
    patterns.push({
      ...pattern,
      id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lastSeen: Date.now(),
    });
  }

  // Respect pattern limit
  if (patterns.length > 100) {
    patterns.sort((a, b) => b.confidence - a.confidence);
    patterns.length = 100;
  }

  await saveMemory(mem);
}

export async function getPatterns(agentId: AgentId): Promise<AgentPattern[]> {
  // Aggregate patterns across all cases for this agent
  const allPatterns: AgentPattern[] = [];
  try {
    const { data } = await supabase
      .from("agent_memory")
      .select("memory_data")
      .eq("agent_id", agentId);

    if (data) {
      for (const row of data) {
        const mem = row.memory_data as AgentMemory;
        if (mem?.longTerm?.patterns) {
          allPatterns.push(...mem.longTerm.patterns);
        }
      }
    }
  } catch {
    // silent
  }
  return allPatterns;
}
