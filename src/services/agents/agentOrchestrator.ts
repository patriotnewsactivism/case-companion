import { supabase } from "@/integrations/supabase/client";
import { AGENT_SYSTEM_PROMPTS, getAgentById } from "@/agents/personas";
import { recordAction, addInsight } from "./agentMemory";
import type { Workflow, WorkflowStep, WorkflowStatus, AgentId, Case } from "./types";

type WorkflowListener = (workflows: Workflow[]) => void;
const workflowListeners = new Set<WorkflowListener>();

function broadcastWorkflows(all: Workflow[]): void {
  workflowListeners.forEach((fn) => fn(all));
}

export function subscribeWorkflows(listener: WorkflowListener): () => void {
  workflowListeners.add(listener);
  return () => workflowListeners.delete(listener);
}

async function callAgentChat(
  agentId: AgentId,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.45,
      max_tokens: 1200,
    },
  });
  if (error) throw new Error(error.message || "Agent chat failed");
  return (data?.choices?.[0]?.message?.content) || data?.content || "";
}

async function executeStep(
   step: WorkflowStep,
   workflow: Workflow,
   caseContext: string
 ): Promise<string> {
   const agent = getAgentById(step.agentId);
   if (!agent) throw new Error(`Unknown agent: ${step.agentId}`);

   const sysInstruction =
     AGENT_SYSTEM_PROMPTS[step.agentId] ||
     `You are ${agent.name}, ${agent.title}. ${agent.description}`;

   const priorOutputs = Object.entries(step.inputs ?? {})
     .filter(([k]) => k !== "caseContext")
     .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
     .join("\n");

   const userPrompt = [
     `Task: ${step.description}`,
     priorOutputs ? `Prior workflow context:\n${priorOutputs}` : "",
     caseContext ? `\nCase Context:\n${caseContext}` : "",
     "\nExecute this task completely. Be specific and actionable.",
   ]
     .filter(Boolean)
     .join("\n\n");

   return callAgentChat(step.agentId, sysInstruction, userPrompt);
 }

async function persistWorkflow(workflow: Workflow): Promise<void> {
  try {
    await supabase.from("agent_workflows").upsert(
      {
        id: workflow.id,
        case_id: workflow.caseId || null,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        steps: workflow.steps as unknown as Record<string, unknown>[],
        result: workflow.result as unknown as Record<string, unknown>,
        created_at: new Date(workflow.createdAt).toISOString(),
        completed_at: workflow.completedAt ? new Date(workflow.completedAt).toISOString() : null,
      },
      { onConflict: "id" }
    );
  } catch {
    // silent
  }
}

export async function loadWorkflows(caseId?: string): Promise<Workflow[]> {
  try {
    let query = supabase.from("agent_workflows").select("*").order("created_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);
    const { data } = await query;
    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      triggerEvent: (row.trigger_event as string) || "manual",
      steps: (row.steps as unknown as WorkflowStep[]) || [],
      status: (row.status as WorkflowStatus) || "pending",
      caseId: row.case_id as string | undefined,
      caseTitle: row.case_title as string | undefined,
      createdAt: new Date(row.created_at as string).getTime(),
      completedAt: row.completed_at ? new Date(row.completed_at as string).getTime() : undefined,
      result: row.result as Record<string, unknown> | undefined,
    }));
  } catch {
    return [];
  }
}

class AgentOrchestrator {
  async executeWorkflow(workflow: Workflow, caseContext?: string): Promise<Workflow> {
    workflow.status = "running";
    await persistWorkflow(workflow);
    broadcastWorkflows(await loadWorkflows());

    const cumulativeOutputs: Record<string, unknown> = {};

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (step.status === "completed") continue;

      step.status = "running";
      step.startedAt = Date.now();
      step.inputs = { ...step.inputs, ...cumulativeOutputs };
      await persistWorkflow(workflow);

      try {
        const output = await executeStep(step, workflow, caseContext || "");
        step.outputs = { result: output };
        step.status = "completed";
        step.completedAt = Date.now();

        cumulativeOutputs[`step_${i + 1}_output`] = output.slice(0, 800);

        await recordAction(step.agentId, workflow.caseId || "", {
          type: "workflow-step",
          description: step.description,
          result: output.slice(0, 200),
        });
      } catch (err) {
        step.status = "failed";
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = Date.now();
        workflow.status = "failed";
        await persistWorkflow(workflow);
        broadcastWorkflows(await loadWorkflows());
        throw err;
      }

      await persistWorkflow(workflow);
      broadcastWorkflows(await loadWorkflows());
    }

    workflow.status = "completed";
    workflow.completedAt = Date.now();
    workflow.result = cumulativeOutputs;
    await persistWorkflow(workflow);
    broadcastWorkflows(await loadWorkflows());

if (workflow.caseId) {
       await addInsight("intake-agent", workflow.caseId, {
         agentId: "intake-agent",
        caseId: workflow.caseId,
        title: `Workflow Complete: ${workflow.name}`,
        content: `All ${workflow.steps.length} steps completed for ${workflow.caseTitle || "the case"}.`,
        confidence: 85,
        type: "recommendation",
        source: "analysis",
      });
    }

    return workflow;
  }

  executeWorkflowAsync(workflow: Workflow, caseContext?: string): void {
    this.executeWorkflow(workflow, caseContext).catch((err) => {
      console.error("[Orchestrator] Workflow failed:", workflow.name, err);
    });
  }

  async getWorkflows(caseId?: string): Promise<Workflow[]> {
    return loadWorkflows(caseId);
  }

  async getActiveWorkflows(): Promise<Workflow[]> {
    const all = await loadWorkflows();
    return all.filter((w) => w.status === "running" || w.status === "pending");
  }
}

export const orchestrator = new AgentOrchestrator();
