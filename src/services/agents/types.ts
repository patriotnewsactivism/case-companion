import type { Case } from "@/lib/api";

export type AgentId =
  | "intake-agent"
  | "strategy-agent"
  | "discovery-agent"
  | "witness-agent"
  | "research-agent"
  | "drafting-agent"
  | "jury-agent"
  | "timeline-agent"
  | "client-agent";

export type AgentStatus = "idle" | "working" | "done" | "error";
export type WorkflowStatus = "pending" | "running" | "completed" | "failed";
export type ReasoningMode = "standard" | "deep-think" | "expert-panel" | "adversarial";
export type InsightType = "risk" | "opportunity" | "pattern" | "recommendation" | "alert";
export type InsightSource = "analysis" | "monitoring" | "research" | "learning";

export interface AgentInfo {
  id: AgentId;
  name: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
}

export interface AgentAction {
  type: string;
  description: string;
  result?: unknown;
  timestamp: number;
}

export interface AgentInsight {
  id: string;
  agentId: AgentId;
  caseId: string;
  title: string;
  content: string;
  confidence: number;
  type: InsightType;
  source: InsightSource;
  timestamp: number;
  read: boolean;
}

export interface AgentPattern {
  id: string;
  agentId: AgentId;
  pattern: string;
  confidence: number;
  occurrences: number;
  lastSeen: number;
  category: string;
}

export interface WorkflowStep {
  id: string;
  agentId: AgentId;
  action: string;
  description: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "skipped" | "failed";
  startedAt?: number;
  completedAt?: number;
  error?: string;
  parallel?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  caseId?: string;
  caseTitle?: string;
  createdAt: number;
  completedAt?: number;
  result?: Record<string, unknown>;
}

export interface ReasoningStep {
  subtask: string;
  reasoning: string;
  timestamp: number;
}

export interface ReasoningResult {
  mode: ReasoningMode;
  steps?: ReasoningStep[];
  synthesis: string;
  critique?: string;
  confidence: number;
  durationMs: number;
  perspectives?: { specialistId: string; specialistName: string; response: string }[];
}

export interface AgentMemory {
  agentId: AgentId;
  caseId: string;
  shortTerm: {
    recentActions: AgentAction[];
    workingContext: Record<string, unknown>;
    pendingInsights: AgentInsight[];
  };
  longTerm: {
    insights: AgentInsight[];
    patterns: AgentPattern[];
    interactionCount: number;
    lastActiveAt: number;
  };
  handoffs: {
    fromAgentId: AgentId;
    toAgentId: AgentId;
    reason: string;
    caseId: string;
    context: Record<string, unknown>;
    timestamp: number;
  }[];
  updatedAt: number;
}

export interface BackgroundTask {
  id: string;
  agentId: AgentId;
  caseId: string;
  taskType: string;
  schedule: "immediate" | "hourly" | "daily" | "on-event";
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  description: string;
  result?: unknown;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number;
}

export interface AgentOrchestrationRequest {
  caseId: string;
  workflowName: string;
  steps: { agentId: AgentId; action: string; description: string }[];
}

export function getDefaultCaseContext(caseData: Case): string {
  return [
    `Case: ${caseData.name}`,
    `Client: ${caseData.client_name}`,
    `Type: ${caseData.case_type}`,
    `Status: ${caseData.status}`,
    `Theory: ${caseData.case_theory || "N/A"}`,
    `Key Issues: ${(caseData.key_issues || []).join(", ") || "N/A"}`,
    `Next Deadline: ${caseData.next_deadline || "N/A"}`,
  ].join("\n");
}
