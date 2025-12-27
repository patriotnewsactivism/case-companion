import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileSearch,
  BrainCircuit,
  Gavel,
  Clock,
  Users,
  Lock,
  Workflow,
  Sparkles,
  CloudUpload,
  CheckCircle2,
  ArrowRight,
  Scale,
  FileText,
  Video,
  MessageSquare,
  Zap,
  Eye,
  AlertTriangle,
  TrendingUp,
  Search,
  Layers,
  BookOpen,
} from "lucide-react";

const featureHighlights = [
  {
    title: "AI-Powered Discovery Analysis",
    description: "Upload thousands of discovery documents and let AI extract key facts, identify inconsistencies, and surface favorable evidence in minutes—not weeks.",
    icon: FileSearch,
    highlight: true,
  },
  {
    title: "Smart Evidence Indexing",
    description: "Automatic Bates numbering, full-text search, and AI-generated summaries. Find the needle in the haystack instantly.",
    icon: Search,
  },
  {
    title: "Favorable vs Adverse Findings",
    description: "AI automatically categorizes evidence as supporting or damaging to your case theory, helping you prepare for every angle.",
    icon: TrendingUp,
  },
  {
    title: "Inconsistency Detection",
    description: "Cross-reference witness statements, contracts, and documents. AI flags contradictions you can exploit at trial.",
    icon: AlertTriangle,
  },
  {
    title: "Secure Video Collaboration",
    description: "Private, encrypted video rooms for case discussions, witness prep, and team strategy sessions—all within your matter workspace.",
    icon: Video,
    highlight: true,
  },
  {
    title: "AI Trial Simulation",
    description: "Practice your arguments against an AI opponent. Get real-time feedback on weaknesses and objections before you enter the courtroom.",
    icon: Gavel,
  },
  {
    title: "Deposition Prep Assistant",
    description: "AI generates strategic questions based on your case theory, witness profiles, and discovered inconsistencies.",
    icon: MessageSquare,
  },
  {
    title: "Timeline Generation",
    description: "Automatically build case chronologies from discovery. Link events to source documents with one click.",
    icon: Clock,
  },
];

const workflowSteps = [
  {
    title: "Upload & Ingest",
    description: "Drop your discovery files—PDFs, emails, documents. AI extracts text, applies Bates numbers, and begins analysis immediately.",
    icon: CloudUpload,
    stats: "10,000+ pages per hour",
  },
  {
    title: "AI Analysis",
    description: "Every document gets a summary, key facts extraction, and classification into favorable/adverse/neutral findings for your case theory.",
    icon: BrainCircuit,
    stats: "Seconds per document",
  },
  {
    title: "Strategy & Prep",
    description: "Generate timelines, prep deposition questions, run trial simulations. Collaborate via secure video with your team.",
    icon: Workflow,
    stats: "Days saved per case",
  },
];

const securityPoints = [
  "End-to-end encrypted video calls within your case workspace",
  "Authenticated sessions required for every case interaction",
  "Granular audit trails for access, uploads, and case exports",
  "Private AI processing—your data never trains external models",
  "SOC 2 compliant infrastructure with 99.9% uptime",
];

const discoveryCapabilities = [
  {
    title: "Massive Scale Processing",
    description: "Handle discovery productions with 100,000+ documents. Our AI processes and indexes at scale.",
    icon: Layers,
  },
  {
    title: "OCR & Text Extraction",
    description: "Scanned documents, images, handwritten notes—everything becomes searchable and analyzable.",
    icon: Eye,
  },
  {
    title: "Smart Categorization",
    description: "AI auto-categorizes by document type, date, parties involved, and relevance to key issues.",
    icon: BookOpen,
  },
  {
    title: "Lightning Search",
    description: "Full-text search across all documents. Find specific phrases, names, or dates instantly.",
    icon: Zap,
  },
];

const platformPreview = [
  {
    title: "Matter Command Center",
    description: "Track deadlines, filings, discovery status, and team activity from one live dashboard.",
  },
  {
    title: "Evidence Intelligence Hub",
    description: "View all favorable and adverse findings, inconsistencies, and key facts in one place.",
  },
  {
    title: "Video War Room",
    description: "Private video conferencing for case strategy, witness prep, and team collaboration.",
  },
  {
    title: "AI Assistant",
    description: "Ask questions about your case, get deposition strategies, and simulate trial scenarios.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute -top-40 -right-32 h-[500px] w-[500px] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-accent/5 blur-3xl" />

        {/* Header */}
        <header className="relative z-10 px-6 py-6 lg:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Logo />
            <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#discovery" className="hover:text-primary transition-colors">Discovery AI</a>
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#workflow" className="hover:text-primary transition-colors">Workflow</a>
              <a href="#security" className="hover:text-primary transition-colors">Security</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="hidden md:inline-flex">Sign In</Button>
              </Link>
              <Link to="/login">
                <Button>Start Free Trial</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 px-6 pb-20 pt-12 lg:px-12 lg:pb-28">
          <div className="mx-auto max-w-6xl">
            <motion.div 
              className="text-center max-w-4xl mx-auto space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent font-medium">
                <Sparkles className="h-4 w-4" />
                Process 10,000+ discovery pages in hours, not weeks
              </div>
              
              <h1 className="text-4xl font-serif font-bold text-primary sm:text-5xl lg:text-6xl leading-tight">
                Turn Massive Discovery Into{" "}
                <span className="text-gradient-gold">Winning Strategy</span>
              </h1>
              
              <p className="max-w-2xl mx-auto text-base text-muted-foreground sm:text-lg leading-relaxed">
                CaseBuddy is the AI-powered legal platform that processes enormous discovery productions, 
                extracts favorable evidence, flags inconsistencies, and prepares you for trial—all in a 
                secure, collaborative workspace with private video conferencing.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Link to="/login">
                  <Button size="lg" className="gap-2 text-base px-8">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#discovery">
                  <Button variant="outline" size="lg" className="text-base px-8">
                    See Discovery AI
                  </Button>
                </a>
              </div>
              
              <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  SOC 2 compliant
                </span>
                <span className="inline-flex items-center gap-2">
                  <Video className="h-4 w-4 text-accent" />
                  Private video rooms included
                </span>
              </div>
            </motion.div>

            {/* Stats Bar */}
            <motion.div 
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {[
                { value: "10M+", label: "Documents Processed" },
                { value: "500+", label: "Law Firms" },
                { value: "95%", label: "Time Saved on Discovery" },
                { value: "99.9%", label: "Uptime SLA" },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-3xl lg:text-4xl font-serif font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      </div>

      {/* Discovery AI Section */}
      <section id="discovery" className="bg-primary/[0.02] px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <motion.div 
            className="text-center space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Discovery AI</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Process Massive Discovery Productions in Hours
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Stop drowning in documents. Our AI reads, analyzes, and categorizes every page of discovery 
              so you can focus on strategy, not document review.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {discoveryCapabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <motion.div
                  key={capability.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="glass-card h-full text-center">
                    <CardContent className="pt-6 space-y-4">
                      <div className="mx-auto rounded-full bg-accent/10 p-4 w-fit">
                        <Icon className="h-6 w-6 text-accent" />
                      </div>
                      <h3 className="font-serif font-bold text-primary">{capability.title}</h3>
                      <p className="text-sm text-muted-foreground">{capability.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Evidence Analysis Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="glass-elevated overflow-hidden">
              <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-green-100 p-2">
                      <TrendingUp className="h-5 w-5 text-green-700" />
                    </div>
                    <h3 className="font-serif font-bold text-primary">Favorable Findings</h3>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Email confirms defendant was aware of defect (DOC-0234)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Internal memo contradicts public statement (DOC-0891)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Witness deposition supports timeline (DEP-023)</span>
                    </li>
                  </ul>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-red-100 p-2">
                      <AlertTriangle className="h-5 w-5 text-red-700" />
                    </div>
                    <h3 className="font-serif font-bold text-primary">Adverse Findings</h3>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span>Client email may show prior knowledge (DOC-1234)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span>Expert report challenges causation theory (EXP-012)</span>
                    </li>
                  </ul>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-accent/20 p-2">
                      <Zap className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="font-serif font-bold text-primary">Inconsistencies Found</h3>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Witness A contradicts Witness B on meeting date</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Invoice dates don't match delivery records</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Contract terms differ between versions</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <motion.div 
            className="space-y-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Features</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Everything You Need to Win Your Case
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              From initial discovery to trial day, CaseBuddy provides AI-powered tools and secure 
              collaboration features that give you the edge.
            </p>
          </motion.div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {featureHighlights.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className={`glass-card h-full hover:shadow-lg transition-shadow ${feature.highlight ? 'border-accent/30 bg-accent/5' : ''}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-lg">
                        <div className={`rounded-lg p-2 ${feature.highlight ? 'bg-accent/20' : 'bg-primary/10'}`}>
                          <Icon className={`h-5 w-5 ${feature.highlight ? 'text-accent' : 'text-primary'}`} />
                        </div>
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {feature.description}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Video Collaboration Section */}
      <section className="bg-primary px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/20 px-3 py-1 text-sm text-accent font-medium">
                <Video className="h-4 w-4" />
                Private Video Rooms
              </div>
              <h2 className="text-3xl font-serif font-bold text-primary-foreground sm:text-4xl">
                Secure Video Collaboration Built for Legal Teams
              </h2>
              <p className="text-primary-foreground/80">
                Hold private strategy sessions, prep witnesses, and collaborate with co-counsel—all within 
                encrypted video rooms tied to your case workspace. No third-party apps, no security risks.
              </p>
              <ul className="space-y-3">
                {[
                  "End-to-end encrypted video conferencing",
                  "Screen sharing with document annotation",
                  "Recording & transcription for case records",
                  "Invite external participants with secure links",
                  "Integrated with case timeline & evidence",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-primary-foreground/90">
                    <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                  Try Video Rooms Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl bg-navy-light/50 border border-primary-foreground/10 p-8 backdrop-blur">
                <div className="aspect-video rounded-lg bg-navy-dark/50 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent" />
                  <div className="relative z-10 text-center">
                    <div className="mx-auto rounded-full bg-accent/20 p-6 w-fit mb-4">
                      <Video className="h-12 w-12 text-accent" />
                    </div>
                    <p className="text-primary-foreground font-medium">Secure Video Room</p>
                    <p className="text-primary-foreground/60 text-sm">Smith v. Acme Corp - Strategy Session</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex-1 rounded-lg bg-navy-dark/50 p-3 text-center">
                    <Users className="h-5 w-5 text-accent mx-auto mb-1" />
                    <p className="text-xs text-primary-foreground/60">4 Participants</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-navy-dark/50 p-3 text-center">
                    <Lock className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xs text-primary-foreground/60">End-to-End Encrypted</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-navy-dark/50 p-3 text-center">
                    <FileText className="h-5 w-5 text-accent mx-auto mb-1" />
                    <p className="text-xs text-primary-foreground/60">Auto-Transcribe</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Workflow</p>
              <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
                From Discovery Dump to Trial Ready
              </h2>
            </motion.div>
            <Link to="/login">
              <Button variant="outline">Start Free Trial</Button>
            </Link>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  <Card className="glass-card h-full relative overflow-hidden">
                    <div className="absolute top-4 right-4 text-6xl font-serif font-bold text-accent/10">
                      0{index + 1}
                    </div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-lg">
                        <div className="rounded-lg bg-accent/10 p-2">
                          <Icon className="h-5 w-5 text-accent" />
                        </div>
                        {step.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                        <Zap className="h-3 w-3" />
                        {step.stats}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="bg-muted/30 px-6 py-20 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Security</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Enterprise-Grade Security for Sensitive Cases
            </h2>
            <p className="text-muted-foreground">
              Attorney-client privilege demands the highest security standards. CaseBuddy provides 
              end-to-end encryption, compliance certifications, and complete audit trails.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                <ShieldCheck className="h-4 w-4" />
                SOC 2 Type II
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                <Lock className="h-4 w-4" />
                256-bit Encryption
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                <Eye className="h-4 w-4" />
                Full Audit Trail
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="glass-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-accent" />
                  Security Features
                </CardTitle>
                <CardDescription>Protecting your client's most sensitive information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {securityPoints.map((point, index) => (
                  <motion.div 
                    key={point} 
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{point}</span>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Platform Preview Section */}
      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <motion.div 
            className="text-center space-y-4 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Platform</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Your Complete Case Command Center
            </h2>
          </motion.div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {platformPreview.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="glass-card h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                      <div>
                        <h3 className="font-serif font-bold text-primary mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-20 lg:px-12">
        <motion.div 
          className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-2xl bg-primary px-8 py-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Scale className="h-16 w-16 text-accent" />
          <h3 className="text-2xl font-serif font-bold text-primary-foreground sm:text-3xl">
            Ready to Transform Your Discovery Process?
          </h3>
          <p className="max-w-xl text-primary-foreground/80">
            Join 500+ law firms using CaseBuddy to process discovery faster, find winning evidence, 
            and collaborate securely with their teams.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-base px-8">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base px-8">
                Learn More
              </Button>
            </a>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">
            © 2025 CaseBuddy Professional. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}