
-- Explicit deny-all policies for backend-only tables (defense-in-depth)
CREATE POLICY "Deny all client access" ON public.client_magic_links FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Deny all client access" ON public.client_password_resets FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Deny all client access" ON public.token_blacklist FOR ALL USING (false) WITH CHECK (false);

-- Fix update_updated_at_column search_path (existing function from initial schema)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
