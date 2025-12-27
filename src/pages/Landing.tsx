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
} from "lucide-react";

const featureHighlights = [
  {
    title: "Evidence Intelligence",
    description: "Ingest discovery files and surface timelines, inconsistencies, and key facts in minutes.",
    icon: FileSearch,
  },
  {
    title: "Trial Readiness",
    description: "Run AI-driven simulations, deposition prep, and strategy coaching for every matter.",
    icon: Gavel,
  },
  {
    title: "Collaborative Casework",
    description: "Coordinate teams with live presence, shared notes, and secure case activity streams.",
    icon: Users,
  },
  {
    title: "Private by Design",
    description: "Every session requires authenticated access. Your client files stay protected.",
    icon: Lock,
  },
];

const workflowSteps = [
  {
    title: "Capture",
    description: "Upload documents, recordings, and images with built-in validation.",
    icon: CloudUpload,
  },
  {
    title: "Analyze",
    description: "Generate timelines, briefs, and discovery summaries with AI assistance.",
    icon: BrainCircuit,
  },
  {
    title: "Execute",
    description: "Stay on deadlines and push filings with clear, auditable case history.",
    icon: Workflow,
  },
];

const securityPoints = [
  "Authenticated sessions required for every case interaction.",
  "Granular audit trails for access, uploads, and case exports.",
  "Encrypted password storage with automatic hash upgrades.",
  "Rate-limited authentication endpoints to deter brute force.",
];

const platformPreview = [
  {
    title: "Matter Command Center",
    description: "Track deadlines, filings, and assignments from one live dashboard.",
  },
  {
    title: "Evidence Vault",
    description: "Keep discovery searchable, tagged, and linked to key facts.",
  },
  {
    title: "Team Activity Ledger",
    description: "See who accessed each file with time-stamped accountability.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        {/* Header */}
        <header className="relative z-10 px-6 py-6 lg:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Logo />
            <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#workflow" className="hover:text-primary transition-colors">Workflow</a>
              <a href="#security" className="hover:text-primary transition-colors">Security</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="hidden md:inline-flex">Sign In</Button>
              </Link>
              <Link to="/login">
                <Button>Enter Platform</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section className="relative z-10 px-6 pb-16 pt-10 lg:px-12 lg:pb-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                AI-native workflow for modern litigation teams
              </div>
              <h1 className="text-3xl font-serif font-bold text-primary sm:text-4xl lg:text-5xl leading-tight">
                Case strategy, evidence intelligence, and secure collaboration{" "}
                <span className="text-gradient-gold">in one workspace.</span>
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base leading-relaxed">
                CaseBuddy turns fragmented case data into coherent, actionable insights. Upload discovery,
                generate briefs, and run trial simulations while protecting every client file behind
                authenticated access.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="lg" className="gap-2">
                    Get Started Securely
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg">Explore Features</Button>
                </a>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  Authenticated access required
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  Real-time case readiness
                </span>
              </div>
            </motion.div>

            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="glass-elevated">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="h-4 w-4 text-accent" />
                      Secure Access Portal
                    </CardTitle>
                    <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-accent font-medium">
                      Login
                    </span>
                  </div>
                  <CardDescription>Sign in to reach the full CaseBuddy platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link to="/login" className="block">
                    <Button className="w-full" size="lg">
                      Continue to Sign In
                    </Button>
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                    Authenticated sessions unlock the full workspace.
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BrainCircuit className="h-4 w-4 text-accent" />
                    Platform Preview
                  </CardTitle>
                  <CardDescription>
                    What opens up after secure sign-in.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {platformPreview.map((item) => (
                    <div key={item.title} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </div>

      {/* Features Section */}
      <section id="features" className="px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-10">
          <motion.div 
            className="space-y-3 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium">Features</p>
            <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">
              Everything you need to move a case forward.
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
              CaseBuddy unifies discovery, AI analysis, collaboration, and security into a single, controlled
              workspace built for legal teams.
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
                  <Card className="glass-card h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div className="rounded-lg bg-accent/10 p-2">
                          <Icon className="h-4 w-4 text-accent" />
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

      {/* Workflow Section */}
      <section id="workflow" className="bg-muted/30 px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium">Workflow</p>
              <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">
                A focused path from intake to trial readiness.
              </h2>
            </motion.div>
            <Link to="/login">
              <Button variant="outline">Secure Sign In</Button>
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
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
                  <Card className="glass-card h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          {step.title}
                        </span>
                        <span className="text-2xl font-serif font-bold text-accent/40">
                          0{index + 1}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {step.description}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="px-6 py-16 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium">Security</p>
            <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">
              Built for confidentiality and compliance.
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              CaseBuddy requires authenticated access for every action. Your evidence and client files are
              safeguarded with session controls and audit logging.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              End-to-end access accountability
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
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4 text-accent" />
                  Security Checklist
                </CardTitle>
                <CardDescription>Hardening defaults that protect sensitive matters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {securityPoints.map((point, index) => (
                  <motion.div 
                    key={point} 
                    className="flex items-start gap-2"
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>{point}</span>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-16 lg:px-12">
        <motion.div 
          className="mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-2xl glass-elevated px-6 py-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Scale className="h-12 w-12 text-accent" />
          <h3 className="text-xl font-serif font-bold text-primary sm:text-2xl">
            Ready to work securely?
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Sign in to access your matters, manage evidence, and keep client files protected behind secure login.
          </p>
          <Link to="/login">
            <Button size="lg" className="gap-2">
              Enter CaseBuddy
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
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