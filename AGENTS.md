# AGENTS.md - CaseBuddy Professional

This document provides essential information for AI agents working on this codebase. It covers build/lint/test commands and code style guidelines.

## Build/Lint/Test Commands

### Development
```bash
npm run dev           # Start Vite dev server on localhost:8080
npm run build         # Production build to /dist
npm run build:dev     # Development build with sourcemaps
npm run preview       # Preview production build
npm run lint         # Run ESLint on all files
```

### Testing (Vitest)
```bash
npm test             # Run all tests
npm run test:ui      # Run Vitest UI (interactive mode)
npm run test:coverage # Run tests with coverage report
npx vitest run src/test/example.test.tsx  # Run single test file
npx vitest run --reporter=verbose  # Verbose output
```

### Supabase Operations
```bash
supabase migration new <name>     # Create new migration
supabase db push                  # Apply migrations
supabase db reset                 # Reset and re-apply all migrations
supabase functions deploy <name>  # Deploy specific edge function
supabase functions serve          # Local edge function development
```

### Troubleshooting Commands
```bash
npm run fix:ocr      # Deploy OCR document function
npm run fix:video    # Deploy video room functions
npm run fix:all      # Deploy all edge functions
npm run diagnose     # Run backend diagnostics
```

## Code Style Guidelines

### Imports & Organization

**Import Order:**
1. React imports (`import React from "react"`)
2. External library imports (Radix UI, Lucide, etc.)
3. Internal absolute imports (`@/*`)
4. Relative imports (`./`, `../`)
5. Type imports (`import type ...`)

**Example:**
```typescript
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Case } from "@/lib/api";
```

### TypeScript Conventions

**Type Definitions:**
- Use TypeScript interfaces for object shapes
- Export types/interfaces from `src/lib/api.ts` for shared types
- Use `type` for unions, `interface` for objects
- Prefer explicit return types for functions

**Example:**
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

**Type Generation:**
- Database types auto-generated in `src/integrations/supabase/types.ts`
- **NEVER** edit this file manually
- Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`

### Naming Conventions

**Files:**
- PascalCase for components (`Button.tsx`, `CaseDetail.tsx`)
- kebab-case for utilities (`google-drive.ts`, `use-toast.ts`)
- camelCase for hooks (`useAuth.tsx`, `useMobile.tsx`)

**Variables & Functions:**
- camelCase for variables and functions (`getCases`, `userProfile`)
- PascalCase for React components and TypeScript interfaces
- UPPER_CASE for constants (`VITE_SUPABASE_URL`)

**Database Tables:**
- snake_case for table names (`cases`, `timeline_events`)
- singular nouns for tables (`case`, not `cases` - though table is plural)

### Component Structure

**React Components:**
- Use functional components with TypeScript
- Props interface defined above component
- Destructure props at start of component
- Use `cn()` utility for className merging

**Example Component:**
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

**API Calls:**
- Use try/catch for async operations
- Throw errors from API functions, handle in components
- Use React Query `useQuery`/`useMutation` with error handling

**Example:**
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

**Error Display:**
- Use toast notifications (`sonner`) for user-facing errors
- React Query handles server error display automatically
- Log errors to console for debugging

### Styling Conventions

**Tailwind CSS:**
- Use utility classes directly in JSX
- Use `cn()` from `src/lib/utils.ts` for dynamic classes
- Custom theme colors: `gold-*`, `navy-*`, `sidebar-*`
- Follow mobile-first responsive design (`md:`, `lg:`)

**Example:**
```typescript
<div className="flex flex-col md:flex-row gap-4 p-4 bg-sidebar border border-sidebar-border">
  <Button variant="gold">Action</Button>
</div>
```

**CSS Variables:**
- Defined in `src/index.css` as HSL values
- Use CSS custom properties for theme colors
- shadcn/ui components use CSS variables for theming

### File Structure Patterns

**`src/` Organization:**
```
src/
├── components/     # React components
│   ├── ui/        # shadcn/ui primitives
│   └── feature/   # Business logic components
├── hooks/         # Custom React hooks
├── lib/           # Utilities, API clients
├── pages/         # Route-level components
├── integrations/  # Third-party integrations
│   └── supabase/  # Supabase client & types
└── test/          # Test files
```

**Component Locations:**
- Page components: `src/pages/`
- Layout components: `src/components/Layout.tsx`
- UI primitives: `src/components/ui/`
- Feature components: `src/components/` (root level)

### Testing Patterns

**Test Files:**
- Place tests in `src/test/` directory
- Use `.test.tsx` extension for React component tests
- Use Vitest with Testing Library
- Setup file: `src/test/setup.ts`

**Example Test:**
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

**Running Tests:**
- Single file: `npx vitest run src/test/file.test.tsx`
- Watch mode: `npx vitest watch`
- Coverage: `npx vitest run --coverage`

### Supabase Integration Patterns

**Client Usage:**
- Import from `@/integrations/supabase/client`
- Use Supabase client singleton across app
- All API calls go through `src/lib/api.ts`

**Database Operations:**
- Use auto-generated types for type safety
- Row Level Security (RLS) enforces user data isolation
- All operations require authentication context

### Environment Variables

**Required Variables:**
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY`
- `OPENAI_API_KEY` (edge functions only)

**Pattern:**
- Use `import.meta.env.VITE_*` in frontend code
- Edge functions access via `Deno.env.get()`
- Always check `.env.example` for required variables

### Database Schema Updates

**Migration Workflow:**
1. Create migration: `supabase migration new add_feature_name`
2. Write SQL in `supabase/migrations/YYYYMMDDHHMMSS_add_feature_name.sql`
3. Apply: `supabase db push`
4. Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
5. Update `src/lib/api.ts` interfaces and functions

### Commit & Code Quality

**Before Committing:**
1. Run `npm run lint` to check for ESLint errors
2. Run `npm test` to ensure tests pass
3. Build test: `npm run build` to catch TypeScript errors
4. Check for any TypeScript errors in IDE

**Commit Messages:**
- Use present tense imperative ("Add feature", not "Added feature")
- Reference issue/feature numbers when applicable
- Keep first line under 72 characters
- Add detailed description in body if needed

**Important Notes:**
- ESLint configured with TypeScript and React hooks plugins
- TypeScript strict mode is disabled (`strictNullChecks: false`)
- `noImplicitAny` is disabled for flexibility
- Path alias `@/*` maps to `src/*`