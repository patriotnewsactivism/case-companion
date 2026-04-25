import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Search,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ExternalLink,
  History,
  Scale,
} from "lucide-react";
import { Link } from "react-router-dom";

interface ConflictMatch {
  case_id: string;
  case_name: string;
  client_name: string;
  opposing_party: string | null;
  match_type: "direct" | "adverse";
  matched_field: string;
  similarity_score: number;
}

interface ConflictCheckResult {
  id?: string;
  total_cases_checked: number;
  conflicts: ConflictMatch[];
  checked_at: string;
  client_name: string;
  opposing_party: string | null;
  additional_parties: string[];
}

interface ConflictCheckHistoryEntry {
  id: string;
  client_name: string;
  opposing_party: string | null;
  conflicts_found: number;
  cases_checked: number;
  created_at: string;
}

function ConflictCheck() {
  const { user } = useAuth();
  const [clientName, setClientName] = useState("");
  const [opposingParty, setOpposingParty] = useState("");
  const [additionalParties, setAdditionalParties] = useState<string[]>([]);
  const [newParty, setNewParty] = useState("");
  const [result, setResult] = useState<ConflictCheckResult | null>(null);

  // Fetch conflict check history
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["conflict-check-history"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conflict_checks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data as unknown as ConflictCheckHistoryEntry[]) || [];
    },
  });

  // Run conflict check
  const conflictCheckMutation = useMutation({
    mutationFn: async (): Promise<ConflictCheckResult> => {
      if (!clientName.trim()) throw new Error("Client name is required");

      // Fetch all cases to check against
      const { data: cases, error } = await (supabase as any)
        .from("cases")
        .select("id, name, client_name, notes");

      if (error) throw error;

      const allCases = cases || [];
      const conflicts: ConflictMatch[] = [];

      const searchTerms = [
        clientName.trim().toLowerCase(),
        ...(opposingParty.trim()
          ? [opposingParty.trim().toLowerCase()]
          : []),
        ...additionalParties
          .filter((p) => p.trim())
          .map((p) => p.trim().toLowerCase()),
      ];

      for (const caseRecord of allCases) {
        const caseClientName = (caseRecord.client_name || "").toLowerCase();
        const caseName = (caseRecord.name || "").toLowerCase();
        const caseNotes = (caseRecord.notes || "").toLowerCase();

        for (const term of searchTerms) {
          // Direct match on client name
          const clientSimilarity = calculateSimilarity(term, caseClientName);
          if (clientSimilarity > 0.6) {
            const isDirect = term === clientName.trim().toLowerCase();
            conflicts.push({
              case_id: caseRecord.id,
              case_name: caseRecord.name,
              client_name: caseRecord.client_name,
              opposing_party: null,
              match_type: isDirect ? "direct" : "adverse",
              matched_field: "client_name",
              similarity_score: clientSimilarity,
            });
            continue;
          }

          // Check case name
          const nameSimilarity = calculateSimilarity(term, caseName);
          if (nameSimilarity > 0.5) {
            conflicts.push({
              case_id: caseRecord.id,
              case_name: caseRecord.name,
              client_name: caseRecord.client_name,
              opposing_party: null,
              match_type: "adverse",
              matched_field: "case_name",
              similarity_score: nameSimilarity,
            });
            continue;
          }

          // Check notes for name mentions
          if (caseNotes.includes(term) && term.length >= 3) {
            conflicts.push({
              case_id: caseRecord.id,
              case_name: caseRecord.name,
              client_name: caseRecord.client_name,
              opposing_party: null,
              match_type: "adverse",
              matched_field: "notes",
              similarity_score: 0.5,
            });
          }
        }
      }

      // Deduplicate by case_id, keeping highest score
      const deduped = new Map<string, ConflictMatch>();
      for (const conflict of conflicts) {
        const existing = deduped.get(conflict.case_id);
        if (!existing || existing.similarity_score < conflict.similarity_score) {
          deduped.set(conflict.case_id, conflict);
        }
      }

      const finalConflicts = Array.from(deduped.values()).sort(
        (a, b) => b.similarity_score - a.similarity_score,
      );

      // Save to history
      const { data: saved } = await (supabase as any)
        .from("conflict_checks")
        .insert({
          user_id: user?.id,
          client_name: clientName.trim(),
          opposing_party: opposingParty.trim() || null,
          additional_parties: additionalParties.filter((p) => p.trim()),
          conflicts_found: finalConflicts.length,
          cases_checked: allCases.length,
        })
        .select()
        .single();

      return {
        id: saved?.id,
        total_cases_checked: allCases.length,
        conflicts: finalConflicts,
        checked_at: new Date().toISOString(),
        client_name: clientName.trim(),
        opposing_party: opposingParty.trim() || null,
        additional_parties: additionalParties.filter((p) => p.trim()),
      };
    },
    onSuccess: (data) => {
      setResult(data);
      refetchHistory();
      if (data.conflicts.length === 0) {
        toast.success("No conflicts found.");
      } else {
        toast.warning(`${data.conflicts.length} potential conflict(s) found.`);
      }
    },
    onError: (e: Error) => {
      toast.error(`Conflict check failed: ${e.message}`);
    },
  });

  const addParty = () => {
    if (newParty.trim()) {
      setAdditionalParties((prev) => [...prev, newParty.trim()]);
      setNewParty("");
    }
  };

  const removeParty = (index: number) => {
    setAdditionalParties((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Conflict Check
          </h1>
          <p className="text-muted-foreground mt-1">
            Search across all cases for potential conflicts of interest.
          </p>
        </div>

        {/* Search form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Check for Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                conflictCheckMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="conflict-client">
                    Client Name{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="conflict-client"
                    placeholder="Enter client name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conflict-opposing">Opposing Party</Label>
                  <Input
                    id="conflict-opposing"
                    placeholder="Enter opposing party (optional)"
                    value={opposingParty}
                    onChange={(e) => setOpposingParty(e.target.value)}
                  />
                </div>
              </div>

              {/* Additional parties */}
              <div className="space-y-2">
                <Label>Additional Parties</Label>
                {additionalParties.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {additionalParties.map((party, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        {party}
                        <button
                          type="button"
                          onClick={() => removeParty(index)}
                          className="ml-1 h-4 w-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add another party..."
                    value={newParty}
                    onChange={(e) => setNewParty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addParty();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addParty}
                    disabled={!newParty.trim()}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={
                  conflictCheckMutation.isPending || !clientName.trim()
                }
                className="gap-2"
              >
                {conflictCheckMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Run Conflict Check
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Status banner */}
            {result.conflicts.length === 0 ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">
                  No Conflicts Found
                </AlertTitle>
                <AlertDescription className="text-green-700">
                  Checked across {result.total_cases_checked} case
                  {result.total_cases_checked !== 1 ? "s" : ""}. No potential
                  conflicts of interest were identified.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-200 bg-red-50" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {result.conflicts.length} Potential Conflict
                  {result.conflicts.length !== 1 ? "s" : ""} Found
                </AlertTitle>
                <AlertDescription>
                  Review the matches below carefully before proceeding. Checked
                  across {result.total_cases_checked} case
                  {result.total_cases_checked !== 1 ? "s" : ""}.
                </AlertDescription>
              </Alert>
            )}

            {/* Conflict cards */}
            {result.conflicts.length > 0 && (
              <div className="space-y-3">
                {result.conflicts.map((conflict, index) => (
                  <Card key={`${conflict.case_id}-${index}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold">
                              {conflict.case_name}
                            </h3>
                            <Badge
                              className={
                                conflict.match_type === "direct"
                                  ? "bg-red-100 text-red-800 hover:bg-red-100"
                                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              }
                            >
                              {conflict.match_type === "direct"
                                ? "Direct"
                                : "Adverse"}
                            </Badge>
                          </div>

                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <p>
                              <span className="font-medium text-foreground">
                                Client:
                              </span>{" "}
                              {conflict.client_name}
                            </p>
                            {conflict.opposing_party && (
                              <p>
                                <span className="font-medium text-foreground">
                                  Opposing Party:
                                </span>{" "}
                                {conflict.opposing_party}
                              </p>
                            )}
                            <p>
                              <span className="font-medium text-foreground">
                                Matched on:
                              </span>{" "}
                              {conflict.matched_field.replace("_", " ")}
                            </p>
                          </div>

                          {/* Similarity score bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Similarity
                              </span>
                              <span className="font-medium">
                                {Math.round(conflict.similarity_score * 100)}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  conflict.similarity_score > 0.8
                                    ? "bg-red-500"
                                    : conflict.similarity_score > 0.6
                                      ? "bg-yellow-500"
                                      : "bg-blue-500"
                                }`}
                                style={{
                                  width: `${Math.round(conflict.similarity_score * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <Link
                          to={`/cases/${conflict.case_id}`}
                          className="shrink-0"
                        >
                          <Button variant="outline" size="sm" className="gap-1">
                            View Case
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History section */}
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {history.map((entry, index) => (
                    <div key={entry.id}>
                      {index > 0 && <Separator className="my-2" />}
                      <div className="flex items-center justify-between py-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {entry.client_name}
                            </span>
                            {entry.opposing_party && (
                              <span className="text-muted-foreground">
                                vs. {entry.opposing_party}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(entry.created_at),
                              "MMM d, yyyy h:mm a",
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            {entry.cases_checked} checked
                          </Badge>
                          {entry.conflicts_found === 0 ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                              Clear
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
                              {entry.conflicts_found} conflict
                              {entry.conflicts_found !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

/**
 * Simple string similarity using Dice's coefficient.
 * Returns a value between 0 (no match) and 1 (exact match).
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  // Check if one string contains the other
  if (b.includes(a) || a.includes(b)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return shorter / longer;
  }

  // Dice's coefficient on bigrams
  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) || 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigramsA.get(bigram);
    if (count && count > 0) {
      bigramsA.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (a.length - 1 + (b.length - 1));
}

export default ConflictCheck;
