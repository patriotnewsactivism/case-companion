import { loadMemory, consolidateMemory } from "./agentMemory";
import { loadWorkflows } from "./agentOrchestrator";
import type { AgentId, BackgroundTask } from "./types";
import { AGENT_CONFIG } from "@/config/agentConfig";

type TaskListener = (tasks: BackgroundTask[]) => void;
const taskListeners = new Set<TaskListener>();

const TASKS_KEY = "cb_agent_tasks";
let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let tasks: BackgroundTask[] = [];

function loadTasks(): BackgroundTask[] {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTasks(): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.slice(-100)));
  } catch {
    /* ignore */
  }
}

function broadcastTasks(): void {
  taskListeners.forEach((fn) => fn([...tasks]));
}

export function subscribeBackgroundTasks(listener: TaskListener): () => void {
  taskListeners.add(listener);
  listener([...tasks]);
  return () => taskListeners.delete(listener);
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTask(
  agentId: AgentId,
  caseId: string,
  taskType: string,
  description: string,
  schedule: BackgroundTask["schedule"] = "immediate",
  priority: BackgroundTask["priority"] = "medium"
): BackgroundTask {
  return {
    id: generateId(),
    agentId,
    caseId,
    taskType,
    schedule,
    priority,
    status: "pending",
    description,
    createdAt: Date.now(),
    retryCount: 0,
  };
}

export function enqueueTask(
  agentId: AgentId,
  caseId: string,
  taskType: string,
  description: string,
  schedule: BackgroundTask["schedule"] = "immediate",
  priority: BackgroundTask["priority"] = "medium"
): string {
  const task = createTask(agentId, caseId, taskType, description, schedule, priority);
  tasks.unshift(task);
  saveTasks();
  broadcastTasks();
  return task.id;
}

export function cancelTask(taskId: string): void {
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "cancelled";
    saveTasks();
    broadcastTasks();
  }
}

const TASK_HANDLERS: Record<string, (task: BackgroundTask) => Promise<void>> = {
  "consolidate-memory": async (task) => {
    await consolidateMemory(task.agentId, task.caseId);
  },
  "check-pending-workflows": async () => {
    await loadWorkflows();
  },
};

async function processTask(task: BackgroundTask): Promise<void> {
  task.status = "running";
  task.startedAt = Date.now();
  saveTasks();
  broadcastTasks();

  try {
    const handler = TASK_HANDLERS[task.taskType];
    if (handler) {
      await handler(task);
    } else {
      await consolidateMemory(task.agentId, task.caseId);
    }
    task.status = "completed";
    task.completedAt = Date.now();
  } catch (err) {
    task.status = "failed";
    task.error = err instanceof Error ? err.message : String(err);
    task.retryCount = (task.retryCount ?? 0) + 1;
    if ((task.retryCount ?? 0) < AGENT_CONFIG.background.maxRetries) {
      task.status = "pending";
    }
  }

  saveTasks();
  broadcastTasks();
}

async function processQueue(): Promise<void> {
  const pending = tasks
    .filter((t) => t.status === "pending" && t.schedule === "immediate")
    .sort((a, b) => {
      const p = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
    });

  for (const task of pending.slice(0, AGENT_CONFIG.background.maxConcurrentTasks)) {
    await processTask(task);
  }
}

async function processScheduled(): Promise<void> {
  const now = Date.now();
  const scheduled = tasks.filter(
    (t) => t.status === "pending" && t.schedule !== "immediate"
  );

  for (const task of scheduled) {
    const age = now - task.createdAt;
    const shouldRun =
      (task.schedule === "hourly" && age >= 3600000) ||
      (task.schedule === "daily" && age >= 86400000);

    if (shouldRun) {
      await processTask(task);
    }
  }
}

export const backgroundEngine = {
  start(): void {
    if (running || !AGENT_CONFIG.background.enabled) return;
    running = true;
    tasks = loadTasks();

    intervalId = setInterval(async () => {
      if (!running) return;
      await processQueue();
      await processScheduled();

      // Auto-consolidate memory for active agent/case pairs
      const activePairs = new Set<string>();
      for (const t of tasks) {
        if (t.status === "running" || t.status === "pending") {
          activePairs.add(`${t.agentId}:${t.caseId}`);
        }
      }
    }, AGENT_CONFIG.background.schedulerIntervalMs);
  },

  stop(): void {
    running = false;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  enqueueTask,
  cancelTask,
  subscribeBackgroundTasks,
  getTasks: (): BackgroundTask[] => [...tasks],
};
