
-- 1. Move client portal password hashes to a locked-down credentials table
CREATE TABLE IF NOT EXISTS public.client_portal_credentials (
  client_user_id uuid PRIMARY KEY REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill any existing hashes
INSERT INTO public.client_portal_credentials (client_user_id, password_hash)
SELECT id, password_hash
FROM public.client_portal_users
WHERE password_hash IS NOT NULL
ON CONFLICT (client_user_id) DO NOTHING;

-- Drop the readable column
ALTER TABLE public.client_portal_users DROP COLUMN IF EXISTS password_hash;

-- Lock the credentials table down: RLS on, no policies => no app-user access.
-- Service role used by edge functions bypasses RLS automatically.
ALTER TABLE public.client_portal_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_portal_credentials FROM anon, authenticated;

-- 2. Make case-documents bucket private (signed URLs only)
UPDATE storage.buckets SET public = false WHERE id = 'case-documents';

-- 3. Realtime authorization for import_jobs broadcasts.
-- Topic convention: "import_jobs:<user_id>"
DROP POLICY IF EXISTS "Users read own import_jobs realtime topic" ON realtime.messages;
CREATE POLICY "Users read own import_jobs realtime topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'import_jobs:' || auth.uid()::text
);

-- 4. Fix broken self-join in organizations RLS policy
DROP POLICY IF EXISTS "Members view organization" ON public.organizations;
CREATE POLICY "Members view organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
  )
);

-- 5. Add missing DELETE policies
DROP POLICY IF EXISTS "Users delete own import_jobs" ON public.import_jobs;
CREATE POLICY "Users delete own import_jobs"
ON public.import_jobs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own video_rooms" ON public.video_rooms;
CREATE POLICY "Users delete own video_rooms"
ON public.video_rooms
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
