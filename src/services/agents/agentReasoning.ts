import { supabase } from "@/integrations/supabase/client";
import { AGENT_SYSTEM_PROMPTS, getAgentById } from "@/agents/personas";
import { buildMemoryContext, addInsight } from "./agentMemory";
import type { AgentId, ReasoningMode, ReasoningResult, ReasoningStep } from "./types";

async function callChat(systemPrompt: string, userPrompt: string, opts?: {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 1024,
      response_format: opts?.jsonMode ? { type: "json_object" } : undefined,
    },
  });

  if (error) throw new Error(error.message || "Chat invocation failed");
  return (data?.choices?.[0]?.message?.content) || data?.content || "";
}

async function standardReasoning(
  systemInstruction: string,
  task: string,
  memCtx: string
): Promise<ReasoningResult> {
  const start = Date.now();
  const synthesis = await callChat(systemInstruction + memCtx, task, {
    temperature: 0.7,
    maxTokens: 1024,
  });
  return { mode: "standard", synthesis, confidence: 70, durationMs: Date.now() - start };
}

async function deepThinkReasoning(
  systemInstruction: string,
  task: string,
  memCtx: string,
  steps: number
): Promise<ReasoningResult> {
  const start = Date.now();
  const reasoningSteps: ReasoningStep[] = [];

  const decompText = await callChat(
    systemInstruction + memCtx,
    `Break down this legal task into exactly ${steps} sequential analysis steps. Return as a JSON array of strings.\n\nTask: ${task}`,
    { temperature: 0.3, maxTokens: 512, jsonMode: true }
  );

  let subtasks: string[];
  try {
    subtasks = JSON.parse(decompText).slice(0, steps);
  } catch {
    subtasks = ["Identify key legal issues.", "Analyze strengths and weaknesses.", "Develop strategic recommendations."];
  }

  const conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

  for (const subtask of subtasks) {
    const stepStart = Date.now();
    conversationHistory.push({ role: "user", content: subtask });

    const reasoning = await callChat(
      systemInstruction + memCtx + "\n\nThink carefully, step by step.",
      conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n"),
      { temperature: 0.4, maxTokens: 512 }
    );

    conversationHistory.push({ role: "assistant", content: reasoning });
    reasoningSteps.push({ subtask, reasoning, timestamp: stepStart });
  }

  const synthesis = await callChat(
    systemInstruction + memCtx,
    `Based on the step-by-step analysis above, provide a comprehensive final recommendation with key conclusions and strategic action items.\n\nOriginal task: ${task}`,
    { temperature: 0.3, maxTokens: 1024 }
  );

  const confidence = Math.min(92, 60 + steps * 7);
  return { mode: "deep-think", steps: reasoningSteps, synthesis, confidence, durationMs: Date.now() - start };
}

async function adversarialReasoning(
  systemInstruction: string,
  task: string,
  caseCtx: string,
  memCtx: string
): Promise<ReasoningResult> {
  const start = Date.now();

  const [redTeam, blueTeam] = await Promise.all([
    callChat(
      "You are aggressive opposing counsel. Attack this legal position ruthlessly.",
      `Find every weakness in this position:\n\nTask: ${task}\n\nCase: ${caseCtx}`
    ),
    callChat(
      systemInstruction + memCtx,
      `Build the strongest defense of this position:\n\n${task}\n\nCase: ${caseCtx}`
    ),
  ]);

  const synthesis = await callChat(
    "You are a senior trial strategist who has heard both sides. Synthesize what vulnerabilities exist, what arguments are strong, and your recommended strategy.",
    `Task: ${task}\n\nOpposing Attack:\n${redTeam}\n\nOur Defense:\n${blueTeam}\n\nSynthesize a pragmatic strategy.`
  );

  return {
    mode: "adversarial",
    steps: [
      { subtask: "Opposing attack analysis", reasoning: redTeam, timestamp: start },
      { subtask: "Defense position", reasoning: blueTeam, timestamp: start + 100 },
    ],
    synthesis,
    confidence: 85,
    durationMs: Date.now() - start,
  };
}

export interface ReasoningRequest {
  mode: ReasoningMode;
  agentId: AgentId;
  caseId: string;
  task: string;
  caseContext?: string;
}

export async function runReasoning(req: ReasoningRequest): Promise<ReasoningResult> {
  const { mode, agentId, caseId, task, caseContext = "" } = req;

  const systemInstruction = AGENT_SYSTEM_PROMPTS[agentId] || "You are a helpful AI legal assistant.";
  const memCtx = await buildMemoryContext(agentId, caseId);

  let result: ReasoningResult;

  switch (mode) {
    case "deep-think":
      result = await deepThinkReasoning(systemInstruction, task, memCtx, 4);
      break;
    case "adversarial":
      result = await adversarialReasoning(systemInstruction, task, caseContext, memCtx);
      break;
    default:
      result = await standardReasoning(systemInstruction, task, memCtx);
  }

  await addInsight(agentId, caseId, {
    agentId,
    caseId,
    title: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Analysis`,
    content: result.synthesis.slice(0, 500),
    confidence: result.confidence,
    type: "recommendation",
    source: "analysis",
  });

  return result;
}

export function selectReasoningMode(task: string, explicitMode?: ReasoningMode): ReasoningMode {
  if (explicitMode) return explicitMode;
  const t = task.toLowerCase();
  if (/settl|risk assess|adversar|vulnerab|attack|oppose/.test(t)) return "adversarial";
  if (/strateg|compre|deep|thorough|analy|motion|trial plan|full analysis/.test(t) && task.length > 100) return "deep-think";
  return "standard";
}
