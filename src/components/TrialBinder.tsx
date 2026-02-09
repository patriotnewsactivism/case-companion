import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, FileText, Users, Scale, Gavel } from "lucide-react";
import {
  getOrCreateChecklist,
  getWitnesses,
  getExhibits,
  getJuryInstructions,
  getMotionsInLimine,
  getCaseDocuments,
  type WitnessPrep,
  type ExhibitItem,
  type JuryInstruction,
  type MotionInLimine,
  type CaseDocument,
} from "@/lib/trial-prep-api";

interface TrialBinderProps {
  caseId: string;
  caseName?: string;
}

export function TrialBinder({ caseId, caseName }: TrialBinderProps) {
  const [witnesses, setWitnesses] = useState<WitnessPrep[]>([]);
  const [exhibits, setExhibits] = useState<ExhibitItem[]>([]);
  const [instructions, setInstructions] = useState<JuryInstruction[]>([]);
  const [motions, setMotions] = useState<MotionInLimine[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAll();
  }, [caseId]);

  async function loadAll() {
    setLoading(true);
    const [checklistData, docs] = await Promise.all([
      getOrCreateChecklist(caseId),
      getCaseDocuments(caseId),
    ]);
    setDocuments(docs);
    if (checklistData) {
      const [w, e, i, m] = await Promise.all([
        getWitnesses(checklistData.id),
        getExhibits(checklistData.id),
        getJuryInstructions(checklistData.id),
        getMotionsInLimine(checklistData.id),
      ]);
      setWitnesses(w);
      setExhibits(e);
      setInstructions(i);
      setMotions(m);
    }
    setLoading(false);
  }

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-pulse text-muted-foreground">Loading trial binder...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-lg font-semibold">Trial Binder</h2>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Binder
        </Button>
      </div>

      <div ref={printRef} className="space-y-8 print:space-y-4">
        {/* Cover Page */}
        <Card className="print:shadow-none print:border-2">
          <CardContent className="py-12 text-center">
            <h1 className="text-3xl font-serif font-bold mb-2">Trial Binder</h1>
            <p className="text-xl text-muted-foreground">{caseName || "Case"}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Prepared: {new Date().toLocaleDateString()}
            </p>
            <div className="mt-6 flex justify-center gap-6 text-sm text-muted-foreground">
              <span>{witnesses.length} Witnesses</span>
              <span>{exhibits.length} Exhibits</span>
              <span>{instructions.length} Jury Instructions</span>
              <span>{motions.length} Motions</span>
            </div>
          </CardContent>
        </Card>

        {/* Table of Contents */}
        <Card className="print:shadow-none print:break-after-page">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Table of Contents</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-dashed pb-1"><span>I. Exhibit List</span><span>{exhibits.length} items</span></div>
            <div className="flex justify-between border-b border-dashed pb-1"><span>II. Witness Outlines</span><span>{witnesses.length} witnesses</span></div>
            <div className="flex justify-between border-b border-dashed pb-1"><span>III. Jury Instructions</span><span>{instructions.length} instructions</span></div>
            <div className="flex justify-between border-b border-dashed pb-1"><span>IV. Motions in Limine</span><span>{motions.length} motions</span></div>
          </CardContent>
        </Card>

        {/* I. Exhibit List */}
        <Card className="print:shadow-none print:break-before-page">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> I. Exhibit List</CardTitle>
          </CardHeader>
          <CardContent>
            {exhibits.length === 0 ? (
              <p className="text-muted-foreground text-sm">No exhibits</p>
            ) : (
              <div className="space-y-4">
                {exhibits.map((ex) => {
                  const doc = ex.document_id ? documents.find(d => d.id === ex.document_id) : null;
                  return (
                    <div key={ex.id} className="border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">Exhibit {ex.exhibit_number}</span>
                        <Badge variant="outline" className="text-xs">{ex.exhibit_type}</Badge>
                        <Badge variant={ex.status === 'admitted' ? 'default' : 'secondary'} className="text-xs">{ex.status}</Badge>
                      </div>
                      <p className="text-sm">{ex.description}</p>
                      {ex.foundation_witness && <p className="text-xs text-muted-foreground mt-1">Foundation Witness: {ex.foundation_witness}</p>}
                      {ex.objection_anticipated && (
                        <div className="mt-1 text-xs">
                          <span className="text-destructive font-medium">Objection anticipated</span>
                          {ex.objection_response && <span> — Response: {ex.objection_response}</span>}
                        </div>
                      )}
                      {doc?.ai_analyzed && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                          <p className="font-medium">Linked Document: {doc.name}</p>
                          {doc.summary && <p>{doc.summary}</p>}
                          {doc.key_facts && doc.key_facts.length > 0 && (
                            <div>
                              <span className="font-medium">Key Facts: </span>
                              {doc.key_facts.join("; ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* II. Witness Outlines */}
        <Card className="print:shadow-none print:break-before-page">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> II. Witness Outlines</CardTitle>
          </CardHeader>
          <CardContent>
            {witnesses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No witnesses</p>
            ) : (
              <div className="space-y-6">
                {witnesses.map((w, i) => (
                  <div key={w.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold">{i + 1}. {w.witness_name}</span>
                      <Badge variant="outline" className="text-xs">{w.witness_type}</Badge>
                      <Badge variant={w.prep_status === 'completed' ? 'default' : 'secondary'} className="text-xs">{w.prep_status}</Badge>
                      {w.subpoena_served && <Badge className="text-xs">Subpoena ✓</Badge>}
                    </div>
                    {w.testimony_summary && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Expected Testimony:</p>
                        <p className="text-sm">{w.testimony_summary}</p>
                      </div>
                    )}
                    {w.anticipated_cross && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-destructive">Anticipated Cross:</p>
                        <p className="text-sm">{w.anticipated_cross}</p>
                      </div>
                    )}
                    {w.prep_notes && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Notes:</p>
                        <p className="text-sm">{w.prep_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* III. Jury Instructions */}
        <Card className="print:shadow-none print:break-before-page">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> III. Jury Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {instructions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No jury instructions</p>
            ) : (
              <div className="space-y-4">
                {instructions.map((inst) => (
                  <div key={inst.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      {inst.instruction_number && <span className="font-bold">#{inst.instruction_number}</span>}
                      <Badge variant="outline" className="text-xs">{inst.instruction_type}</Badge>
                      <Badge variant={inst.status === 'agreed' || inst.status === 'given' ? 'default' : 'secondary'} className="text-xs">{inst.status}</Badge>
                      {inst.source && <span className="text-xs text-muted-foreground">({inst.source})</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{inst.instruction_text}</p>
                    {inst.opposition_position && (
                      <p className="text-xs mt-1"><span className="font-medium text-destructive">Opposition:</span> {inst.opposition_position}</p>
                    )}
                    {inst.argument_notes && (
                      <p className="text-xs mt-1"><span className="font-medium">Argument:</span> {inst.argument_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* IV. Motions in Limine */}
        <Card className="print:shadow-none print:break-before-page">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /> IV. Motions in Limine</CardTitle>
          </CardHeader>
          <CardContent>
            {motions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No motions in limine</p>
            ) : (
              <div className="space-y-4">
                {motions.map((m) => (
                  <div key={m.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{m.motion_title}</span>
                      <Badge variant="outline" className="text-xs">{m.motion_type}</Badge>
                      <Badge variant={m.filed_by === 'us' ? 'default' : 'secondary'} className="text-xs">
                        {m.filed_by === 'us' ? 'Our Motion' : 'Opposing'}
                      </Badge>
                      <Badge variant={m.status === 'granted' ? 'default' : m.status === 'denied' ? 'destructive' : 'secondary'} className="text-xs">{m.status}</Badge>
                    </div>
                    {m.description && <p className="text-sm">{m.description}</p>}
                    {m.legal_basis && <p className="text-xs mt-1"><span className="font-medium">Legal Basis:</span> {m.legal_basis}</p>}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      {m.filing_date && <span>Filed: {new Date(m.filing_date).toLocaleDateString()}</span>}
                      {m.hearing_date && <span>Hearing: {new Date(m.hearing_date).toLocaleDateString()}</span>}
                    </div>
                    {m.ruling_notes && <p className="text-xs mt-1"><span className="font-medium">Ruling:</span> {m.ruling_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
