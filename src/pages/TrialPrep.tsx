import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { useState } from "react";
import {
  Gavel,
  Plus,
  Users,
  ClipboardList,
  MessageSquare,
  Video,
  FileText,
  CheckSquare,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

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

const trialChecklistItems = [
  { id: 1, task: "Prepare opening statement", completed: true, category: "Statements" },
  { id: 2, task: "Draft witness examination questions", completed: true, category: "Witnesses" },
  { id: 3, task: "Organize exhibit binders", completed: false, category: "Exhibits" },
  { id: 4, task: "Review jury instructions", completed: false, category: "Instructions" },
  { id: 5, task: "Prepare closing argument", completed: false, category: "Statements" },
  { id: 6, task: "Create demonstrative exhibits", completed: false, category: "Exhibits" },
  { id: 7, task: "Prepare witness list", completed: true, category: "Witnesses" },
  { id: 8, task: "File motions in limine", completed: false, category: "Motions" },
];

const upcomingMockTrials = [
  {
    title: "Mock Opening Statement Practice",
    date: "Jan 5, 2026",
    participants: 4,
    duration: "2 hours",
  },
  {
    title: "Witness Cross-Examination Rehearsal",
    date: "Jan 8, 2026",
    participants: 6,
    duration: "3 hours",
  },
];

export default function TrialPrep() {
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const [checklist, setChecklist] = useState(trialChecklistItems);

  const toggleChecklistItem = (id: number) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedItems = checklist.filter(item => item.completed).length;
  const progressPercentage = (completedItems / checklist.length) * 100;

  const trialReadyCases = cases.filter(c => c.status === "active" || c.status === "review").length;

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
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">Trial Preparation</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Organize witnesses, exhibits, and trial strategy
              </p>
            </div>
            <Button className="gap-2">
              <Video className="h-4 w-4" />
              Start Video Session
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Cases in Prep</p>
                    <p className="text-3xl font-serif font-bold">
                      {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : trialReadyCases}
                    </p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Gavel className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Mock Trials</p>
                    <p className="text-3xl font-serif font-bold">{upcomingMockTrials.length}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Witnesses</p>
                    <p className="text-3xl font-serif font-bold">12</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Exhibits Ready</p>
                    <p className="text-3xl font-serif font-bold">45</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <motion.div variants={item} className="lg:col-span-2 space-y-6">
              {/* Checklist */}
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-accent" />
                        Trial Preparation Checklist
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {completedItems} of {checklist.length} tasks completed
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                  <Progress value={progressPercentage} className="mt-4" />
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="all" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="all">All Tasks</TabsTrigger>
                      <TabsTrigger value="pending">Pending</TabsTrigger>
                      <TabsTrigger value="completed">Completed</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="space-y-2">
                      {checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleChecklistItem(item.id)}
                          />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {item.task}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.category}</p>
                          </div>
                          {item.completed && (
                            <CheckSquare className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="pending" className="space-y-2">
                      {checklist.filter(item => !item.completed).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleChecklistItem(item.id)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.task}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.category}</p>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="completed" className="space-y-2">
                      {checklist.filter(item => item.completed).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleChecklistItem(item.id)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium line-through text-muted-foreground">
                              {item.task}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.category}</p>
                          </div>
                          <CheckSquare className="h-4 w-4 text-green-600" />
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Active Cases */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Cases in Trial Preparation</CardTitle>
                  <CardDescription>Cases currently being prepared for trial</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : trialReadyCases === 0 ? (
                    <div className="text-center py-8">
                      <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No cases in trial prep</h3>
                      <p className="text-muted-foreground text-sm">
                        Active cases will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cases
                        .filter(c => c.status === "active" || c.status === "review")
                        .map((caseItem) => (
                          <div
                            key={caseItem.id}
                            className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-primary/10 p-2">
                                <Gavel className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{caseItem.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {caseItem.case_type}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={item} className="space-y-6">
              {/* Mock Trials */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Video className="h-4 w-4 text-accent" />
                    Mock Trials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingMockTrials.map((trial, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 pb-3 border-b border-border/50 last:border-0"
                    >
                      <p className="text-sm font-medium">{trial.title}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{trial.date}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {trial.participants}
                        </span>
                        <span>{trial.duration}</span>
                      </div>
                    </div>
                  ))}
                  <Button className="w-full mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Schedule Mock Trial
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <FileText className="h-4 w-4" />
                    Upload Exhibit
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Add Witness
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Prep Notes
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Video className="h-4 w-4" />
                    Video Conference
                  </Button>
                </CardContent>
              </Card>

              {/* Trial Tips */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">Trial Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Practice your opening 10+ times</li>
                    <li>• Organize exhibits chronologically</li>
                    <li>• Prep witnesses on cross-examination</li>
                    <li>• Create visual aids for complex topics</li>
                    <li>• Review jury instructions early</li>
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
