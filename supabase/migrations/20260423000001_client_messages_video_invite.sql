-- Add missing columns to client_messages for video invite system
ALTER TABLE public.client_messages
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- Index for message type lookups
CREATE INDEX IF NOT EXISTS idx_client_messages_type ON public.client_messages(message_type);
