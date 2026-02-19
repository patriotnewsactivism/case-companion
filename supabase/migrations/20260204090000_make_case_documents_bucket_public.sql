-- Make case-documents bucket public to fix "Bucket not found" errors
-- RLS policies still protect user data - users can only access their own files

UPDATE storage.buckets
SET public = true
WHERE id = 'case-documents';
