import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Download,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { generateMotionDraft, type GeneratedMotion } from "@/services/documentGenerator";
import { exportMotionToDocx } from "@/services/docxExporter";
import { cn } from "@/lib/utils";

// ─── Motion templates list ────────────────────────────────────────────────────

interface MotionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

const MOTION_TEMPLATES: MotionTemplate[] = [
  { id: "1", name: "Motion to Suppress Evidence", description: "Challenge unlawfully obtained evidence under the Fourth Amendment. Requires showing a constitutional violation in the search or seizure.", category: "Constitutional" },
  { id: "2", name: "Motion for Summary Judgment", description: "Seek judgment as a matter of law when no genuine dispute of material fact exists. Best when the facts strongly favor your client.", category: "Dispositive" },
  { id: "3", name: "Motion to Dismiss", description: "Challenge the legal sufficiency of the complaint. Can attack lack of jurisdiction, failure to state a claim, or improper venue.", category: "Dispositive" },
  { id: "4", name: "Motion for Preliminary Injunction", description: "Seek an emergency court order to preserve the status quo. Must show likelihood of success, irreparable harm, balance of equities, and public interest.", category: "Emergency" },
  { id: "5", name: "Motion to Compel Discovery", description: "Force the opposing party to respond to discovery requests after meet-and-confer efforts have failed.", category: "Discovery" },
  { id: "6", name: "Motion for Sanctions", description: "Request court sanctions for discovery abuse, bad faith conduct, or Rule 11 violations.", category: "Procedural" },
  { id: "7", name: "Motion in Limine", description: "Pre-trial motion to exclude specific evidence from trial. File before trial to prevent the jury from hearing inadmissible evidence.", category: "Evidentiary" },
  { id: "8", name: "Motion for Judgment as a Matter of Law", description: "Challenge the sufficiency of evidence during or after trial under FRCP Rule 50.", category: "Dispositive" },
  { id: "9", name: "Motion for New Trial", description: "Request a new trial based on legal errors, jury misconduct, or newly discovered evidence.", category: "Procedural" },
  { id: "10", name: "Motion to Strike Expert Witness", description: "Challenge the admissibility of expert testimony under Daubert / FRE 702. Attack qualifications, methodology, or relevance.", category: "Evidentiary" },
  { id: "11", name: "Motion for Protective Order", description: "Protect your client or witnesses from burdensome or improper discovery requests.", category: "Discovery" },
  { id: "12", name: "Emergency TRO", description: "Temporary Restraining Order — immediate emergency relief without notice to the opposing party when irreparable harm is imminent.", category: "Emergency" },
  { id: "13", name: "Motion to Strike Qualified Immunity Defense", description: "Challenge qualified immunity defense where clearly established law was violated. Particularly applicable in § 1983 civil rights cases.", category: "Constitutional" },
  { id: "14", name: "Motion for Adverse Inference Instruction", description: "Request jury instruction that missing/destroyed evidence (e.g., lost body cam footage) should be presumed unfavorable to the spoliating party.", category: "Evidentiary" },
  { id: "15", name: "Motion to Amend Complaint", description: "Add new claims, parties, or factual allegations as the case develops. File promptly when new evidence warrants expanded claims.", category: "Procedural" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={stepNum} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors",
                done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : active
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-background border-border text-muted-foreground"
              )}
            >
              {done ? <CheckCircle className="w-3.5 h-3.5" /> : stepNum}
            </div>
            <span
              className={cn(
                "text-xs hidden sm:inline",
                active ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {labels[i]}
            </span>
            {stepNum < total && (
              <div
                className={cn(
                  "w-6 h-px mx-1",
                  done ? "bg-emerald-400" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Fake progress bar ────────────────────────────────────────────────────────

function GeneratingProgress({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setProgress(0);
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          // Slow down as it approaches 90%
          const increment = prev < 30 ? 4 : prev < 60 ? 2 : prev < 85 ? 0.8 : 0.1;
          return Math.min(90, prev + increment);
        });
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  const stages = [
    { pct: 10, label: "Analyzing case facts..." },
    { pct: 30, label: "Researching applicable law..." },
    { pct: 50, label: "Drafting argument sections..." },
    { pct: 70, label: "Adding citations and authority..." },
    { pct: 85, label: "Finalizing motion structure..." },
  ];

  const currentStage =
    [...stages].reverse().find((s) => progress >= s.pct)?.label ?? "Preparing...";

  return (
    <div className="space-y-3">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-center text-muted-foreground animate-pulse">
        {active ? currentStage : "Motion generated!"}
      </p>
      <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}%</p>
    </div>
  );
}

// ─── Section editor card ──────────────────────────────────────────────────────

function SectionCard({
  section,
  index,
  editing,
  onEdit,
  onSave,
}: {
  section: { title: string; content: string; type: string };
  index: number;
  editing: boolean;
  onEdit: () => void;
  onSave: (content: string) => void;
}) {
  const [localContent, setLocalContent] = useState(section.content);

  useEffect(() => {
    setLocalContent(section.content);
  }, [section.content]);

  return (
    <Card className="border">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">
          {section.title}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={editing ? () => onSave(localContent) : onEdit}
        >
          {editing ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
              Save
            </>
          ) : (
            <>
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {editing ? (
          <Textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            rows={Math.max(6, Math.ceil(localContent.length / 80))}
            className="text-sm font-mono leading-relaxed"
          />
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {section.content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Motion Type", "Case Facts", "Instructions", "Generate", "Review"];
const TOTAL_STEPS = 5;

export default function CaseMotionGenerator() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [motionType, setMotionType] = useState(
    searchParams.get("type") ?? ""
  );
  const [customInstructions, setCustomInstructions] = useState("");
  const [additionalFacts, setAdditionalFacts] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedMotion, setGeneratedMotion] = useState<GeneratedMotion | null>(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [sectionContents, setSectionContents] = useState<string[]>([]);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: caseData } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cases")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Sync section contents when motion is generated
  useEffect(() => {
    if (generatedMotion) {
      setSectionContents(generatedMotion.sections.map((s) => s.content));
    }
  }, [generatedMotion]);

  // Pre-populate from query param
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam) setMotionType(typeParam);
  }, [searchParams]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const selectedTemplate = MOTION_TEMPLATES.find((t) => t.name === motionType);

  const canProceedStep1 = !!motionType;
  const canProceedStep2 = true; // facts review is optional
  const canProceedStep3 = true; // custom instructions optional

  function goNext() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function goBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  // ── Generate ─────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!id || !motionType) return;
    setGenerating(true);
    setStep(4); // Stay on step 4 (Generate) to show progress

    const fullInstructions = [
      customInstructions,
      additionalFacts ? `Additional case facts: ${additionalFacts}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const motion = await generateMotionDraft(id, motionType, fullInstructions || undefined);
      setGeneratedMotion(motion);
      setStep(5);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate motion");
      setStep(3); // Go back to instructions step on error
    } finally {
      setGenerating(false);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!generatedMotion) return;
    try {
      // Apply any edits back to the motion
      const editedMotion: GeneratedMotion = {
        ...generatedMotion,
        sections: generatedMotion.sections.map((s, i) => ({
          ...s,
          content: sectionContents[i] ?? s.content,
        })),
      };
      await exportMotionToDocx({
        motion: editedMotion,
        caseNumber: caseData?.id ?? undefined,
      });
      toast.success("Motion downloaded as DOCX");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  };

  const handleSaveSection = (index: number, content: string) => {
    setSectionContents((prev) => {
      const next = [...prev];
      next[index] = content;
      return next;
    });
    setEditingSectionIndex(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              step > 1 ? goBack() : navigate(`/cases/${id}/motions`)
            }
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Motion Generator
            </p>
            <h1 className="text-xl font-bold text-foreground">
              {caseData?.name ?? "Generate Motion"}
            </h1>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />

        {/* ── Step 1: Select Motion Type ──────────────────────────────────────── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4" />
                Select Motion Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Motion Type *</Label>
                <Select value={motionType} onValueChange={setMotionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a motion type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["Dispositive", "Constitutional", "Discovery", "Evidentiary", "Emergency", "Procedural"].map(
                      (category) => (
                        <div key={category}>
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            {category}
                          </div>
                          {MOTION_TEMPLATES.filter((t) => t.category === category).map((t) => (
                            <SelectItem key={t.id} value={t.name} className="text-sm">
                              {t.name}
                            </SelectItem>
                          ))}
                        </div>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Or type custom */}
              <div className="space-y-1.5">
                <Label>Or enter a custom motion type</Label>
                <Input
                  placeholder="e.g., Motion for Reconsideration"
                  value={MOTION_TEMPLATES.find((t) => t.name === motionType) ? "" : motionType}
                  onChange={(e) => setMotionType(e.target.value)}
                />
              </div>

              {/* Description of selected template */}
              {selectedTemplate && (
                <div className="rounded-lg bg-muted px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    About this motion
                  </p>
                  <p className="text-sm text-foreground">{selectedTemplate.description}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {selectedTemplate.category}
                  </Badge>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={goNext} disabled={!canProceedStep1}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Review Case Facts ────────────────────────────────────────── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="w-4 h-4" />
                Review Case Facts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Case theory */}
              {caseData?.case_theory && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Case Theory
                  </Label>
                  <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                    {caseData.case_theory}
                  </div>
                </div>
              )}

              {/* Key issues */}
              {caseData?.key_issues && caseData.key_issues.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Key Issues
                  </Label>
                  <ul className="rounded-lg bg-muted px-4 py-3 space-y-1">
                    {caseData.key_issues.map((issue: string, i: number) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Winning factors */}
              {caseData?.winning_factors && caseData.winning_factors.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Winning Factors
                  </Label>
                  <ul className="rounded-lg bg-muted px-4 py-3 space-y-1">
                    {caseData.winning_factors.map((factor: string, i: number) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="text-emerald-500 shrink-0 mt-0.5">+</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Additional facts textarea */}
              <div className="space-y-1.5">
                <Label htmlFor="additional-facts">
                  Additional Facts for This Motion
                </Label>
                <Textarea
                  id="additional-facts"
                  placeholder="Add any specific facts relevant to this motion that aren't captured above..."
                  rows={4}
                  value={additionalFacts}
                  onChange={(e) => setAdditionalFacts(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back
                </Button>
                <Button onClick={goNext}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Custom Instructions ──────────────────────────────────────── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Edit2 className="w-4 h-4" />
                Custom Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add specific instructions, angles to emphasize, cases to cite, or arguments to avoid.
                The AI will incorporate these into the motion draft.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="custom-instructions">
                  Instructions for the AI
                </Label>
                <Textarea
                  id="custom-instructions"
                  placeholder={`e.g., "Emphasize the Fourth Amendment violation in paragraph 3 of the arrest report. Cite Brewer v. Williams, 430 U.S. 387. Avoid any discussion of defendant's prior record. Tone should be assertive but not inflammatory."`}
                  rows={6}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>

              {/* Summary of motion to generate */}
              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ready to Generate
                </p>
                <div className="text-sm space-y-1">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">Motion:</span>
                    <span className="font-medium text-foreground">{motionType}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">Case:</span>
                    <span className="text-foreground">{caseData?.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">Client:</span>
                    <span className="text-foreground">{caseData?.client_name}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    goNext();
                    handleGenerate();
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Generate Motion
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Generate (progress) ──────────────────────────────────────── */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Generating Motion
              </CardTitle>
            </CardHeader>
            <CardContent className="py-8 space-y-6">
              <GeneratingProgress active={generating} />

              {!generating && !generatedMotion && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setStep(3)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Back to Instructions
                  </Button>
                </div>
              )}

              {!generating && generatedMotion && (
                <div className="flex justify-center">
                  <Button onClick={() => setStep(5)}>
                    <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
                    Review Motion
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Review & Export ───────────────────────────────────────────── */}
        {step === 5 && generatedMotion && (
          <div className="space-y-4">
            {/* Verification flags */}
            {generatedMotion.verification_flags.length > 0 && (
              <Card className="border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {generatedMotion.verification_flags.length} Items Require Attorney Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="space-y-1.5">
                    {generatedMotion.verification_flags.map((flag, i) => (
                      <li
                        key={i}
                        className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2"
                      >
                        <span className="shrink-0 font-bold mt-0.5">{i + 1}.</span>
                        {flag}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Caption */}
            {generatedMotion.caption && (
              <Card className="border-border">
                <CardContent className="py-4 px-4 text-center space-y-1">
                  <p className="font-bold text-sm uppercase">{generatedMotion.caption.court}</p>
                  <p className="text-sm">{generatedMotion.caption.plaintiff}</p>
                  <p className="text-xs text-muted-foreground">v.</p>
                  <p className="text-sm">{generatedMotion.caption.defendant}</p>
                  <p className="text-xs text-muted-foreground">
                    Case No. {generatedMotion.caption.case_number} | Judge:{" "}
                    {generatedMotion.caption.judge}
                  </p>
                  <p className="font-bold text-sm uppercase mt-2">
                    {generatedMotion.caption.document_title}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Sections */}
            {generatedMotion.sections.map((section, i) => (
              <SectionCard
                key={i}
                section={{
                  ...section,
                  content: sectionContents[i] ?? section.content,
                }}
                index={i}
                editing={editingSectionIndex === i}
                onEdit={() => setEditingSectionIndex(i)}
                onSave={(content) => handleSaveSection(i, content)}
              />
            ))}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedMotion(null);
                  setStep(3);
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Regenerate
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Download as DOCX
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5 empty guard */}
        {step === 5 && !generatedMotion && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 mb-4 animate-spin" />
              <p>Waiting for motion generation to complete...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
