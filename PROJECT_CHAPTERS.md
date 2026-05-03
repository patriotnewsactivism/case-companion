# CaseBuddy (Case Companion) — Project Chapters

> AI-powered legal case management and trial preparation platform for litigation teams.
> **Repo:** `patriotnewsactivism/case-companion`
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Supabase (Auth, Postgres, Storage, Edge Functions) + OpenAI + shadcn/ui

---

## Chapter 1: Foundation & App Shell

**Goal:** Application bootstrapping, routing, layout, and shared infrastructure.

| File | Purpose |
|------|---------|
| `src/main.tsx` | App entry point, provider setup |
| `src/App.tsx` | Root component, route definitions |
| `src/App.css` | Global app styles |
| `src/index.css` | Root CSS (Tailwind imports) |
| `src/vite-env.d.ts` | Vite type declarations |
| `src/components/Layout.tsx` | Main app layout — sidebar, header, content area |
| `src/components/NavLink.tsx` | Navigation link component |
| `src/components/Logo.tsx` | App logo/branding |
| `src/components/ProtectedRoute.tsx` | Auth guard for protected pages |
| `src/components/OfflineStatusBar.tsx` | Offline detection and status indicator |
| `src/components/ErrorBoundary.tsx` | Global error handling |
| `src/lib/utils.ts` | Shared utility functions (cn, className merging) |
| `src/lib/constants.ts` | App-wide constants (if present) |
| `src/pages/Index.tsx` | Root index/redirect page |
| `src/pages/NotFound.tsx` | 404 page |

**Configuration & Build:**

| File | Purpose |
|------|---------|
| `index.html` | HTML shell, Vite entry |
| `vite.config.ts` | Vite build configuration |
| `vitest.config.ts` | Vitest test configuration |
| `playwright.config.ts` | Playwright E2E config |
| `eslint.config.js` | ESLint rules |
| `tailwind.config.ts` | Tailwind CSS config |
| `postcss.config.js` | PostCSS config |
| `components.json` | shadcn/ui component config |
| `tsconfig.json` | Root TypeScript config |
| `tsconfig.app.json` | App-specific TS config |
| `tsconfig.node.json` | Node/build TS config |
| `vercel.json` | Vercel deployment config |
| `package.json` | Dependencies and scripts |
| `package-lock.json` | Dependency lock file |
| `bun.lock` / `bun.lockb` | Bun lock files |
| `.env.example` | Dev env template |
| `.env.example1` | Alternative env template |
| `.env.production` | Production env config |
| `.env.staging` | Staging env config |
| `.gitignore` | Git ignore rules |
| `skills-lock.json` | Skills lock |

**Documentation:**

| File | Purpose |
|------|---------|
| `README.md` | Project documentation |
| `AGENTS.md` | AI agent instructions |
| `CLAUDE.md` | Claude AI instructions |
| `GEMINI.md` | Gemini AI instructions |
| `QUICK_START.md` | Quick start guide |
| `SALES_PITCH.md` | Sales pitch document |
| `OCR_SETUP.md` | OCR configuration guide |
| `QUICK_OCR_SETUP.md` | Quick OCR setup |
| `GOOGLE_DRIVE_SETUP.md` | Google Drive integration setup |
| `VIDEO_CONFERENCING_SETUP.md` | Video conferencing setup |
| `MIGRATION_GUIDE.md` | Database migration guide |
| `MIGRATION_INSTRUCTIONS.md` | Migration instructions |
| `SUPABASE_MIGRATION_GUIDE.md` | Supabase migration guide |
| `PRODUCTION_DEPLOY_PLAN.md` | Production deployment plan |
| `CASEBUDDY_UPGRADE_MISSION.md` | Upgrade mission docs |
| `BACKEND_FIXES.md` | Backend fix notes |
| `CORS_WORKAROUND.md` | CORS workaround docs |
| `FIX-CASE-TYPE-COLUMN.md` | Case type column fix |
| `JWT_FIX_README.md` | JWT fix documentation |
| `STORAGE_BUCKET_FIX.md` | Storage bucket fix |
| `FIX_BACKEND.sql` | Backend SQL fix |
| `add-case-type-column.sql` | SQL migration |

**Key Concepts:**
- Supabase for full backend (auth, database, storage, edge functions)
- Protected route pattern for authenticated access
- Offline-capable with status indicator
- shadcn/ui component library

---

## Chapter 2: Authentication & Team Management

**Goal:** User auth, case access control, and team collaboration.

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Login/signup page |
| `src/pages/Login.tsx` | Login page variant |
| `src/pages/Team.tsx` | Team management page |
| `src/hooks/AuthProvider.tsx` | Auth provider — wraps app with auth context |
| `src/hooks/useAuth.ts` | Auth hook — login, logout, user state |
| `src/components/CaseMembers.tsx` | Case-level member management |
| `src/components/InviteMemberDialog.tsx` | Invite team members to a case |
| `supabase/functions/client-auth/index.ts` | Server-side auth verification |

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
| `src/pages/CaseDetail.tsx` | Single case deep dive — all case features |
| `src/pages/Landing.tsx` | Landing page / unauthenticated home |
| `src/pages/Settings.tsx` | User/app settings |
| `src/pages/Billing.tsx` | Subscription and billing management |
| `src/store/useCaseStore.ts` | Zustand case state management |
| `src/store/useCaseFactsStore.ts` | Case facts state management |
| `src/lib/api.ts` | Core Supabase API client — CRUD for all entities |
| `src/lib/premium-api.ts` | Premium feature API calls |

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
| `src/lib/ocr/ocr-pipeline.ts` | Triple-tier OCR orchestration |
| `src/lib/ocr/pdf-text-extractor.ts` | PDF text extraction |
| `src/lib/ocr/tesseract-local.ts` | Local Tesseract OCR fallback |
| `src/lib/extraction-service.ts` | Document content extraction |
| `src/lib/text-chunking.ts` | Text chunking for AI processing |
| `src/lib/hashing.ts` | File hash for deduplication |
| `src/lib/upload/unified-upload-handler.ts` | Unified upload handler for all file types |
| `src/lib/parsers/email-parser.ts` | Email (.eml) file parser |
| `src/lib/parsers/spreadsheet-parser.ts` | Excel/CSV spreadsheet parser |
| `src/lib/googleDrive.ts` | Google Drive API integration |
| `src/hooks/useOCRQueue.ts` | OCR queue management hook |
| `src/workers/whisper.worker.ts` | Web Worker for audio transcription |
| `src/lib/whisper-worker.ts` | Whisper worker loader |
| `supabase/functions/ocr-document/index.ts` | Server-side OCR processing |
| `supabase/functions/ocr-queue-processor/index.ts` | OCR queue processor |
| `supabase/functions/process-queue/index.ts` | General document processing queue |
| `supabase/functions/import-google-drive/index.ts` | Google Drive import handler |
| `supabase/functions/export-document/index.ts` | Document export handler |
| `supabase/functions/upload-to-r2/index.ts` | R2/cloud storage upload |
| `supabase/functions/_shared/azureDocumentIntelligence.ts` | Azure Document Intelligence client |

**Key Concepts:**
- Triple-tier OCR: Azure Computer Vision → OCR.space → Google Gemini fallback
- Bates numbering for legal document identification
- Google Drive integration for bulk discovery import
- Version history for document tracking
- Unified upload handler supports PDF, DOCX, images, emails, spreadsheets
- Supabase Storage for file management

---

## Chapter 5: AI-Powered Analysis & Intelligence

**Goal:** AI extracts key facts, generates documents, and provides case intelligence.

| File | Purpose |
|------|---------|
| `src/pages/Analysis.tsx` | AI analysis dashboard |
| `src/components/AnalysisProgressPanel.tsx` | Analysis progress and results |
| `src/services/documentIntelligence.ts` | AI document analysis engine |
| `src/services/caseKnowledgeHub.ts` | Centralized case knowledge graph |
| `src/services/motionIntelligence.ts` | AI motion drafting assistance |
| `src/services/timelineIntelligence.ts` | AI timeline event extraction |
| `src/services/documentGenerator.ts` | AI-generated legal documents |
| `src/lib/ai/ai-analysis-pipeline.ts` | AI analysis pipeline orchestration |
| `src/lib/cache.ts` | Response caching |
| `src/lib/cache-manager.ts` | Cache lifecycle management |
| `src/lib/queue-manager.ts` | Analysis queue management |
| `src/lib/rate-limiter.ts` | API rate limiting |
| `src/hooks/useAutoAnalysis.ts` | Auto-trigger analysis on document upload |
| `supabase/functions/cross-document-analysis/index.ts` | Cross-document AI analysis |
| `supabase/functions/document-aware-chat/index.ts` | AI chat with document context |
| `supabase/functions/argument-analyzer/index.ts` | Legal argument analysis |
| `supabase/functions/case-strategy/index.ts` | AI case strategy generation |
| `supabase/functions/chat/index.ts` | General AI chat endpoint |
| `supabase/functions/gemini-proxy/index.ts` | Gemini API proxy |
| `supabase/functions/_shared/azureOpenAI.ts` | Azure OpenAI client |
| `supabase/functions/_shared/gemini-model-utils.ts` | Gemini model utilities |
| `supabase/functions/_shared/errorHandler.ts` | Shared error handling |
| `supabase/functions/_shared/validation.ts` | Input validation utilities |
| `supabase/functions/_shared/auth.ts` | Shared auth verification |

**Key Concepts:**
- OpenAI GPT-4o-mini and Azure OpenAI for document analysis
- Google Gemini as alternative AI provider
- Automatic fact extraction and inconsistency detection
- Motion drafting with case law support
- Timeline event extraction from document content
- Knowledge hub aggregates findings across all documents
- Rate limiting and caching for cost control

---

## Chapter 6: Case Timeline

**Goal:** Visual timeline of case events auto-generated from documents.

| File | Purpose |
|------|---------|
| `src/pages/CaseTimeline.tsx` | Timeline page |
| `src/pages/Timeline.tsx` | Alternative timeline view |
| `src/components/TimelineView.tsx` | Interactive timeline visualization |
| `src/lib/timeline-phase.ts` | Timeline phase logic and categorization |

**Key Concepts:**
- Auto-generated timeline from AI analysis of documents
- Manual event addition and editing
- Phase-based categorization
- Chronological visualization of case events

---

## Chapter 7: Evidence Analysis & Admissibility

**Goal:** Analyze evidence for admissibility, foundation, and case law support.

| File | Purpose |
|------|---------|
| `src/pages/Evidence.tsx` | Evidence management page |
| `src/components/evidence/EvidenceAnalyzer.tsx` | Main evidence analysis tool |
| `src/components/evidence/EvidenceInput.tsx` | Evidence submission form |
| `src/components/evidence/AdmissibilityResult.tsx` | Admissibility assessment display |
| `src/components/evidence/CaseLawSupport.tsx` | Related case law citations |
| `src/components/evidence/FoundationSuggestions.tsx` | How to lay foundation for evidence |
| `src/components/evidence/IssuesList.tsx` | Potential evidence issues |
| `src/components/evidence/MotionDraft.tsx` | AI-drafted motions in limine |
| `src/lib/evidence-api.ts` | Evidence API client |
| `supabase/functions/evidence-analysis/index.ts` | Server-side evidence analysis |

**Key Concepts:**
- AI evaluates admissibility under Federal Rules of Evidence
- Foundation suggestions for introducing exhibits
- Automatic case law citation for supporting/opposing admission
- Motion in limine drafting assistance

---

## Chapter 8: Courtroom Simulator

**Goal:** Practice trial scenarios with AI-powered opposing counsel, witnesses, and judges.

| File | Purpose |
|------|---------|
| `src/pages/CaseSimulator.tsx` | Simulator launch page |
| `src/pages/CaseSimulatorHistory.tsx` | Past simulation history |
| `src/components/TrialSimulator.tsx` | Main simulator — 9 modes of practice |
| `src/components/simulator/TrialSimulatorV2.tsx` | V2 enhanced simulator |
| `src/components/courtroom/VoiceCourtroom.tsx` | Voice-based courtroom simulation |
| `src/components/courtroom/ExhibitDisplay.tsx` | Exhibit presentation during simulation |
| `src/components/courtroom/ExhibitFoundation.tsx` | Foundation-laying practice |
| `src/components/courtroom/TrialTeleprompter.tsx` | Teleprompter for prepared remarks |
| `src/components/courtroom/PerformanceDashboard.tsx` | Post-simulation performance review |
| `src/components/courtroom/SessionReview.tsx` | Review past simulation sessions |
| `src/services/characterEngine.ts` | AI character system for witnesses/judges/counsel |
| `src/services/voiceEngine.ts` | Text-to-speech and voice recognition engine |
| `src/hooks/useVoiceEngine.ts` | Voice engine hook |
| `src/hooks/useCourtroomAudio.ts` | Courtroom audio management |
| `src/hooks/useAzureTTS.ts` | Azure text-to-speech hook |
| `src/hooks/useDeepgram.ts` | Deepgram speech-to-text hook |
| `src/hooks/useVoiceCommands.ts` | Voice command recognition |
| `src/hooks/useSessionRecorder.ts` | Session recording for replay |
| `src/lib/voice-commands.ts` | Voice command definitions |
| `src/lib/trial-session-api.ts` | Trial session API client |
| `supabase/functions/trial-simulation/index.ts` | Server-side trial simulation |
| `supabase/functions/trial-assistant/index.ts` | AI trial assistant |
| `supabase/functions/trial-coach/index.ts` | AI trial coaching feedback |
| `supabase/functions/witness-prep/index.ts` | Witness preparation simulation |

**Key Concepts:**
- 9 simulation modes: cross-examination, depositions, voir dire, opening statements, closing arguments, direct examination, objections, motions, jury instructions
- AI-powered opposing counsel, witnesses, and judges
- Voice-based interaction: Azure TTS + Deepgram STT
- Performance scoring and feedback
- Session recording for review and replay

---

## Chapter 9: Performance Analytics

**Goal:** Track and improve courtroom performance over time.

| File | Purpose |
|------|---------|
| `src/pages/Analytics.tsx` | Analytics page |
| `src/components/analytics/PerformanceDashboard.tsx` | Overall performance metrics |
| `src/components/analytics/ScoreChart.tsx` | Score visualization over time |
| `src/components/analytics/PhaseBreakdown.tsx` | Performance by trial phase |
| `src/components/analytics/StrengthsWeaknesses.tsx` | Strengths and areas for improvement |
| `src/components/analytics/FillerWordAnalysis.tsx` | Filler word tracking ("um", "uh") |
| `src/lib/analytics-api.ts` | Analytics API client |

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
| `src/lib/session-api.ts` | Session API client |
| `supabase/functions/save-session/index.ts` | Server-side session save |

---

## Chapter 11: Trial Preparation

**Goal:** Checklists, binders, and prep tools for trial readiness.

| File | Purpose |
|------|---------|
| `src/pages/TrialPrep.tsx` | Trial preparation hub |
| `src/components/TrialPrepChecklist.tsx` | Checklist — witnesses, exhibits, motions |
| `src/components/TrialBinder.tsx` | Digital trial binder organization |
| `src/components/DepositionManager.tsx` | Deposition tracking and management |
| `src/lib/trial-prep-api.ts` | Trial prep API client |

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
| `src/lib/discovery-api.ts` | Discovery API client |
| `supabase/functions/discovery-response/index.ts` | Server-side discovery response generation |
| `supabase/functions/privilege-log/index.ts` | Privilege log management |

**Key Concepts:**
- Track interrogatories, RFPs, RFAs, and subpoenas
- Deadline alerting with countdown
- AI-assisted response generation
- Privilege log for protected documents

---

## Chapter 13: Mock Jury

**Goal:** AI-simulated jury deliberation and verdict prediction.

| File | Purpose |
|------|---------|
| `src/pages/MockJury.tsx` | Mock jury page |
| `src/components/jury/MockJury.tsx` | Mock jury setup and simulation |
| `src/components/jury/JurorCard.tsx` | Individual juror profile and tendencies |
| `src/components/jury/JuryDeliberation.tsx` | Simulated jury deliberation |
| `src/components/jury/JuryVerdictDisplay.tsx` | Verdict outcome display |
| `src/components/jury/index.ts` | Jury component barrel export |
| `src/lib/jury-api.ts` | Jury API client |
| `supabase/functions/mock-jury/index.ts` | Server-side mock jury simulation |

**Key Concepts:**
- AI generates diverse juror profiles with backgrounds and biases
- Simulated deliberation based on case evidence
- Verdict prediction with reasoning

---

## Chapter 14: Settlement Analysis

**Goal:** AI-powered settlement value analysis.

| File | Purpose |
|------|---------|
| `src/components/settlement/DamagesInput.tsx` | Damages input form |
| `src/components/settlement/SettlementFactors.tsx` | Factor analysis for settlement |
| `src/components/settlement/SettlementRange.tsx` | Settlement range visualization |
| `src/lib/settlement-api.ts` | Settlement API client |
| `supabase/functions/settlement-analysis/index.ts` | Server-side settlement analysis |

**Key Concepts:**
- AI analyzes case strength, damages, and jurisdiction factors
- Settlement range estimation with confidence levels
- Factor-by-factor breakdown

---

## Chapter 15: Motions & Legal Research

**Goal:** AI-powered motion generation, legal research, and case law lookup.

| File | Purpose |
|------|---------|
| `src/pages/CaseMotions.tsx` | Motions management page |
| `src/pages/CaseMotionGenerator.tsx` | AI motion generator page |
| `src/pages/Research.tsx` | Legal research page |
| `src/pages/ConflictCheck.tsx` | Conflict of interest checker |
| `src/pages/JudicialIntelligence.tsx` | Judge history and preferences |
| `src/components/LegalResearch.tsx` | Legal research interface |
| `src/pages/AzureBotChat.tsx` | Azure Bot Chat page |
| `src/components/AzureBotChat.tsx` | AI chat for legal questions |
| `supabase/functions/legal-research/index.ts` | Server-side legal research |
| `supabase/functions/judicial-research/index.ts` | Judicial research |
| `supabase/functions/conflict-check/index.ts` | Conflict check logic |

---

## Chapter 16: Communication & Collaboration

**Goal:** Video conferencing, client communication, and team coordination.

| File | Purpose |
|------|---------|
| `src/pages/Video.tsx` | Video conferencing page |
| `src/pages/Calendar.tsx` | Court calendar page |
| `src/components/VideoConference.tsx` | Jitsi Meet integration |
| `src/components/VideoRoom.tsx` | Video room management |
| `src/components/CreateVideoRoom.tsx` | Create new video room |
| `src/components/ClientCommunications.tsx` | Client message tracking |
| `src/components/CourtCalendar.tsx` | Court date calendar |
| `src/components/BillableHours.tsx` | Time tracking for billing |
| `src/hooks/useVideoRoom.ts` | Video room hook |
| `src/hooks/usePresence.ts` | Real-time presence tracking |
| `src/hooks/useRealtimeCase.ts` | Real-time case updates |
| `supabase/functions/create-video-room/index.ts` | Server-side video room creation |
| `supabase/functions/join-video-room/index.ts` | Video room join handler |
| `supabase/functions/recording-webhook/index.ts` | Recording webhook handler |
| `supabase/functions/send-email/index.ts` | Email sending |

**Key Concepts:**
- Jitsi Meet embedded for team video calls
- Client communication logging
- Court calendar integration
- Billable hours tracking
- Real-time presence for team awareness

---

## Chapter 17: Transcription & Media

**Goal:** Audio/video transcription and media processing.

| File | Purpose |
|------|---------|
| `src/lib/transcription/transcription-pipeline.ts` | Audio/video transcription pipeline |
| `supabase/functions/transcribe-media/index.ts` | Server-side media transcription |
| `supabase/functions/transcribe-recording/index.ts` | Recording transcription |

---

## Chapter 18: Offline Support & Network

**Goal:** Offline capability, data sync, and network resilience.

| File | Purpose |
|------|---------|
| `src/lib/offline/offline-store.ts` | IndexedDB offline storage |
| `src/lib/offline/sync-manager.ts` | Offline-to-online data sync |
| `src/hooks/useOfflineDocuments.ts` | Offline document access hook |
| `src/hooks/useNetworkStatus.ts` | Network status detection hook |
| `src/hooks/use-mobile.tsx` | Mobile device detection |

---

## Chapter 19: Shared Hooks & Utilities

**Goal:** Reusable hooks and cross-cutting utilities.

| File | Purpose |
|------|---------|
| `src/hooks/use-toast.ts` | Toast notification hook |

---

## Chapter 20: UI Component Library (shadcn/ui)

**Goal:** Reusable, accessible UI primitives. All in `src/components/ui/`.

| Component | Files |
|-----------|-------|
| Accordion | `accordion.tsx` |
| Alert | `alert.tsx` |
| Alert Dialog | `alert-dialog.tsx` |
| Aspect Ratio | `aspect-ratio.tsx` |
| Avatar | `avatar.tsx` |
| Badge | `badge.tsx`, `badge-variants.ts` |
| Breadcrumb | `breadcrumb.tsx` |
| Button | `button.tsx`, `button-variants.ts` |
| Calendar | `calendar.tsx` |
| Card | `card.tsx` |
| Carousel | `carousel.tsx` |
| Chart | `chart.tsx` |
| Checkbox | `checkbox.tsx` |
| Collapsible | `collapsible.tsx` |
| Command | `command.tsx` |
| Context Menu | `context-menu.tsx` |
| Dialog | `dialog.tsx` |
| Drawer | `drawer.tsx` |
| Dropdown Menu | `dropdown-menu.tsx` |
| Form | `form.tsx` |
| Hover Card | `hover-card.tsx` |
| Input | `input.tsx` |
| Input OTP | `input-otp.tsx` |
| Label | `label.tsx` |
| Menubar | `menubar.tsx` |
| Navigation Menu | `navigation-menu.tsx` |
| Pagination | `pagination.tsx` |
| Popover | `popover.tsx` |
| Progress | `progress.tsx` |
| Radio Group | `radio-group.tsx` |
| Resizable | `resizable.tsx` |
| Scroll Area | `scroll-area.tsx` |
| Select | `select.tsx` |
| Separator | `separator.tsx` |
| Sheet | `sheet.tsx` |
| Sidebar | `sidebar.tsx`, `sidebar-menu-button-variants.ts` |
| Skeleton | `skeleton.tsx` |
| Slider | `slider.tsx` |
| Sonner (Toast) | `sonner.tsx` |
| Switch | `switch.tsx` |
| Table | `table.tsx` |
| Tabs | `tabs.tsx` |
| Textarea | `textarea.tsx` |
| Toast | `toast.tsx`, `toaster.tsx`, `use-toast.ts` |
| Toggle | `toggle.tsx`, `toggle-variants.ts` |
| Toggle Group | `toggle-group.tsx` |
| Tooltip | `tooltip.tsx` |

---

## Chapter 21: Supabase Database & Migrations

**Goal:** Database schema evolution and management.

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Supabase project configuration |
| `supabase/migrations/00000000000000_complete_schema.sql` | Base schema |
| `supabase/migrations/20251227*` | Case documents bucket, media support |
| `supabase/migrations/20251228*` | Import jobs, auto-transcribe triggers |
| `supabase/migrations/20251229*` | Video rooms, storage security, performance indexes |
| `supabase/migrations/20260106-20260116*` | Schema evolution |
| `supabase/migrations/20260204*` | Storage bucket, OCR columns |
| `supabase/migrations/20260206-20260216*` | Remote schema updates |
| `supabase/migrations/20260220*` | Premium features, mock jury sessions |
| `supabase/migrations/20260222*` | OCR queue, presence, client portal, templates, analytics, audit, calendar, case strategy, comprehensive upgrade |
| `supabase/migrations/20260302-20260328*` | Timeline entities, settlement, legal briefs, mission upgrade, trial sessions, discovery fixes, cache tables, offline support, version history, teams, export jobs, conflict checking, AI enhancements |
| `supabase/migrations/20260407-20260428*` | RLS fixes, client messages, upload fixes, processing queue, document intelligence columns |

**Key Concepts:**
- 50+ migrations tracking full schema evolution
- RLS (Row-Level Security) policies for multi-tenant access
- Tables: cases, documents, timeline_events, discovery_requests, evidence, trial_sessions, mock_jury_sessions, video_rooms, case_members, and more

---

## Chapter 22: Test Suite

**Goal:** Unit and integration tests.

| File | Purpose |
|------|---------|
| `src/test/setup.ts` | Test setup and configuration |
| `src/test/App.test.tsx` | Root app tests |
| `src/test/AuthProvider.test.tsx` | Auth provider tests |
| `src/test/CaseDetail.test.tsx` | Case detail tests |
| `src/test/Dashboard.test.tsx` | Dashboard tests |
| `src/test/GoogleDriveFolderImport.test.tsx` | Google Drive import tests |
| `src/test/VideoRoom.test.tsx` | Video room tests |
| `src/test/api.bulkUploadDocuments.test.ts` | Bulk upload API tests |
| `src/test/api.cases.test.ts` | Cases API tests |
| `src/test/api.chunks.test.ts` | Text chunks API tests |
| `src/test/api.documents.test.ts` | Documents API tests |
| `src/test/api.stats-profile.test.ts` | Stats/profile API tests |
| `src/test/api.timeline.test.ts` | Timeline API tests |
| `src/test/discovery-api.test.ts` | Discovery API tests |
| `src/test/example.test.tsx` | Example test |
| `src/test/gemini-model-utils.test.ts` | Gemini utils tests |
| `src/test/googleDrive.test.ts` | Google Drive tests |
| `src/test/hashing.test.ts` | File hashing tests |
| `src/test/rate-limiter.test.ts` | Rate limiter tests |
| `src/test/text-chunking.test.ts` | Text chunking tests |
| `src/test/timeline-phase.test.ts` | Timeline phase tests |
| `src/test/unified-upload-handler.test.ts` | Upload handler tests |
| `src/test/video-api.test.ts` | Video API tests |

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
│  │Discovery │  │ Trial    │  │ Mock Jury /      │   │
│  │ Ch. 12   │  │ Prep     │  │ Settlement       │   │
│  │          │  │ Ch. 11   │  │ Ch. 13-14        │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────┐
│    Supabase (Backend-as-a-Service)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Auth     │  │ Postgres │  │ Storage          │   │
│  │ (OAuth)  │  │ (50+ mi- │  │ (Documents,      │   │
│  │ Ch. 2    │  │ grations)│  │  Evidence)       │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────┐    │
│  │ 34 Edge Functions                             │    │
│  │ OCR, AI Analysis, Trial Sim, Mock Jury,       │    │
│  │ Legal Research, Video Rooms, Email             │    │
│  │ Ch. 4-5, 7-8, 10, 12-17                       │    │
│  └──────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
        │                              │
┌───────┴────────┐          ┌──────────┴──────────┐
│ OpenAI / Azure │          │ Azure Vision /      │
│ GPT-4o-mini    │          │ OCR.space / Gemini  │
│ Ch. 5, 8, 12   │          │ Ch. 4               │
└────────────────┘          └─────────────────────┘
        │                              │
┌───────┴────────┐          ┌──────────┴──────────┐
│ Azure TTS /    │          │ Jitsi Meet          │
│ Deepgram STT   │          │ Video Conferencing  │
│ Ch. 8           │          │ Ch. 16              │
└────────────────┘          └─────────────────────┘
```

---

## File Counts by Chapter

| Chapter | Files |
|---------|-------|
| Ch. 1: Foundation | 15 source + 22 config + 22 docs |
| Ch. 2: Auth & Team | 8 |
| Ch. 3: Cases & Dashboard | 10 |
| Ch. 4: Documents & OCR | 27 |
| Ch. 5: AI Intelligence | 23 |
| Ch. 6: Timeline | 4 |
| Ch. 7: Evidence | 10 |
| Ch. 8: Courtroom Sim | 24 |
| Ch. 9: Performance | 7 |
| Ch. 10: Sessions | 5 |
| Ch. 11: Trial Prep | 5 |
| Ch. 12: Discovery | 10 |
| Ch. 13: Mock Jury | 8 |
| Ch. 14: Settlement | 5 |
| Ch. 15: Motions & Research | 11 |
| Ch. 16: Communication | 15 |
| Ch. 17: Transcription | 3 |
| Ch. 18: Offline | 5 |
| Ch. 19: Shared Hooks | 1 |
| Ch. 20: UI Library | 48 |
| Ch. 21: Migrations | 50+ SQL |
| Ch. 22: Tests | 23 |
| **Total** | **~310+ source + config** |
