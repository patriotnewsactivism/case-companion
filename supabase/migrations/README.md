# Database Migrations

## Applying Migrations

### Automatic (Recommended)
Migrations in this directory are automatically applied when deploying to Supabase.

### Manual Application
If you need to apply migrations manually:

1. Go to your Supabase Dashboard: https://app.supabase.com/project/usyxikgqkcnlzobnqhtz
2. Navigate to the SQL Editor
3. Open the migration file you want to run
4. Copy and paste the SQL into the editor
5. Click "Run" to execute

### Storage Bucket Migration

The `20251227200000_create_case_documents_bucket.sql` migration creates:

- A `case-documents` storage bucket with:
  - Private access (not public)
  - 20MB file size limit
  - Allowed file types: PDF, Word, Text, Images

- Row Level Security policies that:
  - Allow users to upload files to their own folder structure
  - Allow users to view/download their own files
  - Allow users to delete their own files
  - Prevent users from accessing other users' files

### File Storage Structure

Files are stored in the following path format:
```
case-documents/{user_id}/{case_id}/{timestamp}.{extension}
```

This ensures files are automatically organized by user and case, and RLS policies enforce proper access control.
