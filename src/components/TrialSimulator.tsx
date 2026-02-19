import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Users, Zap, Target, Brain, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Document } from "@/lib/api";

interface CaseData {
  id: string;
  user_id: string;
  name: string;
  case_type: string;
  client_name: string;
  status: string;
  representation: string;
  case_theory: string | null;
  key_issues: string[] | null;
  winning_factors: string[] | null;
  next_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TrialSimulatorProps {
  caseData?: CaseData;
  documents?: Document[];
}

interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  focusAreas: string[];
}

interface DepositionQuestion {
  id: string;
  question: string;
  type: "foundational" | "trap" | "clarifying" | "impeachment";
  targetDocument?: string;
  suggestedFollowUp?: string;
  riskLevel: "low" | "medium" | "high";
  purpose: string;
}

export function TrialSimulator({ caseData, documents = [] }: TrialSimulatorProps) {
  const [activeTab, setActiveTab] = useState("scenarios");
  const [isLoading, setIsLoading] = useState(false);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([
    {
      id: "1",
      title: "Direct Examination - Expert Witness",
      description: "Practice questioning your own expert witness to establish credibility and expertise",
      difficulty: "medium",
      focusAreas: ["Expert Qualifications", "Methodology", "Opinion Foundation", "Cross Examination Prep"],
    },
    {
      id: "2",
      title: "Cross Examination - Hostile Witness",
      description: "Challenge opposing witness testimony and expose inconsistencies",
      difficulty: "hard",
      focusAreas: ["Impeachment", "Prior Statements", "Bias Exposure", "Contradiction"],
    },
    {
      id: "3",
      title: "Opening Statement Practice",
      description: "Develop and refine your case theory presentation to the jury",
      difficulty: "easy",
      focusAreas: ["Case Theory", "Storytelling", "Persuasion", "Theme Development"],
    },
    {
      id: "4",
      title: "Document Intensive Deposition",
      description: "Question witness about complex document evidence and timelines",
      difficulty: "hard",
      focusAreas: ["Document Authentication", "Timeline Analysis", "Gap Identification", "Credibility Attack"],
    },
  ]);
  const [selectedScenario, setSelectedScenario] = useState<string>("1");
  const [questions, setQuestions] = useState<DepositionQuestion[]>([]);
  const [userInput, setUserInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const { toast } = useToast();

  const generateDepositionQuestions = async () => {
    if (!caseData || documents.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a case and upload documents first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingQuestions(true);
    try {
      // Mock AI question generation - in production, this would call an AI API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const generatedQuestions: DepositionQuestion[] = [
        {
          id: "1",
          question: "Can you explain your process for authenticating this document?",
          type: "foundational",
          targetDocument: documents[0]?.name,
          suggestedFollowUp: "What specific markings or signatures did you look for?",
          riskLevel: "low",
          purpose: "Establish document authenticity foundation",
        },
        {
          id: "2",
          question: "Isn't it true that your signature appears on page 3, but you testified you never saw this document before today?",
          type: "trap",
          targetDocument: documents[1]?.name,
          suggestedFollowUp: "How do you explain this discrepancy?",
          riskLevel: "high",
          purpose: "Expose witness credibility issues",
        },
        {
          id: "3",
          question: "What specifically in this document supports your conclusion?",
          type: "clarifying",
          targetDocument: documents[2]?.name,
          suggestedFollowUp: "Can you point to the exact paragraph or data point?",
          riskLevel: "medium",
          purpose: "Pin down vague testimony",
        },
        {
          id: "4",
          question: "Doesn't this email contradict your earlier testimony about the timeline?",
          type: "impeachment",
          targetDocument: documents[3]?.name,
          suggestedFollowUp: "Which version is correct - your memory or this written record?",
          riskLevel: "high",
          purpose: "Use documents to impeach witness credibility",
        },
      ];

      setQuestions(generatedQuestions);
      toast({
        title: "Questions generated",
        description: `Generated ${generatedQuestions.length} deposition questions based on your ${documents.length} documents.`,
      });
    } catch (error) {
      console.error("Failed to generate questions:", error);
      toast({
        title: "Generation failed",
        description: "Could not generate deposition questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const simulateResponse = async () => {
    if (!userInput.trim()) return;

    setIsLoading(true);
    try {
      // Mock AI response - in production, this would call an AI API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const responses = [
        "As the expert witness, I would need to review the specific methodology section to answer that accurately.",
        "Based on my analysis of the documents, the timeline appears consistent with the events described.",
        "That's an excellent question. The document shows a clear pattern of behavior that supports our case theory.",
        "I would object to that question as compound and confusing to the witness.",
        "Let me direct the witness to review exhibit B, which contradicts that statement.",
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setAiResponse(randomResponse);
    } catch (error) {
      toast({
        title: "Simulation error",
        description: "Failed to generate AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "hard": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "high": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "trap": return <Target className="h-4 w-4" />;
      case "impeachment": return <AlertTriangle className="h-4 w-4" />;
      case "clarifying": return <CheckCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Trial Preparation Simulator
          </CardTitle>
          <CardDescription>
            Practice deposition questions, cross-examination techniques, and trial strategies with AI assistance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="questions">Deposition Questions</TabsTrigger>
              <TabsTrigger value="practice">Practice Session</TabsTrigger>
            </TabsList>

            <TabsContent value="scenarios" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {scenarios.map((scenario) => (
                  <Card 
                    key={scenario.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedScenario === scenario.id ? "ring-2 ring-gold-500" : ""
                    }`}
                    onClick={() => setSelectedScenario(scenario.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold">{scenario.title}</h3>
                        <Badge className={getDifficultyColor(scenario.difficulty)}>
                          {scenario.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{scenario.description}</p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Focus Areas:</p>
                        <div className="flex flex-wrap gap-2">
                          {scenario.focusAreas.map((area) => (
                            <Badge key={area} variant="outline" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4">
                <div>
                  <p className="text-sm font-medium">Selected Scenario</p>
                  <p className="text-sm text-muted-foreground">
                    {scenarios.find(s => s.id === selectedScenario)?.title}
                  </p>
                </div>
                <Button onClick={() => setActiveTab("questions")}>
                  Generate Questions
                  <Zap className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">AI-Generated Deposition Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Based on {documents.length} documents in case: {caseData?.name || "No case selected"}
                  </p>
                </div>
                <Button 
                  onClick={generateDepositionQuestions}
                  disabled={isGeneratingQuestions || documents.length === 0}
                  variant="outline"
                >
                  {isGeneratingQuestions ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Generate Questions
                    </>
                  )}
                </Button>
              </div>

              {questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((q) => (
                    <Card key={q.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {getQuestionTypeIcon(q.type)}
                            <h4 className="font-medium">{q.question}</h4>
                          </div>
                          <Badge className={getRiskColor(q.riskLevel)}>
                            {q.riskLevel} risk
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Question Type</p>
                            <Badge variant="outline" className="capitalize">
                              {q.type}
                            </Badge>
                          </div>
                          
                          {q.targetDocument && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Target Document</p>
                              <p className="text-sm text-muted-foreground">{q.targetDocument}</p>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Purpose</p>
                            <p className="text-sm">{q.purpose}</p>
                          </div>
                          
                          {q.suggestedFollowUp && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Suggested Follow-up</p>
                              <p className="text-sm italic text-muted-foreground">"{q.suggestedFollowUp}"</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No questions generated yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Click "Generate Questions" to create AI-powered deposition questions based on your documents.
                    </p>
                    <Button 
                      onClick={generateDepositionQuestions}
                      disabled={documents.length === 0}
                    >
                      <Brain className="mr-2 h-4 w-4" />
                      Generate Questions
                    </Button>
                    {documents.length === 0 && (
                      <p className="text-sm text-red-600 mt-2">
                        Upload documents first to generate questions.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setActiveTab("scenarios")}>
                  Back to Scenarios
                </Button>
                <Button onClick={() => setActiveTab("practice")}>
                  Start Practice Session
                  <Users className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="practice" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Practice Deposition Session</CardTitle>
                  <CardDescription>
                    Test your questions and get AI-powered feedback on your approach
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Your Question</Label>
                    <Textarea
                      id="question"
                      placeholder="Enter your deposition question here..."
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={simulateResponse} disabled={isLoading || !userInput.trim()}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Response...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Simulate Witness Response
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setUserInput("")}>
                      Clear
                    </Button>
                  </div>

                  {aiResponse && (
                    <div className="space-y-2">
                      <Label>AI Witness Response</Label>
                      <Card className="bg-muted">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-primary/10 p-2">
                              <Brain className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-2">Expert Witness Response</p>
                              <p className="text-sm">{aiResponse}</p>
                              <div className="mt-4 p-3 bg-background rounded-lg">
                                <p className="text-xs font-medium mb-1">AI Analysis:</p>
                                <p className="text-xs text-muted-foreground">
                                  This response suggests the witness is being cautious. Consider following up with more specific,
                                  document-based questions to pin down their testimony.
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Tips for Effective Questions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-gold-600 mt-0.5 flex-shrink-0" />
                            <span>Ask open-ended questions first, then narrow down</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Target className="h-4 w-4 text-gold-600 mt-0.5 flex-shrink-0" />
                            <span>Use documents to pin down specific facts</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-gold-600 mt-0.5 flex-shrink-0" />
                            <span>Listen carefully to answers for follow-up opportunities</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-gold-600 mt-0.5 flex-shrink-0" />
                            <span>Establish foundational facts before challenging testimony</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Trap Question Strategies</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <span>Ask questions that assume facts not yet established</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <span>Present contradictory documents without immediate context</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <span>Ask compound questions to confuse the witness</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <span>Use leading questions to force admissions</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}