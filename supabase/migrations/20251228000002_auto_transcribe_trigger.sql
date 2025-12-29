-- Create a function to trigger transcription for audio/video files
-- This will be called via a webhook or background job

-- For now, we'll just add a comment noting that transcription should be triggered
-- The actual triggering will be done from the application layer via Supabase Edge Functions

-- Add a helper view to identify media files that need transcription
CREATE OR REPLACE VIEW public.media_files_pending_transcription AS
SELECT
  id,
  name,
  file_url,
  file_type,
  media_type,
  created_at
FROM public.documents
WHERE
  media_type IN ('audio', 'video')
  AND transcription_text IS NULL
  AND transcription_processed_at IS NULL
  AND file_url IS NOT NULL
ORDER BY created_at DESC;

-- Grant access to authenticated users to view their own pending transcriptions
GRANT SELECT ON public.media_files_pending_transcription TO authenticated;

-- Add RLS policy for the view
ALTER VIEW public.media_files_pending_transcription SET (security_invoker = on);

-- Add helpful comment
COMMENT ON VIEW public.media_files_pending_transcription IS
'View of audio/video files that have been uploaded but not yet transcribed.
Use this to find files that need transcription processing.';
