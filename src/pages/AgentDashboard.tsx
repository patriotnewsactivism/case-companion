import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentStatusDashboard } from "@/components/agents/AgentStatusDashboard";
import { AgentChat } from "@/components/agents/AgentChat";
import { AGENT_LIST } from "@/agents/personas";
import { useParams } from "react-router-dom";
import { getCase } from "@/lib/api";
import type { Case } from "@/lib/api";
import type { AgentId } from "@/services/agents/types";

export default function AgentDashboard() {
  const { caseId } = useParams<{ caseId: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("strategy-agent");

  useEffect(() => {
    if (caseId) {
      getCase(caseId).then(setCaseData).catch(() => {});
    }
  }, [caseId]);

  const caseContext = caseData
    ? [
        `Case: ${caseData.name}`,
        `Client: ${caseData.client_name}`,
        `Type: ${caseData.case_type}`,
        `Status: ${caseData.status}`,
        `Theory: ${caseData.case_theory || "N/A"}`,
      ].join("\n")
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold">AI Agent Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {caseData
            ? `Deploying agents on: ${caseData.name}`
            : "Deploy AI agents to work on your cases"}
        </p>
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agent Status</TabsTrigger>
          <TabsTrigger value="chat">Chat with an Agent</TabsTrigger>
          <TabsTrigger value="orchestrate">Orchestrate Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <AgentStatusDashboard />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">Select Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {AGENT_LIST.map((a) => (
                  <Button
                    key={a.id}
                    variant={selectedAgent === a.id ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => setSelectedAgent(a.id)}
                  >
                    <span>{a.emoji}</span>
                    <span className="text-xs">{a.name}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
            <div className="lg:col-span-3">
              <AgentChat
                agentId={selectedAgent}
                caseId={caseId || "general"}
                caseContext={caseContext}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orchestrate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Deploy Workflows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Deploy a pre-built workflow to have multiple AI agents collaborate on a case task.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Case Analysis",
                    description: "Analyze case strengths, weaknesses, and strategy",
                    steps: 4,
                    agents: ["Strategy Agent", "Research Agent", "Jury Agent"],
                  },
                  {
                    title: "Discovery Review",
                    description: "Extract facts, find inconsistencies, build timeline",
                    steps: 3,
                    agents: ["Discovery Agent", "Timeline Agent"],
                  },
                  {
                    title: "Trial Preparation",
                    description: "Witness prep, argument practice, verdict prediction",
                    steps: 5,
                    agents: ["Witness Agent", "Drafting Agent", "Jury Agent"],
                  },
                ].map((workflow) => (
                  <Card key={workflow.title} className="border-dashed">
                    <CardContent className="pt-4 space-y-2">
                      <h3 className="font-semibold">{workflow.title}</h3>
                      <p className="text-xs text-muted-foreground">{workflow.description}</p>
                      <div className="flex gap-1 flex-wrap">
                        {workflow.agents.map((a) => (
                          <span key={a} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {a}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{workflow.steps} steps</p>
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        disabled={!caseData}
                        onClick={() => {
                          // TODO: trigger workflow execution
                        }}
                      >
                        Deploy
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
