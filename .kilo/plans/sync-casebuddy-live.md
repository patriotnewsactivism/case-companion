# Sync & Improve: case-companion → casebuddy.live

## Overview

The current repo (`case-companion`) and `casebuddy-ai-law-partner` (what's deployed at casebuddy.live) have diverged significantly. This plan ports the best features from each into a unified architecture, then deploys to casebuddy.live.

## Architecture Comparison

| Aspect | case-companion (current) | casebuddy-ai-law-partner (live) |
|---|---|---|
| **Structure** | `src/` organized (pages/, components/, hooks/, lib/, services/) | Flat (components/, services/ at root) |
| **Backend** | Supabase Edge Functions | Vercel API routes + Netlify functions |
| **UI Framework** | shadcn/ui (Radix-based) | Custom CSS + Tailwind |
| **Router** | React Router v6 (@/* alias to src/) | React Router v7 (@/* alias to root) |
| **React** | v18 | v19 |
| **State** | React Query + Zustand | Context + localStorage |
| **Toasts** | sonner | react-toastify |
| **Testing** | Vitest + Playwright | None |
| **Styling** | Tailwind + shadcn components | Tailwind + custom classes |
| **Auth** | AuthProvider + ProtectedRoute | AuthService + AuthGate context |
| **Deploy** | Vercel + Supabase Edge Functions | Vercel + Netlify functions |

## What casebuddy-ai-law-partner Has That We Don't

### High-Value Features to Port

1. **AI Agent Orchestration System**
   - `services/agentOrchestrator.ts` — coordinates multi-agent workflows
   - `services/agentReasoning.ts` — DeepSeek/Gemini reasoning chains
   - `services/agentMemory.ts` — short/long-term memory for agents
   - `services/agentLearning.ts` — learns from user feedback
   - `services/backgroundAgentEngine.ts` — autonomous background processing
   - `services/caseMonitor.ts` — monitors for deadlines, triggers
   - `components/AgentStatusDashboard.tsx` — live agent status UI
   - `components/AgentChat.tsx` — chat UI for agent interactions

2. **Voice & Telephony**
   - `services/deepgramService.ts` — real-time speech-to-text
   - `hooks/useDeepgramVoiceAgent.ts` — voice agent hook
   - `api/twilio-voice.ts` — Twilio voice call handling
   - `api/twilio-actions.ts` — Twilio action webhooks
   - `components/VoiceRoom.tsx` / `VoiceMicButton.tsx` / `FloatingVoiceButton.tsx`

3. **Client Intake System**
   - `services/intakeService.ts` — intake processing logic
   - `services/intakeStore.ts` — intake state management
   - `components/IntakePage.tsx` / `PublicIntake.tsx` / `IntakeInbox.tsx` / `IntakeWidget.tsx`
   - `components/ClientPortal.tsx` — client self-service portal

4. **Multi-Tenant Firm Structure**
   - `services/firmComms.ts` — inter-firm communication
   - `components/FirmReception.tsx` / `FirmAdminPanel.tsx`
   - `components/ActiveCaseBar.tsx` — global case context
   - Migration: `0008_firm_membership_rls.sql`, `0009_strict_attorney_client_rls.sql`

5. **AI Lawyer Specialists**
   - `agents/personas.ts` — 12 specialist AI lawyer definitions
   - `components/LegalTeam.tsx` — lawyer roster UI
   - `components/WarRoom.tsx` — orchestrated task execution UI
   - `components/CaseOrchestrator.tsx` — "Deploy the Firm" command center

6. **CourtListener Integration**
   - `services/courtListenerService.ts` — free legal research API

7. **Additional Pages/Components**
   - `components/JurySimulator.tsx` — full jury deliberation sim
   - `components/ArgumentPractice.tsx` — practice argument delivery
   - `components/VerdictPredictor.tsx` — predict outcomes
   - `components/DepositionPrep.tsx` — deposition strategy
   - `components/LandingPage.tsx` — polished marketing page
   - `components/CaseManager.tsx` — kanban-style case mgmt
   - `components/CaseThread.tsx` — threaded case discussions
   - `components/EvidenceTimeline.tsx` — evidence chronology
   - `components/DeadlineTracker.tsx` / `DeadlineEngine.tsx`
   - `components/FoiaCenter.tsx` / `FOIATracker.tsx`
   - `components/IntercomPanel.tsx` — in-app messaging
   - `components/WitnessPrep.tsx` — witness prep workflow
   - `components/Transcriber.tsx` — audio/video transcription UI
   - `components/UserGuide.tsx` — in-app user documentation
   - `components/AICopilot.tsx` / `CopilotSidebar.tsx` — AI assistant
   - `components/CrossCasePanel.tsx` — cross-case intelligence
   - `components/WorkflowVisualizer.tsx` — workflow DAG view

8. **Database Migrations (Supabase)**
   - Agent tables: `firm_runs`, `work_products`, `agent_memory`
   - Firm membership tables
   - Intake tables with RLS
   - Email/call recording tables
   - Client invite tokens

## What We Have That They Don't

- **Proper component library** (shadcn/ui — 50+ accessible primitives)
- **Comprehensive test suite** (unit + integration + e2e)
- **Supabase Edge Functions** (30+ functions for OCR, AI, video, etc.)
- **Video conferencing** (Daily.co integration)
- **Billing/Stripe** integration
- **Settlement analysis** system
- **CaseMotionGenerator** with docx export
- **Analytics system** with recharts dashboards
- **Cache & offline** support
- **Conflict checking** module
- **OCR pipeline** with Tesseract + Azure Document Intelligence
- **Google Drive** import
- **Azure Bot Chat** integration

## Implementation Plan

### Phase 1: Fix Current Deployment → casebuddy.live ✅
- [x] Fix `vite.config.ts` base path (`/case-companion/` → `/`)
- [ ] Update `vercel.json` to match casebuddy-ai-law-partner config (cron jobs, CORS headers)
- [ ] Update `index.html` branding/title to match `casebuddy.live`
- [ ] Add `manifest.json` for PWA support
- [ ] Verify build passes cleanly
- [ ] Deploy to casebuddy.live Vercel project

### Phase 2: Branding & Content Alignment
- [ ] Update page title, meta tags, favicon to match casebuddy.live
- [ ] Align `Landing.tsx` with `LandingPage.tsx` (polished marketing copy, CTA)
- [ ] Add/update pricing page from casebuddy components
- [ ] Add privacy policy and terms of service pages
- [ ] Add AI disclaimer component

### Phase 3: Port AI Agent System
- [ ] Create `src/services/agents/` directory
- [ ] Port `agentOrchestrator.ts` — adapt to use Supabase Edge Functions instead of Vercel API
- [ ] Port `agentMemory.ts` — store memories in Supabase `agent_memory` table
- [ ] Port `agentReasoning.ts` — use OpenRouter/DeepSeek (current stack) instead of Gemini
- [ ] Port `agentLearning.ts` — wire into feedback mechanisms
- [ ] Port `backgroundAgentEngine.ts` — schedule via Supabase cron or pg_cron
- [ ] Port `caseMonitor.ts` — trigger workflows on case changes
- [ ] Create AgentStatusDashboard page component
- [ ] Create AgentChat component for interacting with agents
- [ ] Add Supabase migrations for agent tables (`firm_runs`, `work_products`, `agent_memory`)

### Phase 4: Port Voice & Telephony
- [ ] Port `deepgramService.ts` → `src/services/voice/deepgramService.ts`
- [ ] Port `useDeepgramVoiceAgent.ts` → `src/hooks/useDeepgramVoiceAgent.ts`
- [ ] Create Twilio webhook handlers as Supabase Edge Functions
- [ ] Port voice UI components (`VoiceRoom`, `VoiceMicButton`, `FloatingVoiceButton`)
- [ ] Add call recording storage + transcription pipeline

### Phase 5: Port Client Intake System
- [ ] Port `intakeService.ts` + `intakeStore.ts` → `src/services/intake/`
- [ ] Add Supabase migrations for intake tables with firm-scoped RLS
- [ ] Create `IntakePage`, `PublicIntake`, `IntakeInbox`, `IntakeWidget` pages
- [ ] Create `ClientPortal` page
- [ ] Wire intake into case creation flow

### Phase 6: Port Multi-Tenant Firm System
- [ ] Add firm membership migrations
- [ ] Port `firmComms.ts` service
- [ ] Create `FirmReception` + `FirmAdminPanel` pages
- [ ] Add `ActiveCaseBar` for global case context
- [ ] Refactor RLS policies to use firm-scoped access

### Phase 7: Port High-Value Courtroom Features
- [ ] Port `JurySimulator` → reuse existing `MockJury` architecture
- [ ] Port `ArgumentPractice` → integrate with `TrialSimulator`
- [ ] Port `VerdictPredictor` → integrate with analytics
- [ ] Port `DepositionPrep` → integrate with discovery
- [ ] Port `EvidenceTimeline` → integrate with `TimelineView`
- [ ] Port `WarRoom` → unified dashboard for agent orchestration
- [ ] Port `DraftingAssistant` → integrate with `CaseMotionGenerator`
- [ ] Port `CaseThread` → threaded discussions per case
- [ ] Port `LegalTeam` → AI specialist roster UI
- [ ] Port `CopilotSidebar` → persistent AI assistant panel
- [ ] Port `CrossCasePanel` → cross-case intelligence

### Phase 8: Polish & Hardening
- [ ] Align `index.css` with casebuddy gold/slate theme
- [ ] Add/align CSS animations (glow, shimmer, fade-in)
- [ ] Add PWA manifest and service worker
- [ ] Fix remaining edge cases in routing (BrowserRouter vs HashRouter)
- [ ] Run full test suite and fix failures
- [ ] Add missing tests for ported components
- [ ] Run `npm run build` and `npm run lint`

## Priority Ordering

**Immediate (Phase 1-2):** Fix deployment, align branding → can ship now
**High (Phase 3-4):** AI agents + voice features → biggest differentiation
**Medium (Phase 5-6):** Intake + firm multi-tenancy → core business value
**Lower (Phase 7-8):** Courtroom features + polish → continuous improvement

## Risk & Mitigation

- **Risk:** casebuddy-ai-law-partner uses React 19 + React Router v7; current repo uses React 18 + v6
  - **Mitigation:** Port components one at a time, adapting imports. React 18→19 migration should be a separate epic.
- **Risk:** Vercel API routes vs Supabase Edge Functions — agent code paths differ
  - **Mitigation:** Wrap agent services to work with both; prefer Supabase EF for production
- **Risk:** Flat structure vs `src/` structure — import paths differ
  - **Mitigation:** Adapt all imports to `@/` alias in `src/` path

## Key Vercel Config

The casebuddy-ai-law-partner `vercel.json` adds:
- Cron jobs for daily email, briefing, case monitoring
- `@vercel/analytics` for tracking
- Different cache-control headers
- API rewrite rules for `/api/*`

Current `vercel.json` should be updated to include cron support while keeping our Supabase EF workflow.
