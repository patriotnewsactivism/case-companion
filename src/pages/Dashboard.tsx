import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases, getDocumentStats } from "@/lib/api";
import {
  ArrowRight,
  Plus,
  TrendingUp,
  AlertCircle,
  FileText,
  Loader2,
  Scale,
  FolderOpen,
} from "lucide-react";
import { format } from "date-fns";

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

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

export default function Dashboard() {
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const { data: documentStats } = useQuery({
    queryKey: ["document-stats"],
    queryFn: getDocumentStats,
  });

  const activeCases = cases.filter((c) => c.status === "active").length;
  const casesWithDeadlines = cases.filter((c) => c.next_deadline).length;
  const totalDocuments = documentStats?.total ?? 0;
  const analyzedDocuments = documentStats?.analyzed ?? 0;

  const recentCases = cases.slice(0, 5);

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
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-serif font-bold text-primary">
                {getGreeting()},<br />Counselor.
              </h1>
              <p className="text-muted-foreground text-sm mt-2">
                Here is your case overview for today, {format(new Date(), "MMMM d, yyyy")}.
              </p>
            </div>
            <Link to="/cases">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Case Intake
              </Button>
            </Link>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active Matters */}
            <Card className="glass-card overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-amber-500" />
                <CardContent className="p-6 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ACTIVE MATTERS
                  </p>
                  <p className="text-4xl font-serif font-bold mt-2">
                    {isLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : activeCases}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-sm text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>{cases.length} total cases</span>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* Upcoming Deadlines */}
            <Card className="glass-card overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-red-500" />
                <CardContent className="p-6 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    UPCOMING DEADLINES
                  </p>
                  <p className="text-4xl font-serif font-bold mt-2">
                    {isLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : casesWithDeadlines}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>Cases with deadlines set</span>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* Total Documents */}
            <Card className="glass-card overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-blue-500" />
                <CardContent className="p-6 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    TOTAL DOCUMENTS
                  </p>
                  <p className="text-4xl font-serif font-bold mt-2">
                    {isLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : totalDocuments}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>In discovery system</span>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* AI Analyzed */}
            <Card className="glass-card overflow-hidden">
              <div className="flex">
                <div className="w-1.5 bg-green-500" />
                <CardContent className="p-6 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    AI ANALYZED
                  </p>
                  <p className="text-4xl font-serif font-bold mt-2">
                    {isLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : analyzedDocuments}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 text-sm text-green-600">
                    <Scale className="h-4 w-4" />
                    <span>Documents processed</span>
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <Link to="/cases">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                  View All Cases
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <Card className="glass-card">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : recentCases.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No recent activity</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Create your first case to get started
                    </p>
                    <Link to="/cases">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        New Case Intake
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentCases.map((caseItem) => (
                      <Link
                        key={caseItem.id}
                        to={`/cases/${caseItem.id}`}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg bg-primary/10 p-2.5">
                            <FolderOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{caseItem.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{caseItem.case_type}</span>
                              {caseItem.client_name && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{caseItem.client_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            caseItem.status === "active" ? "bg-green-100 text-green-700" :
                            caseItem.status === "discovery" ? "bg-amber-100 text-amber-700" :
                            caseItem.status === "pending" ? "bg-gray-100 text-gray-700" :
                            caseItem.status === "review" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {caseItem.status}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(caseItem.updated_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}
