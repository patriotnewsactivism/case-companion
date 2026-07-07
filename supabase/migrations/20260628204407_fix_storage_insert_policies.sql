-- Back-filled from remote: applied directly to the linked project on 2026-06-28
-- (present in supabase_migrations.schema_migrations but missing locally).

-- Drop the unscoped INSERT policies and replace with user-scoped ones
DROP POLICY IF EXISTS "case_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_insert_own" ON storage.objects;

-- Single INSERT policy: authenticated users may only upload into their own user-id folder
CREATE POLICY "case_documents_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
