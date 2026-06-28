drop extension if exists "pg_net";


-- video_room_participants may already exist from 20251229000000_create_video_rooms.sql
CREATE TABLE IF NOT EXISTS "public"."video_room_participants" (
  "id" uuid not null default gen_random_uuid(),
  "room_id" uuid not null,
  "user_id" uuid,
  "participant_name" text not null,
  "joined_at" timestamp with time zone not null default now(),
  "left_at" timestamp with time zone,
  "duration_seconds" integer,
  "is_owner" boolean default false,
  "participant_token" text,
  "created_at" timestamp with time zone not null default now()
);


alter table "public"."video_room_participants" enable row level security;

-- All these columns already exist in video_rooms from the earlier migration; IF NOT EXISTS makes them no-ops
alter table "public"."video_rooms" add column if not exists "daily_room_name" text;

alter table "public"."video_rooms" add column if not exists "enable_recording" boolean default true;

alter table "public"."video_rooms" add column if not exists "ended_at" timestamp with time zone;

alter table "public"."video_rooms" add column if not exists "is_private" boolean default true;

alter table "public"."video_rooms" add column if not exists "knocking_enabled" boolean default true;

alter table "public"."video_rooms" add column if not exists "participants_log" jsonb default '[]'::jsonb;

alter table "public"."video_rooms" add column if not exists "recording_started_at" timestamp with time zone;

alter table "public"."video_rooms" add column if not exists "recording_status" text;

alter table "public"."video_rooms" add column if not exists "recording_url" text;

alter table "public"."video_rooms" add column if not exists "require_authentication" boolean default true;

alter table "public"."video_rooms" add column if not exists "status" text default 'active'::text;

alter table "public"."video_rooms" add column if not exists "title" text;

alter table "public"."video_rooms" add column if not exists "transcription_processed_at" timestamp with time zone;

alter table "public"."video_rooms" add column if not exists "transcription_status" text;

alter table "public"."video_rooms" add column if not exists "transcription_text" text;

alter table "public"."video_rooms" add column if not exists "transcription_url" text;

alter table "public"."video_rooms" add column if not exists "updated_at" timestamp with time zone default now();

-- Indexes already exist from the earlier migration; IF NOT EXISTS makes them no-ops
CREATE INDEX IF NOT EXISTS idx_video_room_participants_room_id ON public.video_room_participants USING btree (room_id);

CREATE INDEX IF NOT EXISTS idx_video_room_participants_user_id ON public.video_room_participants USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_video_rooms_status ON public.video_rooms USING btree (status);

-- Primary key already exists from CREATE TABLE; skip if so
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_room_participants_pkey'
      AND conrelid = 'public.video_room_participants'::regclass
  ) THEN
    CREATE UNIQUE INDEX video_room_participants_pkey ON public.video_room_participants USING btree (id);
    ALTER TABLE "public"."video_room_participants" ADD CONSTRAINT "video_room_participants_pkey" PRIMARY KEY USING INDEX "video_room_participants_pkey";
  END IF;
END $$;

-- Foreign keys already exist from CREATE TABLE REFERENCES; skip if so
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_room_participants_room_id_fkey'
      AND conrelid = 'public.video_room_participants'::regclass
  ) THEN
    ALTER TABLE "public"."video_room_participants" ADD CONSTRAINT "video_room_participants_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.video_rooms(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE "public"."video_room_participants" VALIDATE CONSTRAINT "video_room_participants_room_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_room_participants_user_id_fkey'
      AND conrelid = 'public.video_room_participants'::regclass
  ) THEN
    ALTER TABLE "public"."video_room_participants" ADD CONSTRAINT "video_room_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
    ALTER TABLE "public"."video_room_participants" VALIDATE CONSTRAINT "video_room_participants_user_id_fkey";
  END IF;
END $$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.expire_video_rooms()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.video_rooms
  SET status = 'expired'
  WHERE expires_at < now()
    AND status = 'active';
END;
$function$
;

grant delete on table "public"."video_room_participants" to "anon";

grant insert on table "public"."video_room_participants" to "anon";

grant references on table "public"."video_room_participants" to "anon";

grant select on table "public"."video_room_participants" to "anon";

grant trigger on table "public"."video_room_participants" to "anon";

grant truncate on table "public"."video_room_participants" to "anon";

grant update on table "public"."video_room_participants" to "anon";

grant delete on table "public"."video_room_participants" to "authenticated";

grant insert on table "public"."video_room_participants" to "authenticated";

grant references on table "public"."video_room_participants" to "authenticated";

grant select on table "public"."video_room_participants" to "authenticated";

grant trigger on table "public"."video_room_participants" to "authenticated";

grant truncate on table "public"."video_room_participants" to "authenticated";

grant update on table "public"."video_room_participants" to "authenticated";

grant delete on table "public"."video_room_participants" to "service_role";

grant insert on table "public"."video_room_participants" to "service_role";

grant references on table "public"."video_room_participants" to "service_role";

grant select on table "public"."video_room_participants" to "service_role";

grant trigger on table "public"."video_room_participants" to "service_role";

grant truncate on table "public"."video_room_participants" to "service_role";

grant update on table "public"."video_room_participants" to "service_role";


DO $$ BEGIN
  CREATE POLICY "Users can insert participants for their video rooms"
  ON "public"."video_room_participants"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
     FROM (public.video_rooms
       JOIN public.cases ON ((cases.id = video_rooms.case_id)))
    WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can update participants in their video rooms"
  ON "public"."video_room_participants"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM (public.video_rooms
       JOIN public.cases ON ((cases.id = video_rooms.case_id)))
    WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
     FROM (public.video_rooms
       JOIN public.cases ON ((cases.id = video_rooms.case_id)))
    WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can view participants in their video rooms"
  ON "public"."video_room_participants"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM (public.video_rooms
       JOIN public.cases ON ((cases.id = video_rooms.case_id)))
    WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can create video rooms for their cases"
  ON "public"."video_rooms"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
     FROM public.cases
    WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can delete their video rooms"
  ON "public"."video_rooms"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM public.cases
    WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can update their video rooms"
  ON "public"."video_rooms"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM public.cases
    WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
     FROM public.cases
    WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can view video rooms for their cases"
  ON "public"."video_rooms"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM public.cases
    WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


DO $$ BEGIN
  CREATE TRIGGER update_video_rooms_updated_at BEFORE UPDATE ON public.video_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

drop trigger if exists "objects_delete_delete_prefix" on "storage"."objects";

drop trigger if exists "objects_insert_create_prefix" on "storage"."objects";

drop trigger if exists "objects_update_create_prefix" on "storage"."objects";

drop trigger if exists "prefixes_create_hierarchy" on "storage"."prefixes";

drop trigger if exists "prefixes_delete_hierarchy" on "storage"."prefixes";

drop policy if exists "Users can upload their own documents" on "storage"."objects";

drop policy if exists "Users can delete their own documents" on "storage"."objects";

drop policy if exists "Users can update their own documents" on "storage"."objects";

drop policy if exists "Users can view their own documents" on "storage"."objects";


DO $$ BEGIN
  CREATE POLICY "Users can delete their own case documents"
  ON "storage"."buckets"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((auth.uid())::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can update their own case documents"
  ON "storage"."buckets"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated, anon
  USING (((auth.uid())::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can upload their own case documents"
  ON "storage"."buckets"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((auth.uid())::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can view their own case documents"
  ON "storage"."buckets"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated, anon
  USING (((auth.uid())::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can delete their own files"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can update their own files"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
  WITH CHECK (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can upload to their own folder"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can view their own folder"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can delete their own documents"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((bucket_id = 'user-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can update their own documents"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((bucket_id = 'user-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
  WITH CHECK (((bucket_id = 'user-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;



DO $$ BEGIN
  CREATE POLICY "Users can view their own documents"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated, anon
  USING (((auth.uid())::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


DO $$ BEGIN
  CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
