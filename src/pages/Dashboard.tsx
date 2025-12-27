import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Clock,
  FileText,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Plus,
  FolderOpen,
  Calendar,
  Gavel,
  Newspaper,
  ExternalLink,
  BrainCircuit,
} from "lucide-react";

const recentCases = [
  {
    id: 1,
    name: "Smith v. Acme Corp",
    status: "Active",
    type: "Civil Litigation",
    lastActivity: "2 hours ago",
    filesCount: 47,
    deadline: "Jan 15, 2025",
  },
  {
    id: 2,
    name: "Estate of Williams",
    status: "Discovery",
    type: "Probate",
    lastActivity: "Yesterday",
    filesCount: 23,
    deadline: "Feb 1, 2025",
  },
  {
    id: 3,
    name: "Johnson Contract Dispute",
    status: "Pending",
    type: "Contract Law",
    lastActivity: "3 days ago",
    filesCount: 12,
    deadline: "Jan 28, 2025",
  },
];

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

const stats = [
  { label: "Active Cases", value: "12", icon: FolderOpen, change: "+2 this month" },
  { label: "Pending Deadlines", value: "8", icon: Calendar, change: "Next: Jan 15" },
  { label: "Documents Indexed", value: "1,247", icon: FileText, change: "+156 this week" },
  { label: "Trial Prep Sessions", value: "24", icon: Gavel, change: "3 this week" },
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

export default function Dashboard() {
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
                Welcome back! Here's your case overview.
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
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="glass-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-serif font-bold">{stat.value}</p>
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
                  {recentCases.map((caseItem) => (
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
                            <span className="text-xs text-muted-foreground">{caseItem.type}</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{caseItem.filesCount} files</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          caseItem.status === "Active" 
                            ? "bg-green-100 text-green-700" 
                            : caseItem.status === "Discovery"
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {caseItem.status}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">{caseItem.lastActivity}</p>
                      </div>
                    </div>
                  ))}
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
                  {recentCases.map((caseItem) => (
                    <div key={caseItem.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{caseItem.name}</span>
                      </div>
                      <span className="text-accent font-medium">{caseItem.deadline}</span>
                    </div>
                  ))}
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
                  <div className="rounded-lg bg-accent/10 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Suggested Action</p>
                    <p className="text-sm">Review depositions in Smith v. Acme before deadline</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Document Analysis</p>
                    <p className="text-sm">3 inconsistencies detected in Johnson case discovery</p>
                  </div>
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