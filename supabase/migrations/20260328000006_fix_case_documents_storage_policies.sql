-- Fix case-documents storage policies to match the app's canonical storage path:
-- cases/{case_id}/{content_hash}/{file_name}
-- Access is authorized via the owning case's user_id, not the first folder segment.

-- Drop legacy policies created under both historical naming schemes.
DROP POLICY IF EXISTS "Users can upload their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- INSERT: allow uploads only when the object path is cases/{case_id}/{content_hash}/{file_name}
-- and the authenticated user owns that case.
CREATE POLICY "Users can upload their own case documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents'
  AND array_length(storage.foldername(name), 1) >= 3
  AND (storage.foldername(name))[1] = 'cases'
  AND (storage.foldername(name))[2] ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.cases
    WHERE cases.id = ((storage.foldername(name))[2])::uuid
      AND cases.user_id = auth.uid()
  )
);

-- SELECT: allow reads only for objects whose case belongs to the authenticated user.
CREATE POLICY "Users can view their own case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND array_length(storage.foldername(name), 1) >= 3
  AND (storage.foldername(name))[1] = 'cases'
  AND (storage.foldername(name))[2] ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.cases
    WHERE cases.id = ((storage.foldername(name))[2])::uuid
      AND cases.user_id = auth.uid()
  )
);

-- UPDATE: allow edits only for objects whose current and next path both remain attached
-- to a case owned by the authenticated user.
CREATE POLICY "Users can update their own case documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND array_length(storage.foldername(name), 1) >= 3
  AND (storage.foldername(name))[1] = 'cases'
  AND (storage.foldername(name))[2] ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.cases
    WHERE cases.id = ((storage.foldername(name))[2])::uuid
      AND cases.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'case-documents'
  AND array_length(storage.foldername(name), 1) >= 3
  AND (storage.foldername(name))[1] = 'cases'
  AND (storage.foldername(name))[2] ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.cases
    WHERE cases.id = ((storage.foldername(name))[2])::uuid
      AND cases.user_id = auth.uid()
  )
);

-- DELETE: allow deletes only for objects whose case belongs to the authenticated user.
CREATE POLICY "Users can delete their own case documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND array_length(storage.foldername(name), 1) >= 3
  AND (storage.foldername(name))[1] = 'cases'
  AND (storage.foldername(name))[2] ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.cases
    WHERE cases.id = ((storage.foldername(name))[2])::uuid
      AND cases.user_id = auth.uid()
  )
);
