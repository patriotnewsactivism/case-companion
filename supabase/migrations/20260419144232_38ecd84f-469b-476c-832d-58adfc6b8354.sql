
-- Explicit deny-all policies so the linter sees policies present.
-- Service role bypasses RLS entirely.
DROP POLICY IF EXISTS "Deny all access to credentials" ON public.client_portal_credentials;
CREATE POLICY "Deny all access to credentials"
ON public.client_portal_credentials
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
