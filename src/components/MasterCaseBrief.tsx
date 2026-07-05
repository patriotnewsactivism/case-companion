/**
 * MasterCaseBrief — the "master case file" view.
 *
 * Renders the aggregated case knowledge (facts, entities, favorable/adverse
 * factors, action items) built by caseKnowledgeHub from every analyzed
 * document. This is the single place where all document intelligence
 * rolls up into one case-wide picture.
 */

import { useMemo } from "react";
import {
  Brain, RefreshCw, Loader2, CheckCircle, AlertTriangle,
  Users, FileText, ListChecks, CalendarDays,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCaseKnowledge, type CaseEntity } from "@/services/caseKnowledgeHub";

interface MasterCaseBriefProps {
  caseId: string | undefined;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "People",
  organization: "Organizations",
  location: "Locations",
  amount: "Amounts",
  statute: "Statutes",
  "case-citation": "Case Citations",
  date: "Dates",
  other: "Other",
};

export function MasterCaseBrief({ caseId }: MasterCaseBriefProps) {
  const { knowledge, isLoading, error, refresh } = useCaseKnowledge(caseId);

  const entityGroups = useMemo(() => {
    if (!knowledge) return [];
    const groups = new Map<string, CaseEntity[]>();
    for (const entity of knowledge.entities) {
      const list = groups.get(entity.type) || [];
      list.push(entity);
      groups.set(entity.type, list);
    }
    // People and organizations first — they matter most in litigation
    const order = ["person", "organization", "location", "amount", "statute", "case-citation", "date", "other"];
    return order
      .filter((type) => groups.has(type))
      .map((type) => ({ type, entities: groups.get(type)! }));
  }, [knowledge]);

  const coverage = knowledge && knowledge.documentCount > 0
    ? Math.round((knowledge.analyzedCount / knowledge.documentCount) * 100)
    : 0;

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Master Case File
            </CardTitle>
            <CardDescription>
              Everything the AI has learned from your documents, unified into one case picture
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!knowledge && isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {knowledge && (
          <>
            {/* Coverage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Document Analysis Coverage
                </span>
                <span className="text-muted-foreground">
                  {knowledge.analyzedCount} of {knowledge.documentCount} documents analyzed
                </span>
              </div>
              <Progress value={coverage} />
              {knowledge.analyzedCount < knowledge.documentCount && (
                <p className="text-xs text-muted-foreground">
                  Analyze the remaining documents to complete the master case picture.
                </p>
              )}
            </div>

            {knowledge.analyzedCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Brain className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground max-w-sm">
                  No analyzed documents yet. Upload documents and run AI analysis to start
                  building the master case file.
                </p>
              </div>
            ) : (
              <>
                {/* Favorable / Adverse */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      Favorable Factors ({knowledge.favorableFactors.length})
                    </h4>
                    <ul className="space-y-1.5">
                      {knowledge.favorableFactors.slice(0, 10).map((factor, i) => (
                        <li key={i} className="text-xs text-green-900 flex gap-1.5">
                          <span className="shrink-0">✓</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                      {knowledge.favorableFactors.length === 0 && (
                        <li className="text-xs text-muted-foreground">None identified yet</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      Adverse Factors ({knowledge.adverseFactors.length})
                    </h4>
                    <ul className="space-y-1.5">
                      {knowledge.adverseFactors.slice(0, 10).map((factor, i) => (
                        <li key={i} className="text-xs text-red-900 flex gap-1.5">
                          <span className="shrink-0">✗</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                      {knowledge.adverseFactors.length === 0 && (
                        <li className="text-xs text-muted-foreground">None identified yet</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Key Facts */}
                {knowledge.facts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      Key Facts ({knowledge.facts.length})
                    </h4>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {knowledge.facts.slice(0, 30).map((fact, i) => (
                        <div key={i} className="text-xs flex items-start gap-2 p-2 bg-muted/40 rounded">
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] capitalize ${
                              fact.significance === "favorable"
                                ? "border-green-300 text-green-700"
                                : fact.significance === "adverse"
                                  ? "border-red-300 text-red-700"
                                  : ""
                            }`}
                          >
                            {fact.significance}
                          </Badge>
                          <span>
                            {fact.fact}
                            <span className="text-muted-foreground"> — {fact.source}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entities */}
                {entityGroups.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Key Entities
                    </h4>
                    <div className="space-y-2">
                      {entityGroups.map(({ type, entities }) => (
                        <div key={type} className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">
                            {ENTITY_TYPE_LABELS[type] || type}:
                          </span>
                          {[...new Set(entities.map((e) => e.name))].slice(0, 12).map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs font-normal">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline + Action items summary */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Timeline
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {knowledge.timeline.length} event{knowledge.timeline.length !== 1 ? "s" : ""} extracted from documents
                      {knowledge.timeline.length > 0 && (
                        <> spanning {knowledge.timeline[0].date} to {knowledge.timeline[knowledge.timeline.length - 1].date}</>
                      )}
                      . See the Timeline tab for the full chronology.
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-amber-500" />
                      Action Items ({knowledge.actionItems.length})
                    </h4>
                    <ul className="space-y-1">
                      {knowledge.actionItems.slice(0, 6).map((item, i) => (
                        <li key={i} className="text-xs flex gap-1.5">
                          <span className="text-amber-500 shrink-0">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                      {knowledge.actionItems.length === 0 && (
                        <li className="text-xs text-muted-foreground">No open action items</li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
