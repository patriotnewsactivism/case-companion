import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Gavel,
  Play,
  Lightbulb,
  Loader2,
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
              {/* Live Coaching */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Live Coaching
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    AI suggestions based on your case and conversation
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      Start a simulation to receive real-time coaching
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
