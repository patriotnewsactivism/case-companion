-- Create video rooms table for secure video conferencing
CREATE TABLE public.video_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_name TEXT NOT NULL UNIQUE,
  room_url TEXT NOT NULL,
  daily_room_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Recording settings
  enable_recording BOOLEAN DEFAULT true,
  recording_started_at TIMESTAMP WITH TIME ZONE,
  recording_url TEXT,
  recording_status TEXT, -- 'pending', 'processing', 'completed', 'failed'

  -- Transcription
  transcription_text TEXT,
  transcription_url TEXT,
  transcription_status TEXT, -- 'pending', 'processing', 'completed', 'failed'
  transcription_processed_at TIMESTAMP WITH TIME ZONE,

  -- Room status and metadata
  status TEXT DEFAULT 'active', -- 'active', 'ended', 'expired'
  max_participants INTEGER DEFAULT 10,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Security
  is_private BOOLEAN DEFAULT true,
  require_authentication BOOLEAN DEFAULT true,
  knocking_enabled BOOLEAN DEFAULT true,

  -- Audit trail
  participants_log JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video room participants table for tracking who joined
CREATE TABLE public.video_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.video_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  is_owner BOOLEAN DEFAULT false,
  participant_token TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_room_participants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for video_rooms
CREATE POLICY "Users can view video rooms for their cases"
  ON public.video_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = video_rooms.case_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create video rooms for their cases"
  ON public.video_rooms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = case_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their video rooms"
  ON public.video_rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = video_rooms.case_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their video rooms"
  ON public.video_rooms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = video_rooms.case_id
      AND cases.user_id = auth.uid()
    )
  );

-- Create RLS policies for video_room_participants
CREATE POLICY "Users can view participants in their video rooms"
  ON public.video_room_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.video_rooms
      JOIN public.cases ON cases.id = video_rooms.case_id
      WHERE video_rooms.id = video_room_participants.room_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert participants for their video rooms"
  ON public.video_room_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.video_rooms
      JOIN public.cases ON cases.id = video_rooms.case_id
      WHERE video_rooms.id = room_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update participants in their video rooms"
  ON public.video_room_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.video_rooms
      JOIN public.cases ON cases.id = video_rooms.case_id
      WHERE video_rooms.id = video_room_participants.room_id
      AND cases.user_id = auth.uid()
    )
  );

-- Apply updated_at trigger
CREATE TRIGGER update_video_rooms_updated_at
  BEFORE UPDATE ON public.video_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_video_rooms_case_id ON public.video_rooms(case_id);
CREATE INDEX idx_video_rooms_user_id ON public.video_rooms(user_id);
CREATE INDEX idx_video_rooms_status ON public.video_rooms(status);
CREATE INDEX idx_video_rooms_room_name ON public.video_rooms(room_name);
CREATE INDEX idx_video_room_participants_room_id ON public.video_room_participants(room_id);
CREATE INDEX idx_video_room_participants_user_id ON public.video_room_participants(user_id);

-- Create function to automatically expire rooms
CREATE OR REPLACE FUNCTION public.expire_video_rooms()
RETURNS void AS $$
BEGIN
  UPDATE public.video_rooms
  SET status = 'expired'
  WHERE expires_at < now()
  AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE public.video_rooms IS 'Stores video conference room information with recording and transcription support';
COMMENT ON TABLE public.video_room_participants IS 'Tracks participants who join video conference rooms';
COMMENT ON COLUMN public.video_rooms.enable_recording IS 'Whether recording is enabled for this room. Set to false to disable recording.';
COMMENT ON COLUMN public.video_rooms.require_authentication IS 'Whether participants must be authenticated to join';
COMMENT ON COLUMN public.video_rooms.knocking_enabled IS 'Whether participants must request to join (knocking feature)';
