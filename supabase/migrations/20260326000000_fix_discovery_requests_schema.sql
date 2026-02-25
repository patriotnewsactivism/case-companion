-- Ensure discovery_requests exists and matches frontend/edge-function expectations.

CREATE TABLE IF NOT EXISTS public.discovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT NOT NULL,
  request_number TEXT,
  question TEXT NOT NULL,
  response TEXT,
  objections TEXT[] DEFAULT '{}'::text[],
  served_date DATE,
  response_due_date DATE,
  response_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  privilege_log_entry BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.discovery_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT,
  ADD COLUMN IF NOT EXISTS request_number TEXT,
  ADD COLUMN IF NOT EXISTS served_date DATE,
  ADD COLUMN IF NOT EXISTS response_due_date DATE,
  ADD COLUMN IF NOT EXISTS response_date DATE,
  ADD COLUMN IF NOT EXISTS privilege_log_entry BOOLEAN DEFAULT false;

UPDATE public.discovery_requests
SET objections = '{}'::text[]
WHERE objections IS NULL;

UPDATE public.discovery_requests
SET status = 'pending'
WHERE status IS NULL OR status = '';

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'discovery_requests'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%request_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.discovery_requests DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'discovery_requests'
      AND c.conname = 'discovery_requests_request_type_check'
  ) THEN
    ALTER TABLE public.discovery_requests
      ADD CONSTRAINT discovery_requests_request_type_check
      CHECK (request_type IN ('interrogatory', 'request_for_production', 'request_for_admission', 'deposition'));
  END IF;
END;
$$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'discovery_requests'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.discovery_requests DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'discovery_requests'
      AND c.conname = 'discovery_requests_status_check'
  ) THEN
    ALTER TABLE public.discovery_requests
      ADD CONSTRAINT discovery_requests_status_check
      CHECK (status IN ('pending', 'responded', 'objected', 'overdue', 'draft'));
  END IF;
END;
$$;

ALTER TABLE public.discovery_requests
  ALTER COLUMN request_type SET NOT NULL,
  ALTER COLUMN question SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN privilege_log_entry SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_discovery_requests_user_id ON public.discovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_case_id ON public.discovery_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_status ON public.discovery_requests(status);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_request_type ON public.discovery_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_response_due_date ON public.discovery_requests(response_due_date);

ALTER TABLE public.discovery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can view their own discovery requests"
  ON public.discovery_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can insert their own discovery requests"
  ON public.discovery_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can update their own discovery requests"
  ON public.discovery_requests FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can delete their own discovery requests"
  ON public.discovery_requests FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_discovery_requests_updated_at ON public.discovery_requests;
CREATE TRIGGER update_discovery_requests_updated_at
  BEFORE UPDATE ON public.discovery_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
