-- Audit and Security System Migration
-- Comprehensive audit logging and security features

-- Create audit action enum
DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM ('create', 'read', 'update', 'delete', 'export', 'share');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create permission level enum
DO $$ BEGIN
  CREATE TYPE public.permission_level AS ENUM ('read', 'write', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sensitivity level enum
DO $$ BEGIN
  CREATE TYPE public.sensitivity_level AS ENUM ('public', 'internal', 'confidential', 'restricted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add sensitivity_level to documents table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'sensitivity_level'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN sensitivity_level public.sensitivity_level DEFAULT 'internal';
  END IF;
END $$;

-- Create audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  geolocation JSONB,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  retention_until TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create encryption keys table
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  key_hash TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rotated_at TIMESTAMP WITH TIME ZONE
);

-- Create access permissions table
CREATE TABLE IF NOT EXISTS public.access_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_level public.permission_level NOT NULL DEFAULT 'read',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;

-- Audit logs policies (users can only view their own logs)
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Encryption keys policies
DROP POLICY IF EXISTS "Users can view encryption keys for their cases" ON public.encryption_keys;
CREATE POLICY "Users can view encryption keys for their cases"
  ON public.encryption_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = encryption_keys.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create encryption keys for their cases" ON public.encryption_keys;
CREATE POLICY "Users can create encryption keys for their cases"
  ON public.encryption_keys FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = encryption_keys.case_id 
      AND cases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update encryption keys for their cases" ON public.encryption_keys;
CREATE POLICY "Users can update encryption keys for their cases"
  ON public.encryption_keys FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = encryption_keys.case_id 
      AND cases.user_id = auth.uid()
    )
  );

-- Access permissions policies
DROP POLICY IF EXISTS "Users can view permissions they granted or received" ON public.access_permissions;
CREATE POLICY "Users can view permissions they granted or received"
  ON public.access_permissions FOR SELECT
  USING (user_id = auth.uid() OR granted_by = auth.uid());

DROP POLICY IF EXISTS "Users can grant permissions" ON public.access_permissions;
CREATE POLICY "Users can grant permissions"
  ON public.access_permissions FOR INSERT
  WITH CHECK (granted_by = auth.uid());

DROP POLICY IF EXISTS "Users can revoke permissions they granted" ON public.access_permissions;
CREATE POLICY "Users can revoke permissions they granted"
  ON public.access_permissions FOR DELETE
  USING (granted_by = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_until ON public.audit_logs(retention_until);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_case_id ON public.encryption_keys(case_id);
CREATE INDEX IF NOT EXISTS idx_access_permissions_user_id ON public.access_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_access_permissions_resource ON public.access_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_permissions_expires_at ON public.access_permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_sensitivity ON public.documents(sensitivity_level);

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.audit_log(
  p_action public.audit_action,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_is_sensitive BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, 
    old_values, new_values, is_sensitive
  ) VALUES (
    auth.uid(), p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_is_sensitive
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired audit logs
CREATE OR REPLACE FUNCTION public.cleanup_expired_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE retention_until < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired permissions
CREATE OR REPLACE FUNCTION public.cleanup_expired_permissions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.access_permissions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
