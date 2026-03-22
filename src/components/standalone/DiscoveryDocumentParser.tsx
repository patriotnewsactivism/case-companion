import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  X,
  AlertTriangle,
  Scale,
  User,
  Calendar,
  Hash,
  Link2,
  FileSearch,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Save,
  Eye,
  MessageSquare,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  FileQuestion,
  FileCheck,
  FileWarning
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type DiscoveryDocumentType = 
  | 'interrogatory'
  | 'request_for_production'
  | 'request_for_admission'
  | 'deposition'
  | 'document_production'
  | 'subpoena'
  | 'expert_disclosure'
  | 'other';

export interface DiscoveryQuestion {
  id: string;
  number: string;
  question: string;
  response?: string;
  objections?: string[];
  status: 'pending' | 'responded' | 'objected' | 'partial' | 'overdue';
  responseDueDate?: string;
  servedDate?: string;
  notes?: string;
  crossReferences?: string[];
  privileged?: boolean;
  batesRange?: string;
}

export interface DiscoveryDocument {
  id: string;
  type: DiscoveryDocumentType;
  title: string;
  partyName: string;
  partyType: 'plaintiff' | 'defendant' | 'third_party' | 'expert' | 'other';
  servedDate?: string;
  responseDueDate?: string;
  status: 'in_progress' | 'pending' | 'completed' | 'overdue';
  questions: DiscoveryQuestion[];
  notes?: string;
  extractedAt?: string;
}

export interface ParsedDiscoveryResult {
  document: DiscoveryDocument;
  extractedQuestions: DiscoveryQuestion[];
  statistics: {
    totalQuestions: number;
    responded: number;
    objected: number;
    pending: number;
    overdue: number;
  };
}

interface DiscoveryParserProps {
  onParsed?: (result: ParsedDiscoveryResult) => void;
  initialDocument?: DiscoveryDocument;
  className?: string;
}

export function DiscoveryDocumentParser({
  onParsed,
  initialDocument,
  className
}: DiscoveryParserProps) {
  const [rawText, setRawText] = useState('');
  const [documentType, setDocumentType] = useState<DiscoveryDocumentType>('interrogatory');
  const [partyName, setPartyName] = useState('');
  const [partyType, setPartyType] = useState<'plaintiff' | 'defendant' | 'third_party' | 'expert' | 'other'>('defendant');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedDocument, setParsedDocument] = useState<DiscoveryDocument | null>(initialDocument || null);
  const [activeTab, setActiveTab] = useState('input');
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const parseDiscoveryDocument = useCallback(() => {
    if (!rawText.trim()) {
      toast.error('Please paste discovery document text to parse');
      return;
    }

    setIsParsing(true);

    try {
      const lines = rawText.split('\n').filter(line => line.trim());
      const questions: DiscoveryQuestion[] = [];
      
      let currentNumber = '';
      let currentQuestion = '';
      let inQuestion = false;
      let questionStartIndex = 0;

      const questionPatterns = [
        /^(?:INTERROGATORY|INTERROG|RFP|RFA|REQUEST|QUESTION|PROPOSITION)\s*(?:NO\.?|NO|#)?\s*(\d+[a-zA-Z]?)/i,
        /^(?:\d+[a-zA-Z]?)\.\s*/,
        /^Q\.\s*/,
        /^(\d+)\.\s*/
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        for (const pattern of questionPatterns) {
          const match = line.match(pattern);
          if (match) {
            if (currentQuestion.trim()) {
              questions.push({
                id: `q-${questions.length + 1}`,
                number: currentNumber,
                question: currentQuestion.trim(),
                status: 'pending'
              });
            }
            currentNumber = match[1] || String(questions.length + 1);
            currentQuestion = line.replace(pattern, '').trim();
            inQuestion = true;
            questionStartIndex = i;
            break;
          }
        }
        
        if (!questionPatterns.some(p => p.test(line)) && inQuestion) {
          if (line.startsWith('ANSWER:') || line.startsWith('RESPONSE:') || line.startsWith('Objection:')) {
            const lastQuestion = questions[questions.length - 1];
            if (lastQuestion) {
              if (line.startsWith('Objection:')) {
                lastQuestion.objections = [line.replace('Objection:', '').trim()];
                lastQuestion.status = 'objected';
              } else {
                lastQuestion.response = line.replace(/^(ANSWER:|RESPONSE:)/i, '').trim();
                lastQuestion.status = 'responded';
              }
            }
          } else if (currentQuestion) {
            currentQuestion += ' ' + line;
          }
        }
      }

      if (currentQuestion.trim()) {
        questions.push({
          id: `q-${questions.length + 1}`,
          number: currentNumber,
          question: currentQuestion.trim(),
          status: 'pending'
        });
      }

      const now = new Date();
      const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const document: DiscoveryDocument = {
        id: `doc-${Date.now()}`,
        type: documentType,
        title: `${documentType.replace(/_/g, ' ').toUpperCase()} - ${partyName || 'Discovery'}`,
        partyName: partyName || 'Unknown Party',
        partyType,
        servedDate: now.toISOString().split('T')[0],
        responseDueDate: dueDate.toISOString().split('T')[0],
        status: questions.some(q => q.status === 'responded') ? 'in_progress' : 'pending',
        questions,
        extractedAt: new Date().toISOString()
      };

      setParsedDocument(document);
      
      const statistics = {
        totalQuestions: questions.length,
        responded: questions.filter(q => q.status === 'responded').length,
        objected: questions.filter(q => q.status === 'objected').length,
        pending: questions.filter(q => q.status === 'pending').length,
        overdue: questions.filter(q => q.status === 'overdue').length
      };

      onParsed?.({ document, extractedQuestions: questions, statistics });
      toast.success(`Parsed ${questions.length} questions`);
      setActiveTab('review');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse document');
    } finally {
      setIsParsing(false);
    }
  }, [rawText, documentType, partyName, partyType, onParsed]);

  const updateQuestion = useCallback((questionId: string, updates: Partial<DiscoveryQuestion>) => {
    if (!parsedDocument) return;
    
    const updatedQuestions = parsedDocument.questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    );
    
    setParsedDocument({
      ...parsedDocument,
      questions: updatedQuestions,
      status: updatedQuestions.some(q => q.status === 'responded') ? 'in_progress' : 'pending'
    });
  }, [parsedDocument]);

  const filteredQuestions = useMemo(() => {
    if (!parsedDocument) return [];
    if (filterStatus === 'all') return parsedDocument.questions;
    return parsedDocument.questions.filter(q => q.status === filterStatus);
  }, [parsedDocument, filterStatus]);

  const statistics = useMemo(() => {
    if (!parsedDocument) return { total: 0, responded: 0, objected: 0, pending: 0, overdue: 0 };
    return {
      total: parsedDocument.questions.length,
      responded: parsedDocument.questions.filter(q => q.status === 'responded').length,
      objected: parsedDocument.questions.filter(q => q.status === 'objected').length,
      pending: parsedDocument.questions.filter(q => q.status === 'pending').length,
      overdue: parsedDocument.questions.filter(q => q.status === 'overdue').length
    };
  }, [parsedDocument]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'responded': return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'objected': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'partial': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'overdue': return 'bg-red-500/10 text-red-600 border-red-500/30';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
    }
  };

  const documentTypeIcon = (type: DiscoveryDocumentType) => {
    switch (type) {
      case 'interrogatory': return <FileQuestion className="h-4 w-4" />;
      case 'request_for_production': return <FileCheck className="h-4 w-4" />;
      case 'request_for_admission': return <Check className="h-4 w-4" />;
      case 'deposition': return <User className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Discovery Document Parser
          </CardTitle>
          <CardDescription>
            Extract structured data from discovery documents (interrogatories, RFPs, RFAs, depositions)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="input">Input Document</TabsTrigger>
              <TabsTrigger value="configure">Configure</TabsTrigger>
              <TabsTrigger value="review">Review & Edit</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discovery-text">Paste Discovery Document</Label>
                <Textarea
                  id="discovery-text"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste discovery document text here...

Example:
INTERROGATORY NO. 1
State your full name and all other names you have ever been known by.

ANSWER: John Doe Smith

INTERROGATORY NO. 2
Describe in detail the events of January 15, 2024.

ANSWER: On that date, I was at..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              <Button onClick={parseDiscoveryDocument} disabled={isParsing || !rawText.trim()} className="w-full">
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing Document...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse Discovery Document
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="configure" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={documentType} onValueChange={(v) => setDocumentType(v as DiscoveryDocumentType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interrogatory">Interrogatory</SelectItem>
                      <SelectItem value="request_for_production">Request for Production</SelectItem>
                      <SelectItem value="request_for_admission">Request for Admission</SelectItem>
                      <SelectItem value="deposition">Deposition</SelectItem>
                      <SelectItem value="document_production">Document Production</SelectItem>
                      <SelectItem value="subpoena">Subpoena</SelectItem>
                      <SelectItem value="expert_disclosure">Expert Disclosure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responding Party Type</Label>
                  <Select value={partyType} onValueChange={(v) => setPartyType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plaintiff">Plaintiff</SelectItem>
                      <SelectItem value="defendant">Defendant</SelectItem>
                      <SelectItem value="third_party">Third Party</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Party Name</Label>
                <Input
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Enter name of party responding to discovery..."
                />
              </div>
              <Button onClick={() => setActiveTab('input')} className="w-full">
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue to Input
              </Button>
            </TabsContent>

            <TabsContent value="review" className="mt-4">
              {parsedDocument ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        {documentTypeIcon(parsedDocument.type)}
                      </div>
                      <div>
                        <p className="font-medium">{parsedDocument.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {parsedDocument.partyName} ({parsedDocument.partyType})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {statistics.total} questions
                      </Badge>
                      <Badge className={statusColor(parsedDocument.status)}>
                        {parsedDocument.status}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-4">
                    <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-slate-500/10 p-2">
                        <p className="text-2xl font-bold">{statistics.total}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="rounded-lg bg-green-500/10 p-2">
                        <p className="text-2xl font-bold text-green-600">{statistics.responded}</p>
                        <p className="text-xs text-muted-foreground">Responded</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2">
                        <p className="text-2xl font-bold text-amber-600">{statistics.objected}</p>
                        <p className="text-xs text-muted-foreground">Objected</p>
                      </div>
                      <div className="rounded-lg bg-slate-500/10 p-2">
                        <p className="text-2xl font-bold">{statistics.pending}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Questions</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="responded">Responded</SelectItem>
                        <SelectItem value="objected">Objected</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {filteredQuestions.map((question, idx) => (
                        <Card key={question.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-sm">
                              {question.number || idx + 1}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <p className="font-medium">{question.question}</p>
                                <Badge className={statusColor(question.status)} variant="outline">
                                  {question.status}
                                </Badge>
                              </div>
                              
                              {question.response && (
                                <div className="rounded-lg bg-green-500/10 p-3">
                                  <p className="text-sm"><span className="font-medium">Response:</span> {question.response}</p>
                                </div>
                              )}
                              
                              {question.objections && question.objections.length > 0 && (
                                <div className="rounded-lg bg-amber-500/10 p-3">
                                  <p className="text-sm font-medium text-amber-700">Objections:</p>
                                  {question.objections.map((obj, i) => (
                                    <p key={i} className="text-sm text-amber-600">{obj}</p>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Select
                                  value={question.status}
                                  onValueChange={(v) => updateQuestion(question.id, { status: v as any })}
                                >
                                  <SelectTrigger className="w-[150px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="responded">Responded</SelectItem>
                                    <SelectItem value="objected">Objected</SelectItem>
                                    <SelectItem value="partial">Partial</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const newResponse = prompt('Enter response:');
                                    if (newResponse) {
                                      updateQuestion(question.id, { response: newResponse, status: 'responded' });
                                    }
                                  }}
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No parsed document yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('input')}>
                    Parse a Document
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default DiscoveryDocumentParser;
