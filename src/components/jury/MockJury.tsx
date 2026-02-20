import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Play, Scale, RefreshCw, Loader2 } from "lucide-react";
import { getCases, Case } from "@/lib/api";
import { 
  generateJuryPool, 
  startDeliberation, 
  Juror, 
  DeliberationStatement, 
  JuryVerdict 
} from "@/lib/jury-api";
import { JurorCard } from "./JurorCard";
import { JuryDeliberation } from "./JuryDeliberation";
import { JuryVerdictDisplay } from "./JuryVerdictDisplay";

type Phase = 'setup' | 'deliberating' | 'verdict';

export function MockJury() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [openingStatement, setOpeningStatement] = useState('');
  const [closingArgument, setClosingArgument] = useState('');
  const [jurors, setJurors] = useState<Juror[]>([]);
  const [deliberation, setDeliberation] = useState<DeliberationStatement[]>([]);
  const [verdict, setVerdict] = useState<JuryVerdict | null>(null);
  const [displayedStatements, setDisplayedStatements] = useState<DeliberationStatement[]>([]);
  const [currentStatementIndex, setCurrentStatementIndex] = useState(-1);

  const queryClient = useQueryClient();

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const generatePoolMutation = useMutation({
    mutationFn: generateJuryPool,
    onSuccess: (data) => {
      setJurors(data);
      toast.success("Jury pool generated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const startDeliberationMutation = useMutation({
    mutationFn: startDeliberation,
    onSuccess: (data) => {
      setDeliberation(data.deliberation);
      setVerdict(data.verdict);
      setPhase('deliberating');
      setDisplayedStatements([]);
      setCurrentStatementIndex(-1);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setPhase('setup');
    },
  });

  useEffect(() => {
    if (phase === 'deliberating' && deliberation.length > 0) {
      const animateDeliberation = () => {
        let index = 0;
        const interval = setInterval(() => {
          if (index < deliberation.length) {
            setDisplayedStatements(prev => [...prev, deliberation[index]]);
            setCurrentStatementIndex(index);
            index++;
          } else {
            clearInterval(interval);
            setTimeout(() => {
              setPhase('verdict');
            }, 1000);
          }
        }, 1500);
        return interval;
      };

      const interval = animateDeliberation();
      return () => clearInterval(interval);
    }
  }, [phase, deliberation]);

  const handleGeneratePool = () => {
    generatePoolMutation.mutate();
  };

  const handleStartDeliberation = () => {
    if (!selectedCaseId) {
      toast.error("Please select a case");
      return;
    }
    if (!openingStatement.trim()) {
      toast.error("Please enter an opening statement");
      return;
    }
    if (!closingArgument.trim()) {
      toast.error("Please enter a closing argument");
      return;
    }

    startDeliberationMutation.mutate({
      caseId: selectedCaseId,
      openingStatement,
      closingArgument,
    });
  };

  const handleReset = () => {
    setPhase('setup');
    setSelectedCaseId('');
    setOpeningStatement('');
    setClosingArgument('');
    setJurors([]);
    setDeliberation([]);
    setVerdict(null);
    setDisplayedStatements([]);
    setCurrentStatementIndex(-1);
  };

  const deliberationProgress = deliberation.length > 0 
    ? ((currentStatementIndex + 1) / deliberation.length) * 100 
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Mock Jury Simulation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered jury deliberation simulator
          </p>
        </div>
        {phase !== 'setup' && (
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Start New Simulation
          </Button>
        )}
      </div>

      {phase === 'setup' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Case Selection</CardTitle>
              <CardDescription>
                Select a case to simulate jury deliberation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Case</Label>
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a case..." />
                  </SelectTrigger>
                  <SelectContent>
                    {casesLoading ? (
                      <SelectItem value="_loading" disabled>Loading cases...</SelectItem>
                    ) : cases.length === 0 ? (
                      <SelectItem value="_empty" disabled>No cases available</SelectItem>
                    ) : (
                      cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.client_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arguments</CardTitle>
              <CardDescription>
                Enter the arguments presented to the jury
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Opening Statement (Prosecution/Plaintiff)</Label>
                <Textarea
                  placeholder="Enter the prosecution or plaintiff's opening statement..."
                  value={openingStatement}
                  onChange={(e) => setOpeningStatement(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Closing Argument (Defense)</Label>
                <Textarea
                  placeholder="Enter the defense's closing argument..."
                  value={closingArgument}
                  onChange={(e) => setClosingArgument(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Jury Pool</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePool}
                  disabled={generatePoolMutation.isPending}
                  className="gap-2"
                >
                  {generatePoolMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Generate Pool
                    </>
                  )}
                </Button>
              </CardTitle>
              <CardDescription>
                {jurors.length > 0
                  ? "12 jurors have been selected for this simulation"
                  : "Generate a diverse jury pool to preview potential jurors"}
              </CardDescription>
            </CardHeader>
            {jurors.length > 0 && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {jurors.map((juror) => (
                    <JurorCard key={juror.id} juror={juror} />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleStartDeliberation}
              disabled={startDeliberationMutation.isPending || !selectedCaseId}
              className="gap-2"
              size="lg"
            >
              {startDeliberationMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Simulating Deliberation...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Start Deliberation
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {phase === 'deliberating' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Jury Deliberation</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {currentStatementIndex + 1} of {deliberation.length} statements
                </span>
              </div>
              <Progress value={deliberationProgress} className="h-2" />
            </CardHeader>
            <CardContent className="p-0">
              <JuryDeliberation
                statements={displayedStatements}
                jurors={jurors}
                currentStatementIndex={currentStatementIndex}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {phase === 'verdict' && verdict && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <JuryVerdictDisplay verdict={verdict} />

          <Card>
            <CardHeader>
              <CardTitle>Full Deliberation Record</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <JuryDeliberation statements={deliberation} jurors={jurors} />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
