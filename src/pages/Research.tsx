import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  BookOpen,
  Search,
  FileText,
  ExternalLink,
  Plus,
  Bookmark,
  History,
  Loader2,
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
  "Discovery motion deadlines California",
  "Precedent for expert witness testimony",
  "Summary judgment standards federal court",
];

const savedResources = [
  {
    title: "Federal Rules of Civil Procedure",
    description: "Complete FRCP with recent amendments",
    url: "#",
    category: "Rules",
  },
  {
    title: "Evidence Code - California",
    description: "California Evidence Code annotated",
    url: "#",
    category: "Statutes",
  },
  {
    title: "Local Court Rules - Central District",
    description: "Local rules and standing orders",
    url: "#",
    category: "Rules",
  },
];

const quickLinks = [
  { name: "Westlaw", url: "https://westlaw.com", icon: ExternalLink },
  { name: "LexisNexis", url: "https://lexisnexis.com", icon: ExternalLink },
  { name: "Google Scholar", url: "https://scholar.google.com", icon: ExternalLink },
  { name: "Court Records", url: "#", icon: ExternalLink },
];

export default function Research() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    // Simulate search
    setTimeout(() => {
      setIsSearching(false);
    }, 1500);
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
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">Legal Research</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Search case law, statutes, and legal resources
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
          </motion.div>

          {/* Search Bar */}
          <motion.div variants={item}>
            <Card className="glass-card">
              <CardContent className="pt-6">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search case law, statutes, regulations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button type="submit" disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Recent:</span>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((search, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setSearchQuery(search)}
                        >
                          {search}
                        </Button>
                      ))}
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <motion.div variants={item} className="lg:col-span-2">
              <Tabs defaultValue="resources" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="citations">Citations</TabsTrigger>
                </TabsList>

                <TabsContent value="resources" className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bookmark className="h-4 w-4 text-accent" />
                        Saved Resources
                      </CardTitle>
                      <CardDescription>Your bookmarked legal resources</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {savedResources.map((resource, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{resource.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {resource.description}
                              </p>
                              <div className="mt-2">
                                <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                                  {resource.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Research Notes</CardTitle>
                      <CardDescription>Take notes on your legal research</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Add your research notes here..."
                        className="min-h-[300px]"
                      />
                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline">Clear</Button>
                        <Button>Save Notes</Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="citations" className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Citation Manager</CardTitle>
                      <CardDescription>Manage and format case citations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No citations yet</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          Add citations as you research
                        </p>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Citation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={item} className="space-y-6">
              {/* Quick Links */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ExternalLink className="h-4 w-4 text-accent" />
                    Quick Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {quickLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium">{link.name}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-4 w-4 text-accent" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Today</div>
                    <div className="text-sm">Searched discovery motions</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Yesterday</div>
                    <div className="text-sm">Added 3 citations</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">2 days ago</div>
                    <div className="text-sm">Saved FRCP resource</div>
                  </div>
                </CardContent>
              </Card>

              {/* Research Tips */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-4 w-4 text-accent" />
                    Research Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Use Boolean operators for precise searches</li>
                    <li>• Shepardize cases to check validity</li>
                    <li>• Save important resources for quick access</li>
                    <li>• Track citation history in your notes</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
