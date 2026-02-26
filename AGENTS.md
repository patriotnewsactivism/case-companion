# AGENTS.md - CaseBuddy Professional

Essential information for AI agents working on this codebase.

## Build/Lint/Test Commands

### Development
```bash
npm run dev           # Start Vite dev server on localhost:8080
npm run build         # Production build to /dist
npm run build:dev     # Development build with sourcemaps
npm run preview       # Preview production build
npm run lint          # Run ESLint on all files
```

### Testing (Vitest)
```bash
npm test              # Run all tests
npm run test:ui       # Run Vitest UI (interactive mode)
npm run test:coverage # Run tests with coverage report
npx vitest run src/test/example.test.tsx  # Run single test file
npx vitest run --reporter=verbose         # Verbose output
```

### Supabase Operations
```bash
supabase migration new <name>     # Create new migration
supabase db push                  # Apply migrations
supabase db reset                 # Reset and re-apply all migrations
supabase functions deploy <name>  # Deploy specific edge function
supabase functions serve          # Local edge function development
```

### Troubleshooting
```bash
npm run fix:ocr      # Deploy OCR document function
npm run fix:video    # Deploy video room functions
npm run fix:all      # Deploy all edge functions
npm run diagnose     # Run backend diagnostics
```

## Code Style Guidelines

### Imports & Organization
**Import Order:** React imports → External libraries → Internal absolute (`@/*`) → Relative (`./`, `../`) → Type imports

```typescript
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Case } from "@/lib/api";
```

### TypeScript Conventions
- Use `interface` for object shapes, `type` for unions
- Export types/interfaces from `src/lib/api.ts` for shared types
- Prefer explicit return types for functions
- Database types auto-generated in `src/integrations/supabase/types.ts` - **NEVER** edit manually
- Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`

```typescript
export interface Case {
  id: string;
  user_id: string;
  name: string;
  case_type: string;
  status: CaseStatus;
}

export type CaseStatus = "active" | "discovery" | "pending" | "review" | "closed" | "archived";
```

### Naming Conventions
- **Files:** PascalCase for components (`Button.tsx`), kebab-case for utilities (`google-drive.ts`), camelCase for hooks (`useAuth.tsx`)
- **Variables/Functions:** camelCase (`getCases`, `userProfile`)
- **Components/Interfaces:** PascalCase
- **Constants:** UPPER_CASE (`VITE_SUPABASE_URL`)
- **Database Tables:** snake_case (`cases`, `timeline_events`)

### Component Structure
- Use functional components with TypeScript
- Props interface defined above component
- Destructure props at start
- Use `cn()` utility for className merging

```typescript
interface ComponentProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Component({ children, className, onClick }: ComponentProps) {
  return (
    <div className={cn("base-styles", className)} onClick={onClick}>
      {children}
    </div>
  );
}
```

### Error Handling
- Use try/catch for async operations
- Throw errors from API functions, handle in components
- Use React Query `useQuery`/`useMutation` with error handling
- Use toast notifications (`sonner`) for user-facing errors
- Log errors to console for debugging

```typescript
export async function getCases(): Promise<Case[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Case[]) || [];
}
```

### Styling Conventions
- Use utility classes directly in JSX
- Use `cn()` from `src/lib/utils.ts` for dynamic classes
- Custom theme colors: `gold-*`, `navy-*`, `sidebar-*`
- Follow mobile-first responsive design (`md:`, `lg:`)

```typescript
<div className="flex flex-col md:flex-row gap-4 p-4 bg-sidebar border border-sidebar-border">
  <Button variant="gold">Action</Button>
</div>
```

### File Structure
```
src/
├── components/     # React components (ui/ for shadcn primitives)
├── hooks/         # Custom React hooks
├── lib/           # Utilities, API clients
├── pages/         # Route-level components
├── integrations/  # Third-party integrations (supabase/)
└── test/          # Test files
```

### Testing Patterns
- Place tests in `src/test/` with `.test.tsx` extension
- Use Vitest with Testing Library
- Setup file: `src/test/setup.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });
});
```

### Supabase Integration
- Import from `@/integrations/supabase/client`
- Use Supabase client singleton across app
- All API calls go through `src/lib/api.ts`
- Use auto-generated types for type safety
- Row Level Security (RLS) enforces user data isolation

### Environment Variables
**Required:** `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `OPENAI_API_KEY` (edge functions only)

- Use `import.meta.env.VITE_*` in frontend code
- Edge functions access via `Deno.env.get()`
- Check `.env.example` for required variables

### Database Schema Updates
1. Create migration: `supabase migration new add_feature_name`
2. Write SQL in `supabase/migrations/YYYYMMDDHHMMSS_add_feature_name.sql`
3. Apply: `supabase db push`
4. Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
5. Update `src/lib/api.ts` interfaces and functions

### Commit & Code Quality
**Before Committing:**
1. Run `npm run lint` to check for ESLint errors
2. Run `npm test` to ensure tests pass
3. Run `npm run build` to catch TypeScript errors

**Commit Messages:** Present tense imperative ("Add feature"), first line under 72 characters

**Important Notes:**
- ESLint configured with TypeScript and React hooks plugins
- TypeScript strict mode disabled (`strictNullChecks: false`, `noImplicitAny: false`)
- Path alias `@/*` maps to `src/*`