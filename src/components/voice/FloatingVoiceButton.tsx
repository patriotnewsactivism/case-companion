import { useState } from "react";
import { Mic, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { AGENT_LIST } from "@/agents/personas";

const voiceAgents = AGENT_LIST.filter((a) =>
  ["maya", "discovery-agent", "strategy-agent"].includes(a.id)
);

export function FloatingVoiceButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <Card className="p-3 w-48 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Call an Agent
          </p>
          <div className="space-y-1">
            {voiceAgents.map((a) => (
              <Link
                key={a.id}
                to={`/agents`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
              >
                <span className="text-lg">{a.emoji}</span>
                <div>
                  <p className="text-xs font-bold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className={`h-14 w-14 rounded-full shadow-lg ${
          open ? "bg-muted" : "bg-primary"
        }`}
      >
        {open ? <X size={20} /> : <Mic size={22} />}
      </Button>
    </div>
  );
}
