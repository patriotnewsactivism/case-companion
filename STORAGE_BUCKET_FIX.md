# Storage Bucket Fix - "Bucket not found" Error

## Problem

When trying to view or download uploaded documents, users encounter a 404 error:
```json
{"status_code":"404","error":"Bucket not found","message":"Bucket not found"}
```

## Root Cause

The `case-documents` storage bucket is configured as **private** (`public: false`), but the application code uses `getPublicUrl()` to generate URLs for viewing documents. Public URLs only work with public buckets, hence the 404 error.

**Code Reference:** src/pages/CaseDetail.tsx:733-735
```typescript
const { data: { publicUrl } } = supabase.storage
  .from('case-documents')
  .getPublicUrl(uploadData.path);  // This requires a PUBLIC bucket
```

## Solution

Make the `case-documents` bucket **public**. The existing RLS (Row Level Security) policies will continue to protect user data - users can only access files in their own folders (`{user_id}/{case_id}/`).

## How to Apply the Fix

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase SQL Editor: https://app.supabase.com/project/rerbrlrxptnusypzpghj/editor/sql
2. Create a new query and paste this SQL:
   ```sql
   UPDATE storage.buckets
   SET public = true
   WHERE id = 'case-documents';
   ```
3. Click "Run" to execute
4. Verify in Storage settings that the bucket is now public

### Option 2: Via Migration File

The migration file has already been created at:
`supabase/migrations/20260204090000_make_case_documents_bucket_public.sql`

If you're using Supabase CLI, run:
```bash
supabase db push
```

Otherwise, copy the SQL from the migration file and run it in the SQL Editor as described in Option 1.

## Security Note

Making the bucket public is **safe** because:

1. ✅ RLS policies are still enforced on `storage.objects`
2. ✅ Users can only access files where `auth.uid()::text = (storage.foldername(name))[1]`
3. ✅ File paths follow the pattern `{user_id}/{case_id}/{filename}`
4. ✅ Users cannot guess or access other users' file paths
5. ✅ All CRUD operations (INSERT, SELECT, DELETE, UPDATE) are protected by RLS

The bucket being "public" only means that URLs can be accessed without signed tokens - the RLS policies determine **who** can access **what**.

## Verification

After applying the fix:

1. Upload a test document to a case
2. Click the "View" button on the document
3. The document should open in a new tab without any 404 errors

## Alternative Approach (Not Recommended)

Instead of making the bucket public, you could modify the code to use `createSignedUrl()` instead of `getPublicUrl()`. However, this would require:

1. Changing the upload code to generate signed URLs (which expire)
2. Implementing URL refresh logic for expired links
3. Updating the database schema to track URL expiration
4. More complex code and user experience

Making the bucket public is simpler and equally secure with proper RLS policies.
