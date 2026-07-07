import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getIntakeCases, updateIntakeStatus } from "@/services/intake/intakeService";
import type { IntakeCase } from "@/services/intake/intakeService";

function DispositionBadge({ disposition }: { disposition: IntakeCase["disposition"] }) {
  const map = { accepted: "default" as const, review: "secondary" as const, denied: "destructive" as const };
  return <Badge variant={map[disposition]}>{disposition}</Badge>;
}

function UrgencyBadge({ urgency }: { urgency: IntakeCase["urgency"] }) {
  const map = { high: "destructive" as const, medium: "secondary" as const, low: "outline" as const };
  return <Badge variant={map[urgency]}>{urgency}</Badge>;
}

export default function IntakeInbox() {
  const [intakes, setIntakes] = useState<IntakeCase[]>([]);
  const [selected, setSelected] = useState<IntakeCase | null>(null);

  useEffect(() => {
    getIntakeCases().then(setIntakes);
  }, []);

  const handleAction = async (id: string, status: IntakeCase["status"], disposition: IntakeCase["disposition"]) => {
    await updateIntakeStatus(id, status, disposition);
    setIntakes((prev) => prev.map((i) => (i.id === id ? { ...i, status, disposition } : i)));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-serif font-bold">Intake Inbox</h1>
        <p className="text-muted-foreground mt-1">Review and route incoming client intake submissions</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Submissions ({intakes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {intakes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No intake submissions yet.</p>
              ) : (
                <div className="space-y-2">
                  {intakes.map((intake) => (
                    <button
                      key={intake.id}
                      onClick={() => setSelected(intake)}
                      className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                        selected?.id === intake.id ? "border-primary bg-accent/5" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">{intake.full_name || "Unknown"}</span>
                        <UrgencyBadge urgency={intake.urgency} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{intake.matter_type || "No type"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(intake.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selected ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selected.full_name || "Unknown"}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selected.matter_type}</p>
                  </div>
                  <DispositionBadge disposition={selected.disposition} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Contact</p>
                    <p className="text-muted-foreground">{selected.contact || "N/A"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Jurisdiction</p>
                    <p className="text-muted-foreground">{selected.jurisdiction || "N/A"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Incident Date</p>
                    <p className="text-muted-foreground">{selected.intake.incidentDate || "N/A"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Opposing Parties</p>
                    <p className="text-muted-foreground">{selected.intake.opposingParties || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium">Summary</p>
                    <p className="text-muted-foreground">{selected.summary || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium">Score Detail</p>
                    <p className="text-muted-foreground">{selected.score_detail?.reasoning || "N/A"}</p>
                    <p className="text-sm font-bold mt-1">
                      Score: {selected.score}/100 · Urgency: {selected.urgency}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(selected.id, "accepted", "accepted")}
                    disabled={selected.status !== "new"}
                  >
                    Accept & Route
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(selected.id, "accepted", "review")}
                    disabled={selected.status !== "new"}
                  >
                    Mark for Review
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(selected.id, "denied", "denied")}
                    disabled={selected.status !== "new"}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[500px] text-muted-foreground">
              Select an intake submission to review
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
