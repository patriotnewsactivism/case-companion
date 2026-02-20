import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Target, History, Loader2, RefreshCw } from "lucide-react";
import { getCases, getAllDocuments, Document } from "@/lib/api";
import {
  analyzeEvidence,
  getEvidenceAnalyses,
  EvidenceAnalysis,
} from "@/lib/evidence-api";
import { EvidenceInput } from "./EvidenceInput";
import { AdmissibilityResult } from "./AdmissibilityResult";
import { IssuesList } from "./IssuesList";
import { FoundationSuggestions } from "./FoundationSuggestions";
import { CaseLawSupport } from "./CaseLawSupport";
import { MotionDraft } from "./MotionDraft";

interface EvidenceAnalyzerProps {
  caseId?: string;
}

export function EvidenceAnalyzer({ caseId: propCaseId }: EvidenceAnalyzerProps) {
  const [selectedCaseId, setSelectedCaseId] = useState(propCaseId || "");
  const [currentAnalysis, setCurrentAnalysis] = useState<EvidenceAnalysis | null>(null);

  const queryClient = useQueryClient();

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: getAllDocuments,
  });

  const { data: analyses = [], isLoading: analysesLoading } = useQuery({
    queryKey: ["evidence-analyses", selectedCaseId],
    queryFn: () => getEvidenceAnalyses(selectedCaseId),
    enabled: !!selectedCaseId,
  });

  const analyzeMutation = useMutation({
    mutationFn: ({ caseId, description, documentId }: { caseId: string; description: string; documentId?: string }) =>
      analyzeEvidence(caseId, description, documentId),
    onSuccess: (data) => {
      setCurrentAnalysis(data);
      queryClient.invalidateQueries({ queryKey: ["evidence-analyses", selectedCaseId] });
      toast.success("Evidence analysis completed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAnalyze = (description: string, documentId?: string) => {
    if (!selectedCaseId) {
      toast.error("Please select a case first");
      return;
    }
    analyzeMutation.mutate({ caseId: selectedCaseId, description, documentId });
  };

  const handleSelectAnalysis = (analysis: EvidenceAnalysis) => {
    setCurrentAnalysis(analysis);
  };

  const handleNewAnalysis = () => {
    setCurrentAnalysis(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Evidence Admissibility Analyzer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analyze evidence for admissibility issues under the Federal Rules of Evidence
          </p>
        </div>
        {currentAnalysis && (
          <Button variant="outline" onClick={handleNewAnalysis} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            New Analysis
          </Button>
        )}
      </div>

      {!selectedCaseId && casesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedCaseId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a Case</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="h-auto p-4 justify-start"
                  onClick={() => setSelectedCaseId(c.id)}
                >
                  <div className="text-left">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.client_name}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !currentAnalysis ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Tabs defaultValue="new" className="w-full">
            <TabsList>
              <TabsTrigger value="new" className="gap-2">
                <Target className="h-4 w-4" />
                New Analysis
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History ({analyses.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-6">
              <EvidenceInput
                onSubmit={handleAnalyze}
                isLoading={analyzeMutation.isPending}
                documents={documents}
                selectedCaseId={selectedCaseId}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Previous Analyses</CardTitle>
                </CardHeader>
                <CardContent>
                  {analysesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : analyses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No previous analyses for this case
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analyses.map((analysis) => (
                        <Button
                          key={analysis.id}
                          variant="outline"
                          className="w-full h-auto p-4 justify-start"
                          onClick={() => handleSelectAnalysis(analysis)}
                        >
                          <div className="flex-1 text-left">
                            <div className="font-medium truncate">
                              {analysis.evidenceDescription.substring(0, 100)}...
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="capitalize">{analysis.overallAdmissibility}</span>
                              <span>{analysis.confidenceScore}% confidence</span>
                              <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <AdmissibilityResult analysis={currentAnalysis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IssuesList issues={currentAnalysis.issues} />
            <FoundationSuggestions suggestions={currentAnalysis.suggestedFoundations} />
          </div>

          <CaseLawSupport citations={currentAnalysis.caseLawSupport} />

          <MotionDraft
            analysisId={currentAnalysis.id}
            initialDraft={currentAnalysis.motionDraft}
          />
        </motion.div>
      )}
    </div>
  );
}
