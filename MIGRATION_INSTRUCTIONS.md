# Database Migration Instructions

## Problem
The error "Could not find the table 'public.cases' in the schema cache" indicates that the database schema hasn't been applied to your Supabase project yet.

## Solution Options

### Option 1: Run via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/usyxikgqkcnlzobnqhtz
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/00000000000000_complete_schema.sql`
5. Paste it into the SQL editor
6. Click **Run** or press `Ctrl+Enter`
7. Wait for the migration to complete (should take a few seconds)
8. Refresh your application at https://casebuddy.live/cases

### Option 2: Use Supabase CLI

If you have the Supabase CLI installed and authenticated:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref usyxikgqkcnlzobnqhtz

# Push migrations
supabase db push
```

### Option 3: Use the consolidated migration file

The file `supabase/migrations/00000000000000_complete_schema.sql` contains the complete schema and can be run independently. It includes:

- All table definitions (cases, documents, profiles, timeline_events, import_jobs, video_rooms)
- Row Level Security (RLS) policies
- Indexes for performance
- Helper functions and triggers
- Storage bucket setup

## Verification

After running the migration, verify it worked by:

1. Going to **Table Editor** in Supabase Dashboard
2. Checking that you see tables: `cases`, `documents`, `profiles`, `timeline_events`, `import_jobs`, `video_rooms`
3. Trying to create a new case in your application

## What This Fixes

- Creates the missing `cases` table
- Sets up all other required tables
- Configures Row Level Security for data protection
- Creates necessary indexes for performance
- Sets up storage policies for document uploads

## Need Help?

If you encounter any issues:
1. Check the Supabase logs in the Dashboard
2. Ensure you're logged in as the project owner
3. Verify the project ID matches: `usyxikgqkcnlzobnqhtz`
