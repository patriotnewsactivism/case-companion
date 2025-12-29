# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CaseBuddy Professional** - AI-powered legal case management and trial preparation platform for litigation teams. Built with React + TypeScript frontend, Supabase backend (PostgreSQL + Edge Functions), and integrated with Google Drive, OpenAI Whisper, and Jitsi Meet.

## Development Commands

```bash
# Development
npm run dev          # Start Vite dev server on localhost:8080
npm run lint         # Run ESLint

# Building
npm run build        # Production build to /dist
npm run build:dev    # Development build with sourcemaps
npm run preview      # Preview production build

# Database migrations (via Supabase CLI)
supabase migration new <name>        # Create new migration
supabase db push                     # Apply migrations
supabase db reset                    # Reset and re-apply all migrations

# Edge Functions
supabase functions deploy <name>     # Deploy specific function
supabase functions serve             # Local development
```

## Architecture Overview

### Frontend Stack
- **React 18** with React Router 6 for routing
- **TypeScript** with auto-generated Supabase types (`src/integrations/supabase/types.ts`)
- **Vite** for build tooling with SWC for fast compilation
- **shadcn-ui** component library (30+ Radix UI components)
- **Tailwind CSS** with custom theming (gold/navy color scheme)
- **TanStack React Query** for server state management
- **React Hook Form + Zod** for form validation

### Backend Architecture
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- **Edge Functions** run on Deno runtime with TypeScript
- **Row Level Security (RLS)** enforces data access policies
- **Storage bucket** `case-documents` with folder structure: `{user_id}/{case_id}/{timestamp}.{ext}`

### Database Schema

**5 Main Tables:**
1. **`cases`** - Case records with status tracking (active, discovery, pending, review, closed, archived)
2. **`documents`** - Discovery documents with OCR processing, AI analysis fields, and Bates numbering
3. **`profiles`** - User profiles linked to auth.users
4. **`timeline_events`** - Case deadlines and events with importance levels
5. **`import_jobs`** - Tracks async Google Drive import operations

### Key Patterns

**Authentication Flow:**
- Context-based auth in `src/hooks/useAuth.tsx`
- AuthProvider wraps app, provides `useAuth()` hook
- `ProtectedRoute` component guards authenticated routes
- Supabase Auth with JWT tokens stored in localStorage

**API Layer:**
- All Supabase operations abstracted in `src/lib/api.ts`
- Type-safe interfaces for all entities
- Async functions using Supabase PostgREST API
- React Query manages caching, refetching, and mutations

**Component Structure:**
- **Pages:** Route-level components (`src/pages/`)
- **Layout:** Shared navbar/sidebar (`src/components/Layout.tsx`)
- **UI Components:** shadcn-ui primitives (`src/components/ui/`)
- **Feature Components:** Business logic components (GoogleDriveFolderImport, ImportJobsViewer)

**Routing Pattern:**
```
/                    → Landing (public)
/login               → Login (public)
/dashboard           → Dashboard (protected)
/cases               → Case list (protected)
/cases/:id           → Case detail (protected)
/calendar, /research, /trial-prep, /settings → Dashboard views (protected)
```

## Critical Files

**Configuration:**
- `vite.config.ts` - Vite build config, path aliases (`@/*` → `./src/*`)
- `tailwind.config.ts` - Custom theme colors, animations
- `supabase/config.toml` - Edge function JWT verification settings

**Core Application:**
- `src/App.tsx` - Route definitions and provider setup
- `src/integrations/supabase/client.ts` - Supabase client singleton
- `src/integrations/supabase/types.ts` - Auto-generated database types (DO NOT EDIT)
- `src/hooks/useAuth.tsx` - Authentication context and hook
- `src/lib/api.ts` - All database CRUD operations

**Complex Pages:**
- `src/pages/CaseDetail.tsx` - Most complex component (53KB), handles case view with tabs for documents, timeline, notes, AI chat, video rooms

**External Integrations:**
- `src/lib/googleDrive.ts` - Google OAuth + Drive API utilities
- `src/components/GoogleDriveFolderImport.tsx` - Drive folder picker and import UI

## Edge Functions (Backend)

Located in `supabase/functions/`:

1. **`create-video-room`** - Creates Jitsi Meet room with JWT token
2. **`join-video-room`** - Joins existing video room
3. **`import-google-drive`** - Recursively imports folders from Google Drive to Supabase Storage
4. **`ocr-document`** - OCR processing for PDF/images
5. **`transcribe-media`** - Calls OpenAI Whisper API for audio/video transcription

All functions require JWT verification (`verify_jwt: true` in config.toml).

## Environment Variables

Required in `.env` (see `.env.example`):
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon/public key for frontend
- `VITE_SUPABASE_URL` - Supabase API URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_GOOGLE_API_KEY` - Google API key for Drive integration
- `OPENAI_API_KEY` - For Whisper transcription (edge functions only)

Current project ID: `plcvjadartxntnurhcua`

## Common Development Workflows

### Adding New Database Column
1. Create migration: `supabase migration new add_column_name`
2. Write SQL in `supabase/migrations/YYYYMMDDHHMMSS_add_column_name.sql`
3. Apply: `supabase db push`
4. Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
5. Update `src/lib/api.ts` interfaces and functions

### Adding New Page
1. Create component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx` router
3. Wrap with `<ProtectedRoute>` if authentication required
4. Add navigation link in `src/components/Layout.tsx` if needed

### Adding New shadcn-ui Component
```bash
npx shadcn@latest add <component-name>
```
Components are added to `src/components/ui/` with Tailwind styling.

### Google Drive Import Flow
1. User clicks "Import from Google Drive" button
2. `GoogleDriveFolderImport.tsx` loads Google APIs (gapi + Google Identity Services)
3. OAuth popup requests Drive read-only access
4. Google Picker UI shows user's folders
5. User selects folder, component recursively gets full path
6. Frontend previews file types and counts
7. On confirm, calls `import-google-drive` edge function
8. Edge function creates `import_jobs` record and processes files asynchronously
9. Files uploaded to `case-documents/{user_id}/{case_id}/` in Supabase Storage
10. Import progress tracked in `import_jobs` table

### Document Processing Pipeline
1. User uploads file or imports from Drive
2. File stored in Supabase Storage `case-documents` bucket
3. For PDFs/images: `ocr-document` function extracts text → stored in `documents.ocr_text`
4. For audio/video: Storage trigger calls `transcribe-media` → Whisper API → stored in document record
5. AI analysis fields (`summary`, `key_facts`, `favorable_findings`, etc.) populated separately

## Styling Conventions

- Use Tailwind utility classes for styling
- Custom theme colors: `gold-*`, `navy-*`, `sidebar-*` defined in `tailwind.config.ts`
- CSS variables in `src/index.css` for HSL color values
- shadcn-ui components use `cn()` utility from `src/lib/utils.ts` for className merging
- Responsive design: mobile-first with `md:`, `lg:` breakpoints
- Dark mode support via `next-themes` (class-based)

## Important Notes

- **Type Generation:** `src/integrations/supabase/types.ts` is auto-generated - never edit manually
- **RLS Policies:** All database access enforces Row Level Security - users can only access their own data
- **File Storage:** Files organized by user ID and case ID automatically via path structure
- **Authentication:** Session managed by Supabase, persisted in localStorage
- **API Calls:** Always use functions from `src/lib/api.ts`, never call Supabase client directly from components
- **Form Validation:** Use React Hook Form + Zod schemas for all forms
- **Error Handling:** React Query handles API errors, display via toast notifications (sonner)
- **State Management:** Server state via React Query, UI state via local useState, auth state via Context

## Testing Considerations

- No test framework currently configured
- Manual testing via dev server
- Database changes tested via migrations in local Supabase instance
- Edge functions testable via `supabase functions serve`

## Build & Deployment

- **Build output:** `/dist` directory
- **Deployment:** Via Lovable platform (see README.md)
- **Environment:** Vite env vars must be prefixed with `VITE_`
- **Production mode:** `npm run build` creates optimized bundles with code splitting
- **Hot reload:** Dev server supports HMR for instant updates
