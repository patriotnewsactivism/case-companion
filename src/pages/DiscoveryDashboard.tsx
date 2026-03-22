import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isToday, addDays } from "date-fns";
import {
  FileText,
  FolderOpen,
  Search,
  Upload,
  Filter,
  Plus,
  MoreVertical,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Brain,
  Scale,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  BarChart3,
  Users,
  Gavel,
  Target,
  Lightbulb,
  ArrowRight,
  Sparkles,
  FileQuestion,
  FileCheck,
  FileWarning,
  History,
  Bell,
  Building2,
  DollarSign,
  MapPin,
  User,
  Link2,
  Eye,
  Download,
  Copy,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  ScaleIcon,
  CalendarDays,
  Waypoints,
  LayoutDashboard,
  FileSearch,
  Beaker
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCases,
  getDocumentsByCase,
  getAllDocuments,
  getDocumentStats,
  type Document,
  type Case
} from "@/lib/api";
import { StandaloneDocumentAnalyzer } from "@/components/standalone/DocumentAnalyzer";
import { DiscoveryDocumentParser, type DiscoveryQuestion } from "@/components/standalone/DiscoveryDocumentParser";

interface DashboardMetrics {
  activeCases: number;
  totalDocuments: number;
  analyzedDocuments: number;
  pendingAnalysis: number;
  upcomingDeadlines: number;
  overdueItems: number;
}

interface DocumentWithCase extends Document {
  caseName?: string;
  caseId?: string;
}

const MOCK_METRICS: DashboardMetrics = {
  activeCases: 0,
  totalDocuments: 0,
  analyzedDocuments: 0,
  pendingAnalysis: 0,
  upcomingDeadlines: 0,
  overdueItems: 0
};

export default function DiscoveryDashboard(): React.JSX.Element {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithCase | null>(null);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showParser, setShowParser] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const {
    data: cases = [],
    isLoading: casesLoading,
    refetch: refetchCases
  } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases
  });

  const {
    data: allDocuments = [],
    isLoading: docsLoading,
    refetch: refetchDocs
  } = useQuery({
    queryKey: ["all-documents"],
    queryFn: getAllDocuments
  });

  const {
    data: documentStats,
    isLoading: statsLoading
  } = useQuery({
    queryKey: ["document-stats"],
    queryFn: getDocumentStats
  });

  const metrics = useMemo((): DashboardMetrics => {
    const activeCases = cases.filter(c => c.status === "active").length;
    const totalDocs = documentStats?.total ?? allDocuments.length;
    const analyzedDocs = documentStats?.analyzed ?? allDocuments.filter(d => d.ai_analyzed).length;
    const pendingAnalysis = totalDocs - analyzedDocs;
    
    return {
      activeCases,
      totalDocuments: totalDocs,
      analyzedDocuments: analyzedDocs,
      pendingAnalysis,
      upcomingDeadlines: 0,
      overdueItems: 0
    };
  }, [cases, allDocuments, documentStats]);

  const documentsWithCases = useMemo((): DocumentWithCase[] => {
    return allDocuments.map(doc => {
      const caseItem = cases.find(c => c.id === doc.case_id);
      return {
        ...doc,
        caseName: caseItem?.name || "Unknown Case",
        caseId: doc.case_id
      };
    });
  }, [allDocuments, cases]);

  const filteredDocuments = useMemo((): DocumentWithCase[] => {
    let filtered = documentsWithCases;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(query) ||
        doc.caseName?.toLowerCase().includes(query) ||
        doc.summary?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCaseId) {
      filtered = filtered.filter(doc => doc.caseId === selectedCaseId);
    }

    if (filterType !== "all") {
      filtered = filtered.filter(doc => {
        const fileType = doc.file_type?.toLowerCase() || "";
        switch (filterType) {
          case "pdf": return fileType.includes("pdf");
          case "doc": return fileType.includes("word") || fileType.includes("document");
          case "image": return fileType.includes("image");
          case "analyzed": return doc.ai_analyzed;
          case "unanalyzed": return !doc.ai_analyzed;
          default: return true;
        }
      });
    }
    
    return filtered;
  }, [documentsWithCases, searchQuery, selectedCaseId, filterType]);

  const recentDocuments = useMemo((): DocumentWithCase[] => {
    return [...filteredDocuments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [filteredDocuments]);

  const keyFindings = useMemo(() => {
    const findings: Array<{
      type: "favorable" | "adverse" | "neutral";
      document: string;
      finding: string;
      caseName: string;
    }> = [];
    
    filteredDocuments.forEach(doc => {
      if (doc.favorable_findings) {
        doc.favorable_findings.slice(0, 2).forEach(f => {
          findings.push({
            type: "favorable",
            document: doc.name,
            finding: f,
            caseName: doc.caseName || ""
          });
        });
      }
      if (doc.adverse_findings) {
        doc.adverse_findings.slice(0, 1).forEach(f => {
          findings.push({
            type: "adverse",
            document: doc.name,
            finding: f,
            caseName: doc.caseName || ""
          });
        });
      }
    });
    
    return findings.slice(0, 10);
  }, [filteredDocuments]);

  const handleAnalyzeDocument = useCallback(async (documentId: string) => {
    const doc = filteredDocuments.find(d => d.id === documentId);
    if (doc) {
      setSelectedDocument(doc);
      setShowAnalyzer(true);
    }
  }, [filteredDocuments]);

  const handleParseDiscovery = useCallback(() => {
    setShowParser(true);
  }, []);

  const MetricCard = useCallback(({
    icon: Icon,
    label,
    value,
    subtext,
    color = "primary"
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    subtext?: string;
    color?: "primary" | "success" | "warning" | "danger" | "neutral";
  }) => {
    const colorClasses = {
      primary: "text-primary bg-primary/10",
      success: "text-green-600 bg-green-500/10",
      warning: "text-amber-600 bg-amber-500/10",
      danger: "text-red-600 bg-red-500/10",
      neutral: "text-slate-600 bg-slate-500/10"
    };
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className={cn("rounded-lg p-2", colorClasses[color])}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-3xl font-bold">{value}</span>
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium">{label}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }, []);

  const DocumentCard = useCallback(({ doc }: { doc: DocumentWithCase }) => (
    <Card 
      className="hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
      onClick={() => setSelectedDocument(doc)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-lg p-2",
              doc.ai_analyzed ? "bg-green-500/10" : "bg-slate-500/10"
            )}>
              <FileText className={cn("h-5 w-5", doc.ai_analyzed ? "text-green-600" : "text-slate-500")} />
            </div>
            <div>
              <p className="font-medium line-clamp-1">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{doc.caseName}</p>
            </div>
          </div>
          <Badge variant={doc.ai_analyzed ? "default" : "outline"} className="text-xs">
            {doc.ai_analyzed ? "Analyzed" : "Raw"}
          </Badge>
        </div>
        
        {doc.summary && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {doc.summary}
          </p>
        )}
        
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {format(new Date(doc.created_at), "MMM d, yyyy")}
          </span>
          <div className="flex gap-1">
            {!doc.ai_analyzed && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyzeDocument(doc.id);
                }}
              >
                <Sparkles className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  ), [handleAnalyzeDocument]);

  const FindingItem = useCallback(({
    type,
    document,
    finding,
    caseName
  }: {
    type: "favorable" | "adverse" | "neutral";
    document: string;
    finding: string;
    caseName: string;
  }) => {
    const typeStyles = {
      favorable: "border-l-green-500 bg-green-500/5",
      adverse: "border-l-red-500 bg-red-500/5",
      neutral: "border-l-slate-500 bg-slate-500/5"
    };
    
    const typeIcons = {
      favorable: <CheckCircle className="h-4 w-4 text-green-500" />,
      adverse: <AlertTriangle className="h-4 w-4 text-red-500" />,
      neutral: <Scale className="h-4 w-4 text-slate-500" />
    };
    
    return (
      <div className={cn("border-l-2 pl-3 py-2", typeStyles[type])}>
        <div className="flex items-start gap-2">
          {typeIcons[type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">{finding}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="truncate">{document}</span>
              <span>•</span>
              <span className="truncate">{caseName}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, []);

  const loading = casesLoading || docsLoading || statsLoading;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <header className="border-b bg-card/50 backdrop-blur-sm p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Discovery Intelligence Hub</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Document Discovery Center</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyze, track, and manage discovery materials with AI-powered insights
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Dialog open={showParser} onOpenChange={setShowParser}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <FileSearch className="h-4 w-4" />
                      Parse Discovery
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>Discovery Document Parser</DialogTitle>
                      <DialogDescription>
                        Extract structured data from discovery documents
                      </DialogDescription>
                    </DialogHeader>
                    <DiscoveryDocumentParser onParsed={(result) => {
                      toast.success(`Parsed ${result.statistics.totalQuestions} questions`);
                    }} />
                  </DialogContent>
                </Dialog>
                
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Documents
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <MetricCard
              icon={FolderOpen}
              label="Active Cases"
              value={loading ? "..." : metrics.activeCases}
              subtext="matters"
              color="primary"
            />
            <MetricCard
              icon={FileText}
              label="Total Documents"
              value={loading ? "..." : metrics.totalDocuments}
              subtext="uploaded"
              color="neutral"
            />
            <MetricCard
              icon={Brain}
              label="AI Analyzed"
              value={loading ? "..." : metrics.analyzedDocuments}
              subtext="documents"
              color="success"
            />
            <MetricCard
              icon={Beaker}
              label="Pending"
              value={loading ? "..." : metrics.pendingAnalysis}
              subtext="awaiting analysis"
              color="warning"
            />
            <MetricCard
              icon={Calendar}
              label="Upcoming"
              value={loading ? "..." : metrics.upcomingDeadlines}
              subtext="deadlines"
              color="primary"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Overdue"
              value={loading ? "..." : metrics.overdueItems}
              subtext="items"
              color="danger"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Documents</CardTitle>
                      <CardDescription>
                        {filteredDocuments.length} documents {selectedCaseId ? "in selected case" : "across all cases"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={selectedCaseId || "all"} onValueChange={(v) => setSelectedCaseId(v === "all" ? null : v)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="All Cases" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Cases</SelectItem>
                          {cases.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[150px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="doc">Documents</SelectItem>
                        <SelectItem value="image">Images</SelectItem>
                        <SelectItem value="analyzed">Analyzed</SelectItem>
                        <SelectItem value="unanalyzed">Unanalyzed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No documents found</p>
                      <Button className="mt-4" variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Documents
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredDocuments.slice(0, 12).map(doc => (
                        <DocumentCard key={doc.id} doc={doc} />
                      ))}
                    </div>
                  )}
                  
                  {filteredDocuments.length > 12 && (
                    <div className="mt-4 text-center">
                      <Button variant="outline">
                        View All {filteredDocuments.length} Documents
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Key Findings
                  </CardTitle>
                  <CardDescription>
                    AI-extracted insights from your documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {keyFindings.length === 0 ? (
                    <div className="text-center py-8">
                      <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Upload and analyze documents to see key findings here
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {keyFindings.map((finding, idx) => (
                          <FindingItem key={idx} {...finding} />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => setShowParser(true)}
                  >
                    <FileSearch className="h-4 w-4" />
                    Parse Discovery Doc
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => setShowAnalyzer(true)}
                  >
                    <Brain className="h-4 w-4" />
                    Analyze Document
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <Search className="h-4 w-4" />
                    Semantic Search
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <BarChart3 className="h-4 w-4" />
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <Dialog open={showAnalyzer} onOpenChange={setShowAnalyzer}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Document Analysis</DialogTitle>
              <DialogDescription>
                {selectedDocument ? `Analyzing: ${selectedDocument.name}` : "Select a document to analyze"}
              </DialogDescription>
            </DialogHeader>
            {selectedDocument && (
              <StandaloneDocumentAnalyzer
                documentId={selectedDocument.id}
                documentName={selectedDocument.name}
                documentText={selectedDocument.ocr_text || ""}
                caseContext={selectedDocument.caseName}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
