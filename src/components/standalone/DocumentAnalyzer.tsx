import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  FileText, 
  Search, 
  Loader2, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain,
  Scale,
  Calendar,
  User,
  MapPin,
  DollarSign,
  Link2,
  Eye,
  Download,
  Copy,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Info
} from 'lucide-react';
import { analyzeDocument } from '@/lib/ai/ai-analysis-pipeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface AnalysisResult {
  summary: string;
  keyFacts: Array<{
    fact: string;
    significance: 'favorable' | 'adverse' | 'neutral';
    source: string;
  }>;
  entities: Array<{
    name: string;
    type: 'person' | 'organization' | 'date' | 'location' | 'amount';
    context: string;
  }>;
  timelineEvents: Array<{
    date: string;
    event: string;
    source: string;
  }>;
  inconsistencies: string[];
  privilegeFlags: string[];
  hearsayFlags: string[];
  authenticationNotes: string;
  classification: 'favorable' | 'adverse' | 'neutral' | 'mixed';
  model: string;
  cached: boolean;
}

export interface StandaloneDocumentAnalyzerProps {
  documentId?: string;
  documentName?: string;
  documentText?: string;
  caseContext?: string;
  initialAnalysis?: AnalysisResult;
  onAnalysisComplete?: (result: AnalysisResult) => void;
  className?: string;
  compact?: boolean;
}

export function StandaloneDocumentAnalyzer({
  documentId,
  documentName = 'Document Analysis',
  documentText = '',
  caseContext,
  initialAnalysis,
  onAnalysisComplete,
  className,
  compact = false
}: StandaloneDocumentAnalyzerProps) {
  const [text, setText] = useState(documentText);
  const [context, setContext] = useState(caseContext || '');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(initialAnalysis || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    facts: true,
    entities: true,
    timeline: false,
    issues: false
  });

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Please enter document text to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeDocument(text, context || undefined);
      setAnalysis(result);
      onAnalysisComplete?.(result);
      toast.success('Document analysis complete');
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [text, context, onAnalysisComplete]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const classificationColor = useMemo(() => {
    switch (analysis?.classification) {
      case 'favorable': return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'adverse': return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'mixed': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
    }
  }, [analysis?.classification]);

  const significanceColor = useCallback((significance: string) => {
    switch (significance) {
      case 'favorable': return 'text-green-600 bg-green-500/10';
      case 'adverse': return 'text-red-600 bg-red-500/10';
      default: return 'text-slate-600 bg-slate-500/10';
    }
  }, []);

  const entityIcon = useCallback((type: string) => {
    switch (type) {
      case 'person': return <User className="h-3.5 w-3.5" />;
      case 'organization': return <Scale className="h-3.5 w-3.5" />;
      case 'date': return <Calendar className="h-3.5 w-3.5" />;
      case 'location': return <MapPin className="h-3.5 w-3.5" />;
      case 'amount': return <DollarSign className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  if (compact) {
    return (
      <Card className={cn('border-2 border-primary/20', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{documentName}</CardTitle>
            </div>
            {analysis && (
              <Badge className={classificationColor}>
                {analysis.classification}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Summary</p>
                <p className="text-sm">{analysis.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.keyFacts.slice(0, 3).map((fact, idx) => (
                  <Badge key={idx} className={significanceColor(fact.significance)} variant="outline">
                    {fact.significance}: {fact.fact.substring(0, 50)}...
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Button onClick={handleAnalyze} disabled={isAnalyzing || !text.trim()}>
                {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Analyze Document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {!analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Document Analysis
            </CardTitle>
            <CardDescription>
              Paste document text below for comprehensive legal analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-text">Document Text</Label>
              <Textarea
                id="document-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste document content here for analysis..."
                className="min-h-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-context">Case Context (Optional)</Label>
              <Input
                id="case-context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Brief case context to improve analysis accuracy..."
              />
            </div>
            <Button onClick={handleAnalyze} disabled={isAnalyzing || !text.trim()} className="w-full">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Document
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{documentName}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span>Analysis by {analysis.model}</span>
                    {analysis.cached && <Badge variant="outline" className="text-xs">Cached</Badge>}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={classificationColor}>
                  {analysis.classification.toUpperCase()}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
                  <RefreshCw className={cn('h-4 w-4', isAnalyzing && 'animate-spin')} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="facts">Key Facts</TabsTrigger>
                <TabsTrigger value="entities">Entities</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm leading-relaxed">{analysis.summary}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>{analysis.keyFacts.length} facts • {analysis.entities.length} entities • {analysis.timelineEvents.length} events</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(analysis.summary)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="facts" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {analysis.keyFacts.map((fact, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm">{fact.fact}</p>
                            {fact.source && (
                              <p className="mt-1 text-xs text-muted-foreground italic">
                                Source: {fact.source}
                              </p>
                            )}
                          </div>
                          <Badge className={significanceColor(fact.significance)} variant="outline">
                            {fact.significance}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="entities" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {analysis.entities.map((entity, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="rounded-md bg-muted p-2">
                          {entityIcon(entity.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{entity.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{entity.type}</Badge>
                            <span>{entity.context}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {analysis.timelineEvents.map((event, idx) => (
                      <div key={idx} className="flex gap-3 rounded-lg border p-3">
                        <div className="flex flex-col items-center">
                          <div className="rounded-full bg-primary/10 p-2">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          {idx < analysis.timelineEvents.length - 1 && (
                            <div className="mt-2 h-full w-0.5 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="font-medium">{event.event}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{event.date}</span>
                          </div>
                          {event.source && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Source: {event.source}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="issues" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-6">
                    {analysis.inconsistencies.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <h4 className="font-medium">Potential Inconsistencies</h4>
                        </div>
                        <div className="space-y-2">
                          {analysis.inconsistencies.map((issue, idx) => (
                            <div key={idx} className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
                              {issue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.privilegeFlags.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Scale className="h-4 w-4 text-blue-500" />
                          <h4 className="font-medium">Privilege Flags</h4>
                        </div>
                        <div className="space-y-2">
                          {analysis.privilegeFlags.map((flag, idx) => (
                            <div key={idx} className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm">
                              {flag}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.hearsayFlags.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare className="h-4 w-4 text-purple-500" />
                          <h4 className="font-medium">Hearsay Considerations</h4>
                        </div>
                        <div className="space-y-2">
                          {analysis.hearsayFlags.map((flag, idx) => (
                            <div key={idx} className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 text-sm">
                              {flag}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.authenticationNotes && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <h4 className="font-medium">Authentication Notes</h4>
                        </div>
                        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm">
                          {analysis.authenticationNotes}
                        </div>
                      </div>
                    )}

                    {analysis.inconsistencies.length === 0 && 
                     analysis.privilegeFlags.length === 0 && 
                     analysis.hearsayFlags.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>No issues flagged for this document</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StandaloneDocumentAnalyzer;
