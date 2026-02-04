import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases, getCase, getDocumentsByCase } from "@/lib/api";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Gavel,
  Play,
  Lightbulb,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Target,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const simulationModes = [
  { value: "cross-examination", label: "Cross-Examination" },
  { value: "direct-examination", label: "Direct Examination" },
  { value: "opening-statement", label: "Opening Statement" },
  { value: "closing-argument", label: "Closing Argument" },
  { value: "deposition", label: "Deposition" },
  { value: "motion-hearing", label: "Motion Hearing" },
];

export default function TrialPrep() {
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const [searchParams] = useSearchParams();
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("cross-examination");
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const caseIdFromQuery = searchParams.get("caseId");
    if (caseIdFromQuery) {
      setSelectedCase(caseIdFromQuery);
    }
  }, [searchParams]);

  // Query case details and documents for selected case
  const { data: caseDetails } = useQuery({
    queryKey: ["case", selectedCase],
    queryFn: () => getCase(selectedCase),
    enabled: !!selectedCase,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", selectedCase],
    queryFn: () => getDocumentsByCase(selectedCase),
    enabled: !!selectedCase,
  });

  // Aggregate all insights from documents
  const analyzedDocs = documents.filter(d => d.ai_analyzed);
  const allKeyFacts = analyzedDocs.flatMap(d => d.key_facts || []);
  const allFavorableFindings = analyzedDocs.flatMap(d => d.favorable_findings || []);
  const allAdverseFindings = analyzedDocs.flatMap(d => d.adverse_findings || []);
  const allActionItems = analyzedDocs.flatMap(d => d.action_items || []);

  const handleStartSimulation = () => {
    if (!selectedCase) return;
    setIsSimulating(true);
    // Simulation logic would go here
    setTimeout(() => setIsSimulating(false), 2000);
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-8"
        >
          {/* Header */}
          <motion.div variants={item}>
            <div className="flex items-center gap-3">
              <Gavel className="h-8 w-8 text-accent" />
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">Trial Preparation & Simulation</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-2">
              Practice your case with AI-powered voice simulation and real-time coaching
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <motion.div variants={item} className="lg:col-span-2 space-y-6">
              {/* Selection Controls */}
              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedCase} onValueChange={setSelectedCase}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a case to practice" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : cases.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            No cases available
                          </div>
                        ) : (
                          cases.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedMode} onValueChange={setSelectedMode}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {simulationModes.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Simulation Panel */}
              <Card className="overflow-hidden">
                <div className="bg-slate-800 p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
                  <Gavel className="h-16 w-16 text-slate-600 mb-6" />
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">
                    Ready to Practice?
                  </h2>
                  <p className="text-slate-500 text-sm max-w-md mb-8">
                    Select a case and simulation mode, then click Start Simulation
                  </p>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    onClick={handleStartSimulation}
                    disabled={!selectedCase || isSimulating}
                  >
                    {isSimulating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    Start Simulation
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={item} className="space-y-6">
              {/* Case Theory & Strategy */}
              {selectedCase && caseDetails && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-5 w-5 text-accent" />
                      Case Theory
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {caseDetails.case_theory && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Theory</p>
                        <p className="text-sm">{caseDetails.case_theory}</p>
                      </div>
                    )}
                    {caseDetails.key_issues && caseDetails.key_issues.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Key Issues</p>
                        <div className="space-y-1">
                          {caseDetails.key_issues.map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                              <p className="text-xs">{issue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Favorable Findings */}
              {selectedCase && allFavorableFindings.length > 0 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Strengths ({allFavorableFindings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {allFavorableFindings.slice(0, 5).map((finding, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                          <p>{finding}</p>
                        </div>
                      ))}
                      {allFavorableFindings.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{allFavorableFindings.length - 5} more
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Adverse Findings */}
              {selectedCase && allAdverseFindings.length > 0 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      Weaknesses ({allAdverseFindings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {allAdverseFindings.slice(0, 5).map((finding, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                          <p>{finding}</p>
                        </div>
                      ))}
                      {allAdverseFindings.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{allAdverseFindings.length - 5} more
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Summary */}
              {selectedCase && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-accent" />
                      Discovery Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Documents</span>
                      <Badge variant="outline">{documents.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AI Analyzed</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {analyzedDocs.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Key Facts</span>
                      <Badge variant="outline">{allKeyFacts.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Action Items</span>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {allActionItems.length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
