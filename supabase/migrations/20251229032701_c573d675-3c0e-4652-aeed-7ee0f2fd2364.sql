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
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;

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

-- Add trigger for updated_at
CREATE TRIGGER update_video_rooms_updated_at
  BEFORE UPDATE ON public.video_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();