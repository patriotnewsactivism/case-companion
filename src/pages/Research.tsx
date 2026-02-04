import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCases, getAllDocuments } from "@/lib/api";
import {
  Search,
  ExternalLink,
  BookOpen,
  FileText,
  Scale,
  Newspaper,
  Briefcase,
  Lightbulb,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const recentSearches = [
  "Summary judgment standards",
  "Breach of contract elements",
  "Discovery motion practice",
  "Expert witness qualifications",
  "Attorney-client privilege",
];

const databases = [
  {
    name: "Westlaw",
    description: "Comprehensive legal research database",
    url: "https://westlaw.com",
    icon: BookOpen,
  },
  {
    name: "LexisNexis",
    description: "Legal, news, and business information",
    url: "https://lexisnexis.com",
    icon: FileText,
  },
  {
    name: "Google Scholar",
    description: "Free case law and legal articles",
    url: "https://scholar.google.com",
    icon: Search,
  },
  {
    name: "PACER",
    description: "Federal court records",
    url: "https://pacer.uscourts.gov",
    icon: Scale,
  },
  {
    name: "Cornell LII",
    description: "Free legal information",
    url: "https://www.law.cornell.edu",
    icon: BookOpen,
  },
  {
    name: "Justia",
    description: "Free case law and legal information",
    url: "https://justia.com",
    icon: FileText,
  },
];

const legalNews = [
  {
    title: "Supreme Court Grants Cert in Major IP Case",
    source: "Law360",
    date: "Dec 28, 2025",
  },
  {
    title: "New Federal Discovery Rules Take Effect",
    source: "Legal Times",
    date: "Dec 27, 2025",
  },
  {
    title: "State Bar Releases Ethics Opinion on AI Use",
    source: "ABA Journal",
    date: "Dec 26, 2025",
  },
];

export default function Research() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["all-documents"],
    queryFn: getAllDocuments,
  });

  // Extract research topics from cases and documents
  const analyzedDocs = documents.filter(d => d.ai_analyzed);
  const allKeyIssues = cases.flatMap(c => c.key_issues || []);
  const allActionItems = analyzedDocs.flatMap(d => d.action_items || []);
  const researchSuggestions = [...new Set([...allKeyIssues, ...allActionItems])].slice(0, 10);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Open Google Scholar with the search query
    window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(searchQuery)}`, "_blank");
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
            <h1 className="text-2xl lg:text-3xl font-serif font-bold">Legal Research</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Access legal databases, case law, and stay updated with legal news
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div variants={item}>
            <Card className="glass-card">
              <CardContent className="p-6">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        placeholder="Search case law, statutes, or legal topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 text-base"
                      />
                    </div>
                    <Button type="submit" size="lg" className="h-12 px-8">
                      Search
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Recent:</span>
                    {recentSearches.map((search, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 rounded-full"
                        onClick={() => setSearchQuery(search)}
                      >
                        {search}
                      </Button>
                    ))}
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={item}>
            <Tabs defaultValue="case-research" className="space-y-6">
              <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-auto p-0 gap-6">
                <TabsTrigger
                  value="case-research"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 gap-2"
                >
                  <Briefcase className="h-4 w-4" />
                  Case Research
                </TabsTrigger>
                <TabsTrigger
                  value="databases"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Databases
                </TabsTrigger>
                <TabsTrigger
                  value="news"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 gap-2"
                >
                  <Newspaper className="h-4 w-4" />
                  Legal News
                </TabsTrigger>
              </TabsList>

              <TabsContent value="case-research" className="mt-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Research Suggestions from Cases */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Lightbulb className="h-5 w-5 text-amber-500" />
                        Research Suggestions
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Topics extracted from your cases and documents
                      </p>
                    </CardHeader>
                    <CardContent>
                      {researchSuggestions.length === 0 ? (
                        <div className="text-center py-8">
                          <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">
                            Add cases and analyze documents to get research suggestions
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {researchSuggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                              onClick={() => {
                                setSearchQuery(suggestion);
                                window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(suggestion)}`, "_blank");
                              }}
                            >
                              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm flex-1">{suggestion}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Active Cases */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Briefcase className="h-5 w-5 text-accent" />
                        Active Cases
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Quick access to your case information
                      </p>
                    </CardHeader>
                    <CardContent>
                      {cases.filter(c => c.status === 'active').length === 0 ? (
                        <div className="text-center py-8">
                          <Briefcase className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">
                            No active cases
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {cases.filter(c => c.status === 'active').slice(0, 5).map((caseItem) => (
                            <div
                              key={caseItem.id}
                              className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium truncate">{caseItem.name}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">{caseItem.case_type}</p>
                                  {caseItem.key_issues && caseItem.key_issues.length > 0 && (
                                    <div className="flex gap-1 mt-2 flex-wrap">
                                      {caseItem.key_issues.slice(0, 2).map((issue, idx) => (
                                        <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                                          {issue.length > 30 ? issue.substring(0, 30) + '...' : issue}
                                        </Badge>
                                      ))}
                                      {caseItem.key_issues.length > 2 && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                          +{caseItem.key_issues.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="databases" className="mt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {databases.map((db, idx) => {
                    const Icon = db.icon;
                    return (
                      <a
                        key={idx}
                        href={db.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Card className="glass-card h-full hover:shadow-md transition-shadow cursor-pointer group">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                              <div className="rounded-lg bg-muted p-3">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">
                                    {db.name}
                                  </h3>
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {db.description}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="news" className="mt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {legalNews.map((article, idx) => (
                    <Card key={idx} className="glass-card hover:shadow-md transition-shadow cursor-pointer group">
                      <CardContent className="p-5">
                        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <span>{article.source}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                          <span>{article.date}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}
