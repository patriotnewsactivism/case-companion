-- Create import_jobs table for tracking Google Drive imports
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_folder_id TEXT NOT NULL,
  source_folder_name TEXT NOT NULL,
  source_folder_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  successful_files INTEGER NOT NULL DEFAULT 0,
  failed_files INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  failed_file_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_rooms table for video collaboration
CREATE TABLE public.video_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  room_name TEXT NOT NULL,
  room_url TEXT NOT NULL,
  daily_room_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  enable_recording BOOLEAN NOT NULL DEFAULT false,
  recording_url TEXT,
  transcription_text TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_jobs
CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for video_rooms
CREATE POLICY "Users can view their own video rooms"
  ON public.video_rooms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video rooms"
  ON public.video_rooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video rooms"
  ON public.video_rooms FOR UPDATE
  USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_rooms_updated_at
  BEFORE UPDATE ON public.video_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();