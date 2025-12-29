# Fix: Missing case_type Column

## Problem
The `case_type` column is missing from the `cases` table in the database, causing errors when creating new cases.

## ⚡ Quick Fix (Easiest)

### Option 1: Open the HTML Fix Tool

1. Open `fix-database.html` in your web browser
2. Log in to CaseBuddy in another tab (if not already logged in)
3. Come back to the fix-database.html tab
4. Click "Fix Database Now"
5. Wait for confirmation
6. Refresh your CaseBuddy app and try creating a case!

### Option 2: Use Supabase SQL Editor (Recommended)

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/usyxikgqkcnlzobnqhtz/sql/new)
2. Paste this single line of SQL:
   ```sql
   ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_type TEXT;
   ```
3. Click "Run" (or press Ctrl/Cmd + Enter)
4. You should see "Success. No rows returned"
5. Refresh your CaseBuddy app - the error should be gone!

## Alternative Methods

### Option 3: Apply All Pending Migrations

If you have the Supabase CLI installed locally:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref usyxikgqkcnlzobnqhtz

# Apply all migrations
supabase db push
```

### Option 4: Using the Detailed Migration Script

If you want to add ALL missing columns (not just case_type), copy and run the contents of `add-case-type-column.sql` in the Supabase SQL Editor:

```sql
-- Add case_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'cases'
        AND column_name = 'case_type'
    ) THEN
        ALTER TABLE public.cases ADD COLUMN case_type TEXT;
        RAISE NOTICE 'case_type column added successfully';
    ELSE
        RAISE NOTICE 'case_type column already exists';
    END IF;
END $$;
```

## Verification

After applying the migration, verify the column exists:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cases'
  AND column_name = 'case_type';
```

You should see output showing the `case_type` column with `TEXT` data type.

## What This Fixes

- Allows creating new cases with a case type (e.g., "Personal Injury", "Criminal Defense", etc.)
- Prevents errors when the frontend tries to save the `case_type` field
- Ensures the database schema matches the TypeScript types in `src/integrations/supabase/types.ts`

## Related Files

- Migration: `supabase/migrations/20251229230000_add_missing_case_columns.sql` (comprehensive migration)
- Quick fix: `add-case-type-column.sql` (minimal migration, just adds case_type)
- API types: `src/lib/api.ts` (already expects case_type field)
- TypeScript types: `src/integrations/supabase/types.ts` (already has case_type defined)
