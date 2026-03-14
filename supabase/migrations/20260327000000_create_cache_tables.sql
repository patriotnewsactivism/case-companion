-- Document content hash cache
CREATE TABLE IF NOT EXISTS public.document_hash_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  ocr_text TEXT,
  ocr_confidence REAL,
  ocr_provider TEXT,
  native_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_document_hash ON public.document_hash_cache(content_hash);

-- AI analysis cache
CREATE TABLE IF NOT EXISTS public.ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  result JSONB NOT NULL,
  model_used TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  access_count INTEGER DEFAULT 1,
  UNIQUE(content_hash, analysis_type, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON public.ai_analysis_cache(content_hash, analysis_type);

-- Transcription cache
CREATE TABLE IF NOT EXISTS public.transcription_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL UNIQUE,
  transcript_text TEXT,
  transcript_segments JSONB,
  speakers JSONB,
  duration_seconds REAL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_transcript_hash ON public.transcription_cache(content_hash);

-- API usage tracking for rate limit awareness
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID,
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_provider_date ON public.api_usage_log(provider, created_at);

-- Rate limit tracker
CREATE TABLE IF NOT EXISTS public.rate_limit_status (
  provider TEXT PRIMARY KEY,
  requests_used INTEGER DEFAULT 0,
  requests_limit INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  is_available BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.rate_limit_status (provider, requests_used, requests_limit, reset_at) VALUES
  ('tesseract_local', 0, 999999999, now() + interval '100 years'),
  ('azure_vision', 0, 5000, date_trunc('month', now()) + interval '1 month'),
  ('gemini_ocr', 0, 1500, date_trunc('day', now()) + interval '1 day'),
  ('gemini_ai', 0, 1500, date_trunc('day', now()) + interval '1 day'),
  ('gpt4o_mini', 0, 999999999, now() + interval '100 years'),
  ('assemblyai', 0, 300, date_trunc('month', now()) + interval '1 month'),
  ('whisper_local', 0, 999999999, now() + interval '100 years')
ON CONFLICT (provider) DO NOTHING;

-- Function to increment cache access count
CREATE OR REPLACE FUNCTION increment_cache_access(cache_table TEXT, hash TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET access_count = access_count + 1, last_accessed_at = now() WHERE content_hash = $1', cache_table)
  USING hash;
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit usage
CREATE OR REPLACE FUNCTION increment_rate_limit_usage(provider_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.rate_limit_status
  SET requests_used = requests_used + 1,
      updated_at = now()
  WHERE provider = provider_name;
END;
$$ LANGUAGE plpgsql;
