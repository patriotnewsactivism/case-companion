-- Client Portal System Migration
-- Enables client access and communication

-- Create access level enum
DO $$ BEGIN
  CREATE TYPE public.client_access_level AS ENUM ('view', 'comment', 'upload', 'full');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sender type enum
DO $$ BEGIN
  CREATE TYPE public.sender_type AS ENUM ('attorney', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create client portal users table
CREATE TABLE IF NOT EXISTS public.client_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  access_level public.client_access_level NOT NULL DEFAULT 'view',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  password_hash TEXT,
  magic_link_token TEXT,
  magic_link_expires TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_email_case UNIQUE (email, case_id)
);

-- Create client documents table
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client messages table
CREATE TABLE IF NOT EXISTS public.client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  sender_type public.sender_type NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

-- Client portal users policies
DROP POLICY IF EXISTS "Attorneys can view portal users for their cases" ON public.client_portal_users;
CREATE POLICY "Attorneys can view portal users for their cases"
  ON public.client_portal_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_portal_users.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Attorneys can invite clients" ON public.client_portal_users;
CREATE POLICY "Attorneys can invite clients"
  ON public.client_portal_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_portal_users.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Attorneys can update portal users" ON public.client_portal_users;
CREATE POLICY "Attorneys can update portal users"
  ON public.client_portal_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_portal_users.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Attorneys can delete portal users" ON public.client_portal_users;
CREATE POLICY "Attorneys can delete portal users"
  ON public.client_portal_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_portal_users.case_id 
      AND cases.user_id = auth.uid()
    )
  );

-- Client documents policies
DROP POLICY IF EXISTS "Attorneys can view client documents" ON public.client_documents;
CREATE POLICY "Attorneys can view client documents"
  ON public.client_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_documents.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Attorneys can manage client documents" ON public.client_documents;
CREATE POLICY "Attorneys can manage client documents"
  ON public.client_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_documents.case_id 
      AND cases.user_id = auth.uid()
    )
  );

-- Client messages policies
DROP POLICY IF EXISTS "Attorneys can view client messages" ON public.client_messages;
CREATE POLICY "Attorneys can view client messages"
  ON public.client_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_messages.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Attorneys can send messages" ON public.client_messages;
CREATE POLICY "Attorneys can send messages"
  ON public.client_messages FOR INSERT
  WITH CHECK (
    sender_type = 'attorney' AND
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = client_messages.case_id 
      AND cases.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_portal_users_case_id ON public.client_portal_users(case_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_email ON public.client_portal_users(email);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_magic_link_token ON public.client_portal_users(magic_link_token) WHERE magic_link_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_documents_case_id ON public.client_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by ON public.client_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_messages_case_id ON public.client_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_created_at ON public.client_messages(created_at DESC);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_client_portal_users_updated_at ON public.client_portal_users;
CREATE TRIGGER update_client_portal_users_updated_at
  BEFORE UPDATE ON public.client_portal_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_documents_updated_at ON public.client_documents;
CREATE TRIGGER update_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
