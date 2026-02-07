import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getCases, getCase, getDocumentsByCase } from "@/lib/api";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Gavel,
  Play,
  Square,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle,
  Target,
  FileText,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Send,
  RotateCcw,
  ClipboardList,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrialPrepChecklist } from "@/components/TrialPrepChecklist";

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
  { value: "cross-examination", label: "Cross-Examination", description: "Practice challenging opposing witnesses" },
  { value: "direct-examination", label: "Direct Examination", description: "Guide your own witness testimony" },
  { value: "opening-statement", label: "Opening Statement", description: "Craft and deliver your opening" },
  { value: "closing-argument", label: "Closing Argument", description: "Summarize and persuade the jury" },
  { value: "deposition", label: "Deposition", description: "Question witnesses under oath" },
  { value: "motion-hearing", label: "Motion Hearing", description: "Argue motions before the judge" },
  { value: "objections-practice", label: "Objections Practice", description: "Master courtroom objections and rulings" },
  { value: "voir-dire", label: "Voir Dire", description: "Practice jury selection techniques" },
  { value: "evidence-foundation", label: "Evidence Foundation", description: "Learn to properly admit evidence" },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SimulationResponse {
  success: boolean;
  message: string;
  coaching?: string;
  role: string;
}

export default function TrialPrep() {
  const [activeMainTab, setActiveMainTab] = useState("simulator");
  
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const [searchParams] = useSearchParams();
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("cross-examination");
  const [isSimulating, setIsSimulating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [coaching, setCoaching] = useState<string | null>(null);
  const [aiRole, setAiRole] = useState<string>("");

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const caseIdFromQuery = searchParams.get("caseId");
    if (caseIdFromQuery) {
      setSelectedCase(caseIdFromQuery);
    }
  }, [searchParams]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCurrentInput(prev => prev + ' ' + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          toast.error('Speech recognition error. Please try typing instead.');
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Simulation mutation
  const simulationMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('trial-simulation', {
        body: {
          caseId: selectedCase,
          mode: selectedMode,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
        },
      });

      if (response.error) throw response.error;
      return response.data as SimulationResponse;
    },
    onSuccess: (data) => {
      // Add AI response to messages
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message, timestamp: new Date() },
      ]);

      setAiRole(data.role);

      // Update coaching if provided
      if (data.coaching) {
        setCoaching(data.coaching);
      }

      // Speak the response if speech is enabled
      if (speechEnabled && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(data.message);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        synthesisRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    },
    onError: (error: any) => {
      console.error('Simulation error:', error);
      toast.error(error.message || 'Failed to get AI response');
    },
  });

  const handleStartSimulation = () => {
    if (!selectedCase) return;
    setIsSimulating(true);
    setMessages([]);
    setCoaching(null);
    setCurrentInput("");

    // Get the simulation mode name
    const modeName = simulationModes.find(m => m.value === selectedMode)?.label || selectedMode;

    toast.success(`Starting ${modeName} simulation`);
  };

  const handleEndSimulation = () => {
    setIsSimulating(false);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsSpeaking(false);

    toast.info('Simulation ended');
  };

  const handleSendMessage = () => {
    if (!currentInput.trim() || simulationMutation.isPending) return;

    const userMessage = currentInput.trim();
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);

    setCurrentInput("");
    simulationMutation.mutate(userMessage);
  };

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        toast.error('Failed to start voice input');
      }
    }
  };

  const toggleSpeech = () => {
    setSpeechEnabled(!speechEnabled);
    if (!speechEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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

          {/* Case Selector (Always visible) */}
          <motion.div variants={item}>
            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select value={selectedCase} onValueChange={setSelectedCase}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a case to work on" />
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
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Tabs */}
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="simulator" className="flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                Trial Simulator
              </TabsTrigger>
              <TabsTrigger value="checklist" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Prep Checklist
              </TabsTrigger>
            </TabsList>

            {/* Simulator Tab */}
            <TabsContent value="simulator" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <motion.div variants={item} className="lg:col-span-2 space-y-6">
                  {/* Mode Selection */}
                  {!isSimulating && (
                    <Card className="glass-card">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Select value={selectedMode} onValueChange={setSelectedMode}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select simulation mode" />
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
                  )}

              {/* Simulation Panel */}
              <Card className="overflow-hidden">
                {!isSimulating ? (
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
                      disabled={!selectedCase}
                    >
                      <Play className="h-5 w-5" />
                      Start Simulation
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col h-[600px]">
                    {/* Simulation Header */}
                    <div className="bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-slate-300 font-medium">
                          {simulationModes.find(m => m.value === selectedMode)?.label}
                        </span>
                        {aiRole && (
                          <Badge variant="outline" className="text-xs bg-slate-700 border-slate-600">
                            AI: {aiRole}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={toggleSpeech}
                          className="text-slate-400 hover:text-slate-200"
                        >
                          {speechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEndSimulation}
                          className="text-slate-400 hover:text-slate-200 gap-1"
                        >
                          <Square className="h-4 w-4" />
                          End
                        </Button>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                      <AnimatePresence>
                        {messages.map((message, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                message.role === 'user'
                                  ? 'bg-accent text-white'
                                  : 'bg-white border border-slate-200'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <p className="text-xs opacity-60 mt-1">
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {simulationMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-slate-200 rounded-lg p-3">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          </div>
                        </div>
                      )}

                      {isSpeaking && (
                        <div className="flex justify-center">
                          <Badge variant="outline" className="gap-2">
                            <Volume2 className="h-3 w-3 animate-pulse" />
                            AI Speaking...
                          </Badge>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-slate-200 p-4 bg-white">
                      <div className="flex gap-2">
                        <Textarea
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Type your response or use voice input..."
                          className="min-h-[60px] resize-none"
                          disabled={simulationMutation.isPending}
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            size="icon"
                            variant={isListening ? "destructive" : "outline"}
                            onClick={handleVoiceInput}
                            disabled={simulationMutation.isPending}
                          >
                            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            onClick={handleSendMessage}
                            disabled={!currentInput.trim() || simulationMutation.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Coaching Feedback */}
              {coaching && isSimulating && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Alert className="bg-amber-50 border-amber-200">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-900">
                      <strong className="font-semibold">Coaching Tips:</strong>
                      <div className="mt-2 whitespace-pre-wrap">{coaching}</div>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
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
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist">
            {selectedCase ? (
              <TrialPrepChecklist caseId={selectedCase} />
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-48">
                  <p className="text-muted-foreground">Please select a case above to view the trial prep checklist.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}
