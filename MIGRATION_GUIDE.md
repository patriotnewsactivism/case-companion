# Database Migration Guide

## Current Situation

Your remote Supabase database already has the base schema (cases, documents, profiles, timeline_events tables). The migration files in `supabase/migrations/` are trying to recreate these tables, which causes the "relation already exists" error.

## Solution: Apply Only New Migrations

You have **2 options**:

---

## Option 1: Apply Only the New Safe Migration (RECOMMENDED)

This is the **safest and fastest** approach. I've created a new idempotent migration that only adds what's missing.

### Steps:

1. **Push only the new safe migration:**

```bash
npx supabase db push --include-all=false
```

Then when prompted, select **ONLY** this migration:
- ✅ `20251229120000_safe_add_import_jobs.sql`

**OR** push all migrations (the new one is idempotent and will skip existing tables):

```bash
npx supabase db push
```

Answer `y` when prompted. The safe migration will:
- ✅ Create `import_jobs` table if it doesn't exist
- ✅ Add missing columns to `documents` table
- ✅ Skip operations if they already exist
- ✅ Show helpful notices about what was done

### What This Migration Does:

```
✓ Creates import_jobs table (if not exists)
✓ Adds media_type column to documents
✓ Adds import_job_id column to documents
✓ Adds Google Drive metadata fields:
  - drive_file_id
  - drive_file_path
  - transcription_text
  - transcription_processed_at
  - duration_seconds
✓ Creates all necessary indexes
✓ Sets up RLS policies
✓ Adds triggers
```

### Verify Success:

After running `supabase db push`, you should see output like:

```
✓ Migration completed successfully - import_jobs table is ready
```

Then test the Google Drive import feature!

---

## Option 2: Baseline Your Migrations (ADVANCED)

If Option 1 doesn't work or you want a clean migration history, you can "baseline" your migrations to mark existing ones as already applied.

### Steps:

1. **Create a baseline:**

```bash
# This tells Supabase which migrations are already applied
npx supabase db remote commit
```

This will:
- Pull the current remote schema
- Generate a new baseline migration
- Mark all existing migrations as applied

2. **Then apply new migrations:**

```bash
npx supabase db push
```

---

## Option 3: Reset and Reapply (DESTRUCTIVE - NOT RECOMMENDED)

⚠️ **WARNING:** This will **delete all your data**. Only use this in development!

```bash
# Reset remote database
npx supabase db reset --db-url postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Reapply all migrations
npx supabase db push
```

---

## Checking What's Missing

To see what's different between local and remote:

```bash
npx supabase db diff
```

This shows you SQL that would bring remote in sync with local.

---

## Verifying the import_jobs Table

After applying migrations, verify the table exists:

```bash
npx supabase db execute --sql "SELECT COUNT(*) FROM import_jobs;"
```

Should return `0` (table exists but empty).

Or check the schema:

```bash
npx supabase db execute --sql "\\d import_jobs"
```

---

## Common Issues

### "relation already exists"
**Solution:** Use Option 1 (safe migration) which checks before creating.

### "column already exists"
**Solution:** The safe migration checks for column existence before adding.

### Migration history out of sync
**Solution:** Use Option 2 (baseline) to sync migration history.

---

## Next Steps After Successful Migration

1. **Regenerate TypeScript types:**

```bash
npx supabase gen types typescript --project-id plcvjadartxntnurhcua > src/integrations/supabase/types.ts
```

2. **Deploy updated Edge Functions:**

```bash
npx supabase functions deploy import-google-drive
```

3. **Test the Google Drive import:**
   - Go to a case in your app
   - Click "Import from Google Drive"
   - Select a small test folder
   - Verify import progresses without errors

4. **Check import job status:**

```bash
npx supabase db execute --sql "SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 5;"
```

---

## Migration File Status

| Migration File | Status | Action |
|----------------|--------|--------|
| `20251227182616_*.sql` | ⚠️ Already applied | Skip or use safe migration |
| `20251227182627_*.sql` | ⚠️ Already applied | Skip or use safe migration |
| `20251227200000_*.sql` | ⚠️ Already applied | Skip or use safe migration |
| `20251228000000_*.sql` | ⚠️ Already applied | Skip or use safe migration |
| `20251228000001_*.sql` | ⚠️ Partial - table missing | **NEEDED** |
| `20251228000002_*.sql` | ⚠️ Partial | **NEEDED** |
| `20251228205953_*.sql` | ⚠️ Already applied | Skip or use safe migration |
| `20251229000000_*.sql` | ✅ New - video_rooms | **NEEDED** |
| `20251229032701_*.sql` | ✅ Fixed - no conflicts | **NEEDED** |
| `20251229120000_*.sql` | ✅ **Safe migration** | **USE THIS** |

---

## Recommended Action

**Just run:**

```bash
npx supabase db push
```

When prompted with the list of migrations, answer `y`.

The safe migration (`20251229120000_safe_add_import_jobs.sql`) will handle everything correctly, skipping what already exists and only adding what's missing.

Then verify:

```bash
npx supabase db execute --sql "SELECT COUNT(*) FROM import_jobs;"
```

Should output: `0` (table exists, no records yet)

✅ **You're done!** Now test the Google Drive import feature.
