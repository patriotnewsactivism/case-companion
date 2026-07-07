import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_LIST, getAgentById } from "@/agents/personas";
import { loadWorkflows } from "@/services/agents/agentOrchestrator";
import { subscribeWorkflows } from "@/services/agents/agentOrchestrator";
import type { Workflow, AgentId } from "@/services/agents/types";

function AgentIcon({ agentId, size = "md" }: { agentId: AgentId; size?: "sm" | "md" | "lg" }) {
  const agent = getAgentById(agentId);
  const sizeClass = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";
  return <span className={sizeClass}>{agent?.emoji || "🤖"}</span>;
}

function AgentCard({ agentId, workflows }: { agentId: AgentId; workflows: Workflow[] }) {
  const agent = getAgentById(agentId);
  if (!agent) return null;

  const agentWorkflows = workflows.filter((w) =>
    w.steps.some((s) => s.agentId === agentId)
  );
  const activeCount = agentWorkflows.filter(
    (w) => w.status === "running" || w.status === "pending"
  ).length;
  const completedCount = agentWorkflows.filter(
    (w) => w.status === "completed"
  ).length;
  const failedCount = agentWorkflows.filter((w) => w.status === "failed").length;

  const statusBadge = activeCount > 0 ? "working" : completedCount > 0 ? "done" : "idle";
  const badgeVariant =
    statusBadge === "working"
      ? "default"
      : statusBadge === "done"
        ? "secondary"
        : "outline";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AgentIcon agentId={agentId} />
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{agent.title}</p>
            </div>
          </div>
          <Badge variant={badgeVariant}>
            {statusBadge === "working" ? "Working" : statusBadge === "done" ? "Done" : "Idle"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {agent.description}
        </p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className={activeCount > 0 ? "text-primary font-medium" : ""}>
            {activeCount} active
          </span>
          <span>{completedCount} done</span>
          {failedCount > 0 && <span className="text-destructive">{failedCount} failed</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentStatusDashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | AgentId>("all");

  useEffect(() => {
    loadWorkflows().then(setWorkflows);
    const unsub = subscribeWorkflows(setWorkflows);
    return unsub;
  }, []);

  const filteredAgents =
    activeTab === "all" ? AGENT_LIST : AGENT_LIST.filter((a) => a.id === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold">AI Agent Status</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadWorkflows().then(setWorkflows)}
        >
          Refresh
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeTab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("all")}
        >
          All Agents
        </Button>
        {AGENT_LIST.map((a) => (
          <Button
            key={a.id}
            variant={activeTab === a.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(a.id)}
          >
            {a.emoji} {a.name}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAgents.map((a) => (
          <AgentCard key={a.id} agentId={a.id} workflows={workflows} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflow History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No workflows executed yet. Deploy agents from a case to see results here.
              </p>
            ) : (
              <div className="space-y-2">
                {workflows.slice(0, 20).map((wf) => (
                  <div
                    key={wf.id}
                    className="flex items-center justify-between p-2 rounded-lg border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {wf.status === "completed"
                          ? "✅"
                          : wf.status === "failed"
                            ? "❌"
                            : wf.status === "running"
                              ? "🔄"
                              : "⏳"}
                      </span>
                      <div>
                        <p className="font-medium">{wf.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {wf.caseTitle || "General"} · {wf.steps.length} steps
                        </p>
                      </div>
                    </div>
                    <Badge variant={wf.status === "completed" ? "secondary" : wf.status === "failed" ? "destructive" : "default"}>
                      {wf.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
