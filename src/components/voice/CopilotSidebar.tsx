import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Trash2, FileText, AlertTriangle, ListChecks, FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "react-router-dom";
import { getCase } from "@/lib/api";
import type { Case } from "@/lib/api";

interface CopilotMessage {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

const STORAGE_KEY = "cb_copilot_chat";
const MAX_STORED = 50;

const QUICK_ACTIONS = [
  { label: "Summarize my case", prompt: "Give me a concise summary of my active case and where it stands.", icon: FileText },
  { label: "Draft a quick motion", prompt: "Draft a short, well-structured motion appropriate for the current posture of my case.", icon: FilePlus2 },
  { label: "What are my risks?", prompt: "What are the biggest legal and strategic risks in my active case right now?", icon: AlertTriangle },
  { label: "Suggest next steps", prompt: "What concrete next steps should I take to move my case forward effectively?", icon: ListChecks },
];

function buildCaseContext(c: Case | null): string {
  if (!c) return "";
  return [
    `Title: ${c.name}`,
    `Client: ${c.client_name}`,
    `Status: ${c.status}`,
    `Type: ${c.case_type}`,
    `Theory: ${c.case_theory || "N/A"}`,
    `Next Deadline: ${c.next_deadline || "N/A"}`,
  ].join("\n");
}

function loadMessages(): CopilotMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).slice(-MAX_STORED);
  } catch {
    return [];
  }
}

export function CopilotSidebar() {
  const { caseId } = useParams<{ caseId: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (caseId) getCase(caseId).then(setCaseData).catch(() => {});
  }, [caseId]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED))); } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, streamingText]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: CopilotMessage = { role: "user", text: trimmed, timestamp: Date.now() };
    const history = messages.map((m) => ({ role: m.role, content: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreamingText("");

    try {
      let fullText = "";
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            ...history,
            { role: "user", content: trimmed },
          ],
          temperature: 0.7,
          max_tokens: 1024,
          case_context: buildCaseContext(caseData),
        },
      });

      if (error) throw new Error(error.message);
      fullText = data?.choices?.[0]?.message?.content || data?.content || "No response received.";
      setStreamingText(fullText);
      setMessages((prev) => [...prev, { role: "model", text: fullText, timestamp: Date.now() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: `Error: ${err instanceof Error ? err.message : "Unable to reach AI service"}. Please try again.`, timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  const clearConversation = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      <Button
        size="icon"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg ${isOpen ? "hidden" : ""}`}
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col bg-card border-l shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4" /> Legal Copilot
            </h2>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {caseData?.name || "No active case"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={clearConversation} title="Clear">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center text-center pt-6 space-y-3">
              <Sparkles className="h-8 w-8 text-primary" />
              <h3 className="text-sm font-semibold">Your AI litigation partner</h3>
              <p className="text-xs text-muted-foreground max-w-[16rem]">
                Ask anything about your case, draft documents, or get tactical strategy.
              </p>
              <div className="w-full grid gap-2 mt-2">
                {QUICK_ACTIONS.map((a) => (
                  <Button key={a.label} variant="outline" size="sm" className="justify-start gap-2" onClick={() => sendMessage(a.prompt)}>
                    <a.icon className="h-4 w-4" /> {a.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted">
                    {streamingText}
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask your Legal Copilot..."
              className="flex-1 resize-none max-h-32 px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-1"
            />
            <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground text-center">AI guidance — verify against jurisdiction rules. Not legal advice.</p>
        </div>
      </aside>
    </>
  );
}
