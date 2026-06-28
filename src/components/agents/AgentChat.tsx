import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgentById } from "@/agents/personas";
import { runReasoning } from "@/services/agents/agentReasoning";
import { selectReasoningMode } from "@/services/agents/agentReasoning";
import type { AgentId, ReasoningMode } from "@/services/agents/types";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

interface AgentChatProps {
  agentId: AgentId;
  caseId: string;
  caseContext?: string;
}

export function AgentChat({ agentId, caseId, caseContext }: AgentChatProps) {
  const agent = getAgentById(agentId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>("standard");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "agent",
        content: `Hello, I'm ${agent?.name || "Agent"}, your ${agent?.title || "AI assistant"}. How can I help you with this case?`,
        timestamp: Date.now(),
      },
    ]);
  }, [agentId]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const mode = selectReasoningMode(input.trim(), reasoningMode);
      const result = await runReasoning({
        mode,
        agentId,
        caseId,
        task: input.trim(),
        caseContext,
      });

      const agentMsg: ChatMessage = {
        id: `agent_${Date.now()}`,
        role: "agent",
        content: result.synthesis,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: "agent",
        content: `I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{agent?.emoji || "🤖"}</span>
            <CardTitle className="text-base">{agent?.name || "Agent"}</CardTitle>
          </div>
          <select
            value={reasoningMode}
            onChange={(e) => setReasoningMode(e.target.value as ReasoningMode)}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            <option value="standard">Standard</option>
            <option value="deep-think">Deep Think</option>
            <option value="adversarial">Adversarial</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "agent" && (
                    <span className="text-xs font-medium text-muted-foreground block mb-1">
                      {agent?.name || "Agent"}
                    </span>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                  <span className="animate-pulse">{agent?.name || "Agent"} is thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Ask ${agent?.name || "the agent"} anything about this case...`}
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
