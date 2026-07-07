
DROP POLICY IF EXISTS "Participants update own record" ON public.video_room_participants;
CREATE POLICY "Participants update own record"
ON public.video_room_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants delete own record" ON public.video_room_participants;
CREATE POLICY "Participants delete own record"
ON public.video_room_participants
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
