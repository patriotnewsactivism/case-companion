# Troubleshooting: Cases Not Saving

If you added the `case_type` column but cases still won't save, follow these steps:

## Step 1: Run the Debugger

1. **Open** `debug-database.html` in your web browser
2. **Log in** to CaseBuddy in another tab (if not already)
3. **Click** "Run All Diagnostic Checks"
4. **Click** "Test Creating a Case"

The debugger will tell you exactly what's wrong and provide the SQL to fix it.

## Common Issues & Solutions

### Issue 1: "Permission Denied" or "RLS Policy" Error

**Problem:** Row Level Security (RLS) policies are not set up correctly.

**Solution:** Run this SQL in [Supabase SQL Editor](https://supabase.com/dashboard/project/usyxikgqkcnlzobnqhtz/sql/new):

```sql
-- Enable RLS
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can insert their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can update their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can delete their own cases" ON public.cases;

-- Create policies
CREATE POLICY "Users can view their own cases"
  ON public.cases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
  ON public.cases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cases"
  ON public.cases FOR DELETE
  USING (auth.uid() = user_id);
```

Or simply run the contents of `fix-rls-policies.sql`

### Issue 2: "Not Logged In"

**Problem:** You're not authenticated with Supabase.

**Solution:**
1. Open CaseBuddy in your browser
2. Log out completely
3. Log back in
4. Try creating a case again

### Issue 3: Case Creates But Doesn't Show Up

**Problem:** Browser cache or stale data.

**Solution:**
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache for the site
3. Close and reopen the browser tab

### Issue 4: "column does not exist" Error

**Problem:** The `case_type` column wasn't actually added.

**Solution:** Run this SQL again in [Supabase SQL Editor](https://supabase.com/dashboard/project/usyxikgqkcnlzobnqhtz/sql/new):

```sql
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_type TEXT;
```

### Issue 5: Different Column Missing (e.g., user_id, client_name)

**Problem:** Other required columns are missing.

**Solution:** Run the full migration script from `supabase/migrations/20251229230000_add_missing_case_columns.sql` in the Supabase SQL Editor.

## Still Not Working?

1. **Check browser console:**
   - Open DevTools (F12 or Right-click → Inspect)
   - Go to Console tab
   - Try creating a case
   - Copy the error message and check what it says

2. **Check Network tab:**
   - Open DevTools (F12)
   - Go to Network tab
   - Try creating a case
   - Look for failed requests (they'll be red)
   - Click on them to see the error details

3. **Verify database changes:**
   - Go to [Supabase Table Editor](https://supabase.com/dashboard/project/usyxikgqkcnlzobnqhtz/editor)
   - Click on the `cases` table
   - Verify you see the `case_type` column in the column list

## Quick Reference

| File | Purpose |
|------|---------|
| `debug-database.html` | Interactive diagnostic tool |
| `fix-database.html` | Add case_type column |
| `fix-rls-policies.sql` | Fix Row Level Security policies |
| `add-case-type-column.sql` | Detailed migration for case_type |
| `FIX-CASE-TYPE-COLUMN.md` | Complete fix documentation |
