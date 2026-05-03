# CaseBuddy (Case Companion) — Project Chapters

> AI-powered legal case management and trial preparation platform for litigation teams.
> **Repo:** `patriotnewsactivism/case-companion`
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Supabase + OpenAI + shadcn/ui

---

## Chapter 1: Foundation & App Shell

**Goal:** Application bootstrapping, routing, layout, and shared configuration.

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component, route definitions |
| `src/components/Layout.tsx` | Main app layout — sidebar, header, content area |
| `src/components/NavLink.tsx` | Navigation link component |
| `src/components/Logo.tsx` | App logo/branding |
| `src/components/ProtectedRoute.tsx` | Auth guard for protected pages |
| `src/components/OfflineStatusBar.tsx` | Offline detection and status indicator |
| `src/components/ErrorBoundary.tsx` | Global error handling |
| `vite.config.ts` | Vite build configuration |
| `.env.example` | Environment variable template |

**Key Concepts:**
- Supabase client initialized at app level
- Protected route pattern for authenticated access
- Offline-capable with status indicator

---

## Chapter 2: Authentication & Team Management

**Goal:** User auth, case access control, and team collaboration.

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Login/signup page |
| `src/pages/Team.tsx` | Team management page |
| `src/components/CaseMembers.tsx` | Case-level member management |
| `src/components/InviteMemberDialog.tsx` | Invite team members to a case |

**Key Concepts:**
- Supabase Auth with email/password and OAuth
- Role-based access per case
- Team invitation workflow

---

## Chapter 3: Case Management & Dashboard

**Goal:** Create, manage, and navigate cases.

| File | Purpose |
|------|---------|
| `src/pages/Dashboard.tsx` | Case list, quick stats, recent activity |
| `src/pages/Cases.tsx` | All cases view |
| `src/pages/CaseDetail.tsx` | Single case deep dive |
| `src/pages/NewCase.tsx` | Create new case form |
| `src/pages/Settings.tsx` | User/app settings |
| `src/store/useCaseStore.ts` | Zustand case state management |
| `src/store/useCaseFactsStore.ts` | Case facts state management |

**Key Concepts:**
- Case as the central entity — all features branch from a case
- Zustand stores for client-side state management
- Case types, statuses, and metadata tracking

---

## Chapter 4: Document Management & OCR

**Goal:** Upload, OCR, and manage discovery documents.

| File | Purpose |
|------|---------|
| `src/pages/Documents.tsx` | Document library and viewer |
| `src/components/BulkDocumentUpload.tsx` | Batch upload with progress tracking |
| `src/components/DocumentVersionHistory.tsx` | Document version tracking |
| `src/components/GoogleDriveFolderImport.tsx` | Import from Google Drive |
| `src/components/ImportJobsViewer.tsx` | Monitor import job progress |
| `src/components/BatesManager.tsx` | Bates number stamping and management |
| `src/components/processing/ProcessingStatusBar.tsx` | Document processing progress |
| `src/components/ExportDialog.tsx` | Export documents/data |
| `src/services/docxExporter.ts` | DOCX file generation |

**Key Concepts:**
- Triple-tier OCR: Azure Computer Vision → OCR.space → Google Gemini fallback
- Bates numbering for legal document identification
- Google Drive integration for bulk discovery import
- Version history for document tracking
- Supabase Storage for file management

---

## Chapter 5: AI-Powered Discovery Analysis

**Goal:** AI extracts key facts, identifies inconsistencies, and surfaces evidence.

| File | Purpose |
|------|---------|
| `src/pages/Analysis.tsx` | AI analysis dashboard |
| `src/components/AnalysisProgressPanel.tsx` | Analysis progress and results |
| `src/services/documentIntelligence.ts` | AI document analysis engine |
| `src/services/caseKnowledgeHub.ts` | Centralized case knowledge graph |
| `src/services/motionIntelligence.ts` | AI motion drafting assistance |
| `src/services/timelineIntelligence.ts` | AI timeline event extraction |
| `src/services/documentGenerator.ts` | AI-generated legal documents |

**Key Concepts:**
- OpenAI GPT-4o-mini for document analysis
- Automatic fact extraction and inconsistency detection
- Motion drafting with case law support
- Timeline event extraction from document content
- Knowledge hub aggregates findings across all documents

---

## Chapter 6: Case Timeline

**Goal:** Visual timeline of case events auto-generated from documents.

| File | Purpose |
|------|---------|
| `src/pages/Timeline.tsx` | Timeline page |
| `src/components/TimelineView.tsx` | Interactive timeline visualization |
| `src/services/timelineIntelligence.ts` | AI-powered event extraction and ordering |

**Key Concepts:**
- Auto-generated timeline from AI analysis of documents
- Manual event addition and editing
- Chronological visualization of case events

---

## Chapter 7: Evidence Analysis & Admissibility

**Goal:** Analyze evidence for admissibility, foundation, and case law support.

| File | Purpose |
|------|---------|
| `src/components/evidence/EvidenceAnalyzer.tsx` | Main evidence analysis tool |
| `src/components/evidence/EvidenceInput.tsx` | Evidence submission form |
| `src/components/evidence/AdmissibilityResult.tsx` | Admissibility assessment display |
| `src/components/evidence/CaseLawSupport.tsx` | Related case law citations |
| `src/components/evidence/FoundationSuggestions.tsx` | How to lay foundation for evidence |
| `src/components/evidence/IssuesList.tsx` | Potential evidence issues |
| `src/components/evidence/MotionDraft.tsx` | AI-drafted motions in limine |

**Key Concepts:**
- AI evaluates admissibility under Federal Rules of Evidence
- Foundation suggestions for introducing exhibits
- Automatic case law citation for supporting/opposing admission
- Motion in limine drafting assistance

---

## Chapter 8: Courtroom Simulator

**Goal:** Practice trial scenarios with AI-powered opposing counsel.

| File | Purpose |
|------|---------|
| `src/components/TrialSimulator.tsx` | Main simulator — 9 modes of practice |
| `src/components/courtroom/VoiceCourtroom.tsx` | Voice-based courtroom simulation |
| `src/components/courtroom/ExhibitDisplay.tsx` | Exhibit presentation during simulation |
| `src/components/courtroom/ExhibitFoundation.tsx` | Foundation-laying practice |
| `src/components/courtroom/TrialTeleprompter.tsx` | Teleprompter for prepared remarks |
| `src/components/courtroom/PerformanceDashboard.tsx` | Post-simulation performance review |
| `src/components/courtroom/SessionReview.tsx` | Review past simulation sessions |
| `src/services/characterEngine.ts` | AI character system for witnesses/judges |
| `src/services/voiceEngine.ts` | Text-to-speech and voice recognition |

**Key Concepts:**
- 9 simulation modes: cross-examination, depositions, voir dire, opening statements, closing arguments, direct examination, objections, motions, jury instructions
- AI-powered opposing counsel, witnesses, and judges
- Voice-based interaction with speech recognition
- Performance scoring and feedback

---

## Chapter 9: Performance Analytics

**Goal:** Track and improve courtroom performance over time.

| File | Purpose |
|------|---------|
| `src/components/analytics/PerformanceDashboard.tsx` | Overall performance metrics |
| `src/components/analytics/ScoreChart.tsx` | Score visualization over time |
| `src/components/analytics/PhaseBreakdown.tsx` | Performance by trial phase |
| `src/components/analytics/StrengthsWeaknesses.tsx` | Strengths and areas for improvement |
| `src/components/analytics/FillerWordAnalysis.tsx` | Filler word tracking ("um", "uh") |

**Key Concepts:**
- Performance tracking across simulation sessions
- Filler word detection for speech improvement
- Phase-by-phase breakdown of trial performance
- Trend analysis for skill development over time

---

## Chapter 10: Session Management

**Goal:** Save, replay, and review simulation sessions.

| File | Purpose |
|------|---------|
| `src/pages/Sessions.tsx` | Session history listing |
| `src/components/sessions/SessionHistory.tsx` | Browse past sessions |
| `src/components/sessions/SessionPlayer.tsx` | Replay a saved session |

---

## Chapter 11: Trial Preparation

**Goal:** Checklists, binders, and prep tools for trial readiness.

| File | Purpose |
|------|---------|
| `src/pages/TrialPrep.tsx` | Trial preparation hub |
| `src/components/TrialPrepChecklist.tsx` | Checklist — witnesses, exhibits, motions |
| `src/components/TrialBinder.tsx` | Digital trial binder organization |
| `src/components/DepositionManager.tsx` | Deposition tracking and management |

**Key Concepts:**
- Checklist-driven trial prep workflow
- Digital trial binder for organized exhibit management
- Deposition tracking with key testimony highlights

---

## Chapter 12: Discovery Management

**Goal:** Track discovery requests, deadlines, and responses.

| File | Purpose |
|------|---------|
| `src/pages/Discovery.tsx` | Discovery management page |
| `src/components/discovery/DiscoveryManager.tsx` | Main discovery tracking UI |
| `src/components/discovery/DiscoveryList.tsx` | List of discovery requests |
| `src/components/discovery/DiscoveryRequestCard.tsx` | Individual request card |
| `src/components/discovery/DiscoveryTimeline.tsx` | Discovery deadline timeline |
| `src/components/discovery/DeadlineAlerts.tsx` | Upcoming deadline alerts |
| `src/components/discovery/ResponseGenerator.tsx` | AI-assisted response drafting |

**Key Concepts:**
- Track interrogatories, RFPs, RFAs, and subpoenas
- Deadline alerting with countdown
- AI-assisted response generation

---

## Chapter 13: Mock Jury

**Goal:** AI-simulated jury deliberation and verdict prediction.

| File | Purpose |
|------|---------|
| `src/components/jury/MockJury.tsx` | Mock jury setup and simulation |
| `src/components/jury/JurorCard.tsx` | Individual juror profile and tendencies |
| `src/components/jury/JuryDeliberation.tsx` | Simulated jury deliberation |
| `src/components/jury/JuryVerdictDisplay.tsx` | Verdict outcome display |

**Key Concepts:**
- AI generates diverse juror profiles with backgrounds and biases
- Simulated deliberation based on case evidence
- Verdict prediction with reasoning

---

## Chapter 14: Legal Research & AI Chat

**Goal:** AI-powered legal research and case law lookup.

| File | Purpose |
|------|---------|
| `src/components/LegalResearch.tsx` | Legal research interface |
| `src/components/AzureBotChat.tsx` | AI chat for legal questions |

---

## Chapter 15: Communication & Collaboration

**Goal:** Video conferencing, client communication, and team coordination.

| File | Purpose |
|------|---------|
| `src/pages/Video.tsx` | Video conferencing page |
| `src/components/VideoConference.tsx` | Jitsi Meet integration |
| `src/components/VideoRoom.tsx` | Video room management |
| `src/components/CreateVideoRoom.tsx` | Create new video room |
| `src/components/ClientCommunications.tsx` | Client message tracking |
| `src/components/CourtCalendar.tsx` | Court date calendar |
| `src/components/BillableHours.tsx` | Time tracking for billing |

**Key Concepts:**
- Jitsi Meet embedded for team video calls
- Client communication logging
- Court calendar integration
- Billable hours tracking

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Dashboard │  │ Case     │  │ Courtroom        │   │
│  │ Cases    │  │ Detail   │  │ Simulator        │   │
│  │ Ch. 3    │  │ Ch. 4-7  │  │ Ch. 8-9          │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Discovery │  │ Trial    │  │ Mock Jury        │   │
│  │ Ch. 12   │  │ Prep     │  │ Ch. 13           │   │
│  │          │  │ Ch. 11   │  │                   │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────┐
│         Supabase (Backend-as-a-Service)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Auth     │  │ Postgres │  │ Storage          │   │
│  │ (OAuth)  │  │ (Cases,  │  │ (Documents,      │   │
│  │ Ch. 2    │  │  Docs)   │  │  Evidence)       │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────┐    │
│  │ Edge Functions (OCR, AI Analysis)            │    │
│  │ Ch. 4-5                                       │    │
│  └──────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
        │                              │
┌───────┴────────┐          ┌──────────┴──────────┐
│ OpenAI API     │          │ Azure Vision /      │
│ (GPT-4o-mini)  │          │ OCR.space / Gemini  │
│ Ch. 5, 8, 12   │          │ Ch. 4               │
└────────────────┘          └─────────────────────┘
```
