import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import {
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
  Building2,
  Crown,
} from "lucide-react";

const featureHighlights = [
  {
    title: "40+ AI Legal Specialists",
    description: "A dedicated team of AI legal specialists — attorneys and paralegals across 12 practice areas. Criminal defense, personal injury, family law, immigration, IP, corporate, employment, real estate, bankruptcy, civil litigation, estate, and tax. Deploy them instantly on any case.",
    icon: Users,
    highlight: true,
  },
  {
    title: "AI Agent Orchestration",
    description: "Deploy autonomous AI agents that research, draft, analyze, and prepare simultaneously. Real-time status dashboard shows every agent at work across your entire caseload.",
    icon: BrainCircuit,
    highlight: true,
  },
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
    title: "Trial Simulation & Argument Practice",
    description: "Practice your arguments against an AI opponent. Get real-time feedback on weaknesses, rhetorical effectiveness, and objections before you enter the courtroom.",
    icon: Gavel,
    highlight: true,
  },
  {
    title: "Jury Analysis & Deliberation",
    description: "AI-powered jury simulator runs full deliberations. Test your case against diverse virtual jurors and predict outcomes before trial.",
    icon: Scale,
  },
  {
    title: "Voice-Powered Intake & Firm Reception",
    description: "Clients call in, speak naturally to Maya (AI receptionist), and get automatically screened, scored, and routed—24/7. No human needed for initial intake.",
    icon: MessageSquare,
    highlight: true,
  },
  {
    title: "Secure Video Collaboration",
    description: "Private, encrypted video rooms for case discussions, witness prep, and team strategy sessions—all within your matter workspace.",
    icon: Video,
    highlight: true,
  },
  {
    title: "Deposition & Witness Prep",
    description: "AI generates strategic questions, predicts opposing counsel tactics, and runs mock examinations with realistic witness personas.",
    icon: BookOpen,
  },
  {
    title: "Timeline Generation",
    description: "Automatically build case chronologies from discovery. Link events to source documents with one click.",
    icon: Clock,
  },
  {
    title: "Verdict Prediction & Case Scoring",
    description: "AI analyzes your case strength across 50+ factors, predicts verdict outcomes, and recommends strategy adjustments.",
    icon: TrendingUp,
  },
  {
    title: "Cross-Case Intelligence",
    description: "AI identifies patterns, benchmarks, and winning strategies across all your cases. Learn from every matter you handle.",
    icon: Layers,
  },
];

const workflowSteps = [
  {
    title: "Voice Intake & Screening",
    description: "Clients call in and speak naturally to Maya, the AI receptionist. She screens, scores, and routes cases to the right specialist — 24/7.",
    icon: MessageSquare,
    stats: "Under 5 minutes per intake",
  },
  {
    title: "Deploy AI Agents",
    description: "Launch autonomous agents on any case. They research, analyze discovery, draft documents, and build timelines simultaneously.",
    icon: BrainCircuit,
    stats: "40+ specialists per case",
  },
  {
    title: "Trial Simulation & Strategy",
    description: "Simulate trial arguments, prep witnesses, analyze juries, and predict verdicts — all driven by AI learning from every interaction.",
    icon: Workflow,
    stats: "Days saved per case",
  },
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
    title: "AI Agent Command Center",
    description: "Monitor autonomous AI agents working simultaneously. See real-time status, review outputs, and direct their work.",
  },
  {
    title: "40+ AI Legal Specialists",
    description: "Attorneys and paralegals across 12 practice areas. Each specialist has deep domain expertise and a dedicated paralegal support team.",
  },
  {
    title: "Voice-Powered Firm Reception",
    description: "Maya AI receptionist handles client intake 24/7. Callers get screened, scored, and routed without human intervention.",
  },
  {
    title: "Trial Simulation Engine",
    description: "Practice arguments, prep witnesses, analyze juries, and predict verdicts with AI-powered courtroom training.",
  },
];

const pricingTiers = [
  {
    name: "Professional",
    price: "$499",
    period: "/month",
    description: "For solo practitioners and small firms getting started with AI-powered legal work.",
    icon: Scale,
    features: [
      "Full 40+ AI agent roster",
      "Unlimited cases & OCR",
      "Full discovery automation",
      "Timeline intelligence",
      "Trial simulator access",
      "Email support",
    ],
    cta: "Start 14-Day Trial",
    highlight: false,
  },
  {
    name: "Firm",
    price: "$1,499",
    period: "/month",
    description: "For growing firms with 2–5 attorneys who need shared case access and team analytics.",
    icon: Building2,
    features: [
      "Everything in Professional",
      "2–5 attorney seats",
      "Shared case access & audit logs",
      "Per-attorney agent rosters",
      "Firm-wide analytics dashboard",
      "Priority processing",
      "Phone & email support",
    ],
    cta: "Start 14-Day Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "$4,999",
    period: "/month",
    description: "For large firms that need unlimited seats, custom integrations, and dedicated support.",
    icon: Crown,
    features: [
      "Everything in Firm",
      "Unlimited attorney seats",
      "Custom agent training",
      "White-glove onboarding",
      "SLA & dedicated support",
      "Custom integrations (Clio, Relativity, iManage)",
      "Custom agent training",
    ],
    cta: "Contact Sales",
    highlight: false,
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
                <a href="#agents" className="hover:text-primary transition-colors">AI Agents</a>
                <a href="#features" className="hover:text-primary transition-colors">Features</a>
                <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
                <a href="#workflow" className="hover:text-primary transition-colors">Workflow</a>
              </div>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="hidden md:inline-flex">Sign In</Button>
              </Link>
              <Link to="/login">
                <Button>Request Access</Button>
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
                40+ AI Specialists · 12 Practice Areas · Voice Intake · Trial Simulation
              </div>
              
              <h1 className="text-4xl font-serif font-bold text-primary sm:text-5xl lg:text-6xl leading-tight">
                Your AI-Powered{" "}
                <span className="text-gradient-gold">Law Firm</span>
              </h1>
              
              <p className="max-w-2xl mx-auto text-base text-muted-foreground sm:text-lg leading-relaxed">
                CaseBuddy is the first AI-native legal platform. Deploy 40+ specialized AI agents across 
                12 practice areas, voice-powered client intake, trial simulation, and comprehensive case 
                management — all in one secure workspace.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Link to="/login">
                  <Button size="lg" className="gap-2 text-base px-8">
                    Request Access
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg" className="text-base px-8">
                    See Features
                  </Button>
                </a>
              </div>
              
              <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  14-day full-access trial
                </span>
                <span className="inline-flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent" />
                  AI agents ready on day one
                </span>
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4 text-accent" />
                  SOC 2 compliant infrastructure
                </span>
              </div>
            </motion.div>

            {/* Stats Bar */}
            <motion.div 
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {[
                { value: "40+", label: "AI Legal Specialists" },
                { value: "12", label: "Practice Areas" },
                { value: "100K+", label: "Documents Processed" },
                { value: "24/7", label: "AI Client Intake" },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-serif font-bold text-accent">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
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
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Discovery Engine</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Turn Discovery Dumps Into Winning Evidence
            </h2>
            <p className="max-w-2xl text-muted-foreground text-lg">
              Upload thousands of pages. Our AI reads every document, extracts the facts that matter, 
              and builds your case file automatically.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {discoveryCapabilities.map((cap, index) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="glass-card h-full">
                    <CardHeader>
                      <div className="rounded-lg bg-accent/10 p-2 w-fit mb-2">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <CardTitle className="text-lg">{cap.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{cap.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Agents Section */}
      <section id="agents" className="bg-primary/[0.02] px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">AI Agents</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              40+ Specialists Across 12 Practice Areas
            </h2>
            <p className="max-w-2xl text-muted-foreground text-lg">
              Each AI specialist has a dedicated paralegal support team. Deploy them individually or 
              orchestrate the full firm on complex cases.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { area: "Criminal Defense", agents: "Alex Stone + 2 paralegals" },
              { area: "Personal Injury", agents: "Rosa Martinez + 2 paralegals" },
              { area: "Family Law", agents: "Diana Chen + 2 paralegals" },
              { area: "Immigration", agents: "Daniel Okonkwo + 2 paralegals" },
              { area: "Intellectual Property", agents: "Priya Kapoor + 2 paralegals" },
              { area: "Corporate Law", agents: "Marcus Bennett + 2 paralegals" },
              { area: "Employment Law", agents: "Sarah Williams + 2 paralegals" },
              { area: "Real Estate", agents: "James Mitchell + 2 paralegals" },
              { area: "Bankruptcy", agents: "Lisa Anderson + 2 paralegals" },
              { area: "Civil Litigation", agents: "Robert Lee + 2 paralegals" },
              { area: "Estate Planning", agents: "Emily Davis + 2 paralegals" },
              { area: "Tax Law", agents: "Jennifer Park + 2 paralegals" },
            ].map((item, index) => (
              <motion.div
                key={item.area}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="glass-card">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="rounded-lg bg-accent/10 p-2 flex-shrink-0">
                      <Users className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.area}</p>
                      <p className="text-xs text-muted-foreground">{item.agents}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Features</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Everything Your Practice Needs
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureHighlights.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <Card className={`glass-card h-full ${feature.highlight ? 'border-accent/30' : ''}`}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-accent/10 p-2">
                          <Icon className="h-5 w-5 text-accent" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {feature.description}
                      </CardDescription>
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
                  Request Access
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
              <Button variant="outline">Request Access</Button>
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

      {/* Pricing Section */}
      <section id="pricing" className="bg-primary/[0.02] px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-12">
          <motion.div 
            className="text-center space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-[0.25em] text-accent font-medium">Pricing</p>
            <h2 className="text-3xl font-serif font-bold text-primary sm:text-4xl">
              Plans That Scale With Your Firm
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
              Less than one week of a paralegal's salary. 14-day full-access trial on every plan — no credit card required to start.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier, index) => {
              const Icon = tier.icon;
              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className={`glass-card h-full flex flex-col ${tier.highlight ? 'border-accent/40 ring-2 ring-accent/20' : ''}`}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-accent/10 p-2">
                          <Icon className="h-5 w-5 text-accent" />
                        </div>
                        <CardTitle className="text-xl">{tier.name}</CardTitle>
                      </div>
                      <CardDescription className="text-sm pt-1">{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="mb-6">
                        <span className="text-4xl font-serif font-bold text-primary">{tier.price}</span>
                        <span className="text-muted-foreground ml-1">{tier.period}</span>
                      </div>
                      <ul className="space-y-3 flex-1">
                        {tier.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{feat}</span>
                          </li>
                        ))}
                      </ul>
                      <Link to="/login" className="mt-6">
                        <Button 
                          className={`w-full ${tier.highlight ? '' : 'variant-outline'}`}
                          variant={tier.highlight ? "default" : "outline"}
                        >
                          {tier.cta}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* BYOK Lifetime Banner */}
          <motion.div
            className="rounded-2xl border border-accent/30 bg-accent/[0.03] p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  <Crown className="h-3 w-3" />
                  Lifetime License
                </div>
                <h3 className="text-2xl font-serif font-bold text-primary">BYOK Lifetime — $4,999 one-time</h3>
                <p className="text-muted-foreground max-w-xl">
                  Bring your own OpenAI, Gemini, or Azure API keys. Unlimited everything, forever. 
                  No recurring fees, no usage caps. Pays for itself in 10 months vs. the Professional plan.
                </p>
              </div>
              <Link to="/login">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 whitespace-nowrap">
                  Get Lifetime Access
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
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
            Ready to Deploy Your AI Law Firm?
          </h3>
          <p className="max-w-xl text-primary-foreground/80">
            Join forward-thinking legal teams using CaseBuddy to deploy AI agents, intake clients by voice, 
            simulate trials, and win more cases.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-base px-8">
                Request Access
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#pricing">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base px-8">
                View Pricing
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
            © 2026 CaseBuddy Professional. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
