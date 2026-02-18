-- Ensure the case-documents bucket exists in all environments.
-- Previous migrations updated bucket settings but did not always guarantee creation.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'case-documents'
  ) THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    VALUES (
      'case-documents',
      'case-documents',
      true,
      524288000,
      ARRAY[
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/jpeg',
        'image/png',
        'audio/mpeg',
        'audio/wav',
        'audio/mp4',
        'video/mp4',
        'video/webm',
        'video/quicktime'
      ]
    );
  END IF;
END $$;

UPDATE storage.buckets
SET
  public = true
WHERE id = 'case-documents';
