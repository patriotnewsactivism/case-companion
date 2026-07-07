# AGENTS.md — CaseBuddy Professional

## Build / Lint / Test

```bash
npm run dev              # Vite dev server on :8080
npm run build            # Production build to /dist
npm run build:dev        # Dev build with sourcemaps
npm run lint             # ESLint (flat config: eslint.config.js)
npm test                 # Vitest unit/integration tests (jsdom env)
npm run test:ui          # Vitest interactive UI
npm run test:coverage    # Vitest + coverage
npm run test:e2e         # Playwright (needs dev server running on :8080)
npm run test:e2e:ui      # Playwright interactive UI
npm run test:smoke       # Smoke check: tsx scripts/smoke-feature-check.ts
npm run diagnose         # Backend diagnostic: tsx scripts/diagnose-backend.ts
```

**CI verification order:** `npm run lint` → `npm run build` (no `npm test` in CI workflow currently).

## Supabase

### Database
```bash
supabase migration new <name>     # Create migration in supabase/migrations/
supabase db push                  # Apply pending migrations
supabase db reset                 # Reset and re-apply all
```

- Migrations in `supabase/migrations/ignored/` and `_already_applied/` are **not** picked up by `supabase db push` — only live migrations in the root of `supabase/migrations/`.
- After schema changes, regenerate types:
  `supabase gen types typescript --local > src/integrations/supabase/types.ts`
- **Never edit `src/integrations/supabase/types.ts` manually** — it is auto-generated.

### Edge Functions
26+ edge functions defined in `supabase/config.toml`. Most require JWT (`verify_jwt = true`); exceptions: `recording-webhook` (Daily.co signature verification) and `ocr-queue-processor` (internal cron).

```bash
supabase functions deploy <name>  # Deploy a single function
supabase functions serve          # Local edge function dev
npm run fix:ocr                   # Deploy ocr-document
npm run fix:video                 # Deploy all video room functions
npm run fix:voice                 # Deploy voice-agent-call
npm run fix:all                   # Deploy all edge functions
```

**Edge function runtime:** Deno with TypeScript. Shared utilities in `supabase/functions/_shared/`.

## Environment Variables

**Frontend (`VITE_*` in `.env`):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`

**Edge function secrets** (set via `npx supabase secrets set KEY=value`, NOT in `.env`):
- `AZURE_VISION_ENDPOINT`, `AZURE_VISION_API_KEY` — primary OCR
- `OCR_SPACE_API_KEY` — fallback OCR
- `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `ASSEMBLYAI_API_KEY` — AI/transcription
- `DAILY_API_KEY`, `DAILY_WEBHOOK_SECRET` — video conferencing
- `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY` — voice courtroom

Full list in `.env.example`.

## Architecture

**Single-package Vite + React SPA.** No monorepo.

```
src/
├── App.tsx                  # Route definitions + providers
├── main.tsx                 # Entry point
├── components/ui/           # shadcn-ui primitives
├── components/              # Feature components
├── pages/                   # Route-level components
├── hooks/                   # Custom hooks (useAuth, etc.)
├── lib/                     # API layer (api.ts), utilities
├── integrations/supabase/   # Supabase client + auto-generated types
├── services/                # Business logic services
├── store/                   # Zustand stores
├── test/                    # Vitest tests (jsdom)
├── workers/                 # Web workers
└── shims/                   # BotFramework-WebChat ES5 shims
```

**Key files:**
- `src/lib/api.ts` (1373 lines) — all Supabase CRUD operations; components must use this, never the Supabase client directly
- `src/integrations/supabase/client.ts` — Supabase singleton, always production mode (no mock/sandbox)
- `src/hooks/useAuth.tsx` — AuthProvider + `useAuth()` hook
- `src/pages/CaseDetail.tsx` — most complex component

**Routing:** React Router 6. `ProtectedRoute` guards authenticated routes. Public: `/`, `/login`. Protected: `/dashboard`, `/cases`, `/cases/:id`, `/calendar`, `/research`, `/trial-prep`, `/settings`.

**State:** Server state → TanStack React Query. UI state → local `useState`. Auth → React Context. Global UI → Zustand.

## Code Conventions

### Imports
Order: React → external libraries → `@/*` absolute → `./` relative → type imports (last)

### Path alias
`@/*` maps to `src/*` (configured in vite.config.ts, tsconfig.app.json, and vitest.config.ts).

### Naming
- **Files:** PascalCase for components (`Button.tsx`), kebab-case for utilities (`google-drive.ts`), camelCase for hooks (`useAuth.tsx`)
- **Components/Interfaces:** PascalCase. **Variables/Functions:** camelCase. **DB tables:** snake_case.

### Component pattern
```tsx
interface Props { title: string; className?: string; }
export function MyComponent({ title, className }: Props) { ... }
```
Functional components only. Props interface above the component. Use `cn()` from `src/lib/utils.ts` for className merging.

### Styling
Tailwind utility classes in JSX. Custom theme: `gold-*`, `navy-*`, `sidebar-*` (defined in tailwind.config.ts). Mobile-first responsive (`md:`, `lg:`). Dark mode via `next-themes` (class-based). shadcn-ui components use CSS variables (HSL) from `src/index.css`.

### Error handling
API functions throw errors → React Query catches them → `sonner` toast notifications for users.

### TypeScript
- `strict: true` in `tsconfig.app.json` (despite what older docs say — strictNullChecks and noImplicitAny are **enabled**).
- `@typescript-eslint/no-unused-vars` is **off** in ESLint config.
- Use `interface` for object shapes, `type` for unions.

## Testing

- **Vitest** with jsdom environment. Config: `vitest.config.ts`. Setup: `src/test/setup.ts`. Globals enabled (`describe`, `it`, `expect` available without import).
- **Playwright** e2e tests in `e2e/`. Config: `playwright.config.ts`. Auto-starts dev server on `127.0.0.1:8080`. Single browser: Chromium. Not parallel.
- Run single vitest test: `npx vitest run src/test/example.test.tsx`
- Diagnostic/test scripts live in `scripts/` directory.

## Vite Build Quirks

- Dev server port **8080** (not the default 5173).
- SWC plugin for React compilation (not Babel).
- BotFramework-WebChat ES5 shims in `src/shims/` (aliased in vite.config.ts).
- Manual chunk splitting for vendor bundles (react, radix-ui, supabase, utils).
- Build target: `es2022`.

## Git / CI

- CI deploys on push to `main` branch (`.github/workflows/deploy.yml`).
- **CI uses Node 18**, but `package.json` engines declare `>=20.0.0` — ensure local Node matches what CI uses for consistency.
- Commit messages: present tense imperative, first line under 72 chars.

## Schema Update Workflow

1. `supabase migration new add_feature_name`
2. Write SQL in the generated migration file
3. `supabase db push`
4. `supabase gen types typescript --local > src/integrations/supabase/types.ts`
5. Update `src/lib/api.ts` interfaces and functions
