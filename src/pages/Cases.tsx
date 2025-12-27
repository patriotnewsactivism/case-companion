import { Layout } from "@/components/Layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  FolderOpen,
  Clock,
  FileText,
  MoreVertical,
  Calendar,
  Users,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const cases = [
  {
    id: 1,
    name: "Smith v. Acme Corp",
    status: "Active",
    type: "Civil Litigation",
    client: "John Smith",
    lastActivity: "2 hours ago",
    filesCount: 47,
    deadline: "Jan 15, 2025",
    representation: "Plaintiff",
  },
  {
    id: 2,
    name: "Estate of Williams",
    status: "Discovery",
    type: "Probate",
    client: "Williams Family Trust",
    lastActivity: "Yesterday",
    filesCount: 23,
    deadline: "Feb 1, 2025",
    representation: "Executor",
  },
  {
    id: 3,
    name: "Johnson Contract Dispute",
    status: "Pending",
    type: "Contract Law",
    client: "Johnson LLC",
    lastActivity: "3 days ago",
    filesCount: 12,
    deadline: "Jan 28, 2025",
    representation: "Defendant",
  },
  {
    id: 4,
    name: "Davis Personal Injury",
    status: "Active",
    type: "Personal Injury",
    client: "Maria Davis",
    lastActivity: "1 week ago",
    filesCount: 89,
    deadline: "Mar 10, 2025",
    representation: "Plaintiff",
  },
  {
    id: 5,
    name: "Thompson IP Case",
    status: "Review",
    type: "Intellectual Property",
    client: "Thompson Tech Inc.",
    lastActivity: "2 weeks ago",
    filesCount: 156,
    deadline: "Apr 5, 2025",
    representation: "Plaintiff",
  },
  {
    id: 6,
    name: "Chen Employment Matter",
    status: "Active",
    type: "Employment Law",
    client: "Lisa Chen",
    lastActivity: "4 days ago",
    filesCount: 34,
    deadline: "Feb 20, 2025",
    representation: "Plaintiff",
  },
];

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
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function Cases() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCases = cases.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700";
      case "Discovery":
        return "bg-accent/20 text-accent";
      case "Pending":
        return "bg-muted text-muted-foreground";
      case "Review":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-6"
        >
          {/* Header */}
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-serif font-bold">My Cases</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {cases.length} total cases • {cases.filter(c => c.status === "Active").length} active
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Case
            </Button>
          </motion.div>

          {/* Search and Filters */}
          <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </motion.div>

          {/* Cases Grid */}
          <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCases.map((caseItem) => (
              <motion.div key={caseItem.id} variants={item}>
                <Card className="glass-card h-full hover:shadow-lg transition-all cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-accent/20 transition-colors">
                          <FolderOpen className="h-5 w-5 text-primary group-hover:text-accent transition-colors" />
                        </div>
                        <div>
                          <CardTitle className="text-base line-clamp-1">{caseItem.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">{caseItem.type}</CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Case</DropdownMenuItem>
                          <DropdownMenuItem>Upload Files</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                        {caseItem.status}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {caseItem.representation}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span className="truncate">{caseItem.client}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{caseItem.filesCount} documents</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Deadline: {caseItem.deadline}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{caseItem.lastActivity}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-accent">
                        Open →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {filteredCases.length === 0 && (
            <motion.div variants={item} className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No cases found</h3>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search or create a new case
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}