import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases, Case } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Clock,
  FileText,
  AlertCircle,
  ArrowRight,
  Plus,
  FolderOpen,
  Calendar,
  Gavel,
  Newspaper,
  BrainCircuit,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

const newsArticles = [
  {
    title: "Supreme Court Rules on Discovery Timeline Extensions",
    source: "Legal Weekly",
    date: "Dec 26, 2025",
  },
  {
    title: "New AI Guidelines for Legal Document Review",
    source: "Bar Association",
    date: "Dec 24, 2025",
  },
  {
    title: "E-Discovery Standards Updated for 2026",
    source: "Law Tech Today",
    date: "Dec 23, 2025",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "discovery":
      return "bg-accent/20 text-accent";
    case "pending":
      return "bg-muted text-muted-foreground";
    case "review":
      return "bg-blue-100 text-blue-700";
    case "closed":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const activeCases = cases.filter((c) => c.status === "active").length;
  const upcomingDeadlines = cases.filter(
    (c) => c.next_deadline && new Date(c.next_deadline) > new Date()
  ).length;
  const totalDocuments = 0; // Would come from documents query
  const recentCases = cases.slice(0, 3);

  const stats = [
    { label: "Active Cases", value: activeCases.toString(), icon: FolderOpen, change: `${cases.length} total` },
    { label: "Pending Deadlines", value: upcomingDeadlines.toString(), icon: Calendar, change: "View all" },
    { label: "Documents Indexed", value: totalDocuments.toString(), icon: FileText, change: "Upload more" },
    { label: "Trial Prep Sessions", value: "0", icon: Gavel, change: "Start one" },
  ];

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
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}! Here's your case overview.
              </p>
            </div>
            <Link to="/cases">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Case
              </Button>
            </Link>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="glass-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-serif font-bold">
                          {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : stat.value}
                        </p>
                        <p className="text-xs text-accent">{stat.change}</p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-2.5">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Cases */}
            <motion.div variants={item} className="lg:col-span-2">
              <Card className="glass-card h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Recent Cases</CardTitle>
                    <CardDescription>Your most recently accessed matters</CardDescription>
                  </div>
                  <Link to="/cases">
                    <Button variant="ghost" size="sm" className="gap-1 text-accent">
                      View all
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentCases.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No cases yet</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Create your first case to get started
                      </p>
                      <Link to="/cases">
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          New Case
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    recentCases.map((caseItem) => (
                      <div
                        key={caseItem.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg bg-primary/10 p-2.5">
                            <FolderOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{caseItem.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{caseItem.case_type}</span>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{caseItem.client_name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(caseItem.status)}`}>
                            {caseItem.status}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(caseItem.updated_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column */}
            <motion.div variants={item} className="space-y-6">
              {/* Upcoming Deadlines */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertCircle className="h-4 w-4 text-accent" />
                    Upcoming Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cases.filter((c) => c.next_deadline).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                  ) : (
                    cases
                      .filter((c) => c.next_deadline)
                      .slice(0, 3)
                      .map((caseItem) => (
                        <div key={caseItem.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{caseItem.name}</span>
                          </div>
                          <span className="text-accent font-medium">
                            {caseItem.next_deadline
                              ? format(new Date(caseItem.next_deadline), "MMM d, yyyy")
                              : "-"}
                          </span>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              {/* AI Insights */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BrainCircuit className="h-4 w-4 text-accent" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add cases to get AI-powered insights
                    </p>
                  ) : (
                    <>
                      <div className="rounded-lg bg-accent/10 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Suggested Action</p>
                        <p className="text-sm">
                          {activeCases > 0
                            ? `Review your ${activeCases} active case${activeCases > 1 ? "s" : ""} for upcoming deadlines`
                            : "Create your first case to get started"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground mb-1">Quick Tip</p>
                        <p className="text-sm">Upload discovery documents to enable AI analysis</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Legal News */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Newspaper className="h-4 w-4 text-accent" />
                    Legal News
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {newsArticles.map((article, index) => (
                    <div key={index} className="group cursor-pointer">
                      <p className="text-sm font-medium group-hover:text-accent transition-colors line-clamp-2">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{article.source}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                        <span>{article.date}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}