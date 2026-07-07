ALTER TABLE public.timeline_events
ADD COLUMN IF NOT EXISTS phase TEXT,
ADD COLUMN IF NOT EXISTS next_required_action TEXT;

UPDATE public.timeline_events
SET phase = 'discovery'
WHERE phase IS NULL;

ALTER TABLE public.timeline_events
ALTER COLUMN phase SET DEFAULT 'discovery',
ALTER COLUMN phase SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_events_phase_check'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT timeline_events_phase_check
      CHECK (phase IN ('pre-suit', 'pleadings', 'discovery', 'dispositive', 'trial', 'post-trial'));
  END IF;
END $$;
