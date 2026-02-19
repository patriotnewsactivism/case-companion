drop extension if exists "pg_net";


  create table "public"."video_room_participants" (
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

alter table "public"."video_rooms" add column "daily_room_name" text not null;

alter table "public"."video_rooms" add column "enable_recording" boolean default true;

alter table "public"."video_rooms" add column "ended_at" timestamp with time zone;

alter table "public"."video_rooms" add column "is_private" boolean default true;

alter table "public"."video_rooms" add column "knocking_enabled" boolean default true;

alter table "public"."video_rooms" add column "participants_log" jsonb default '[]'::jsonb;

alter table "public"."video_rooms" add column "recording_started_at" timestamp with time zone;

alter table "public"."video_rooms" add column "recording_status" text;

alter table "public"."video_rooms" add column "recording_url" text;

alter table "public"."video_rooms" add column "require_authentication" boolean default true;

alter table "public"."video_rooms" add column "status" text default 'active'::text;

alter table "public"."video_rooms" add column "title" text not null;

alter table "public"."video_rooms" add column "transcription_processed_at" timestamp with time zone;

alter table "public"."video_rooms" add column "transcription_status" text;

alter table "public"."video_rooms" add column "transcription_text" text;

alter table "public"."video_rooms" add column "transcription_url" text;

alter table "public"."video_rooms" add column "updated_at" timestamp with time zone not null default now();

CREATE INDEX idx_video_room_participants_room_id ON public.video_room_participants USING btree (room_id);

CREATE INDEX idx_video_room_participants_user_id ON public.video_room_participants USING btree (user_id);

CREATE INDEX idx_video_rooms_status ON public.video_rooms USING btree (status);

CREATE UNIQUE INDEX video_room_participants_pkey ON public.video_room_participants USING btree (id);

alter table "public"."video_room_participants" add constraint "video_room_participants_pkey" PRIMARY KEY using index "video_room_participants_pkey";

alter table "public"."video_room_participants" add constraint "video_room_participants_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.video_rooms(id) ON DELETE CASCADE not valid;

alter table "public"."video_room_participants" validate constraint "video_room_participants_room_id_fkey";

alter table "public"."video_room_participants" add constraint "video_room_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."video_room_participants" validate constraint "video_room_participants_user_id_fkey";

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


  create policy "Users can insert participants for their video rooms"
  on "public"."video_room_participants"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.video_rooms
     JOIN public.cases ON ((cases.id = video_rooms.case_id)))
  WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can update participants in their video rooms"
  on "public"."video_room_participants"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.video_rooms
     JOIN public.cases ON ((cases.id = video_rooms.case_id)))
  WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM (public.video_rooms
     JOIN public.cases ON ((cases.id = video_rooms.case_id)))
  WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can view participants in their video rooms"
  on "public"."video_room_participants"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.video_rooms
     JOIN public.cases ON ((cases.id = video_rooms.case_id)))
  WHERE ((video_rooms.id = video_room_participants.room_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can create video rooms for their cases"
  on "public"."video_rooms"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can delete their video rooms"
  on "public"."video_rooms"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can update their video rooms"
  on "public"."video_rooms"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can view video rooms for their cases"
  on "public"."video_rooms"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.cases
  WHERE ((cases.id = video_rooms.case_id) AND (cases.user_id = ( SELECT auth.uid() AS uid))))));


CREATE TRIGGER update_video_rooms_updated_at BEFORE UPDATE ON public.video_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

drop trigger if exists "objects_delete_delete_prefix" on "storage"."objects";

drop trigger if exists "objects_insert_create_prefix" on "storage"."objects";

drop trigger if exists "objects_update_create_prefix" on "storage"."objects";

drop trigger if exists "prefixes_create_hierarchy" on "storage"."prefixes";

drop trigger if exists "prefixes_delete_hierarchy" on "storage"."prefixes";

drop policy "Users can upload their own documents" on "storage"."objects";

drop policy "Users can delete their own documents" on "storage"."objects";

drop policy "Users can update their own documents" on "storage"."objects";

drop policy "Users can view their own documents" on "storage"."objects";


  create policy "Users can delete their own case documents"
  on "storage"."buckets"
  as permissive
  for delete
  to authenticated
using (((auth.uid())::text = (storage.foldername(name))[1]));



  create policy "Users can update their own case documents"
  on "storage"."buckets"
  as permissive
  for update
  to authenticated, anon
using (((auth.uid())::text = (storage.foldername(name))[1]));



  create policy "Users can upload their own case documents"
  on "storage"."buckets"
  as permissive
  for insert
  to authenticated
with check (((auth.uid())::text = (storage.foldername(name))[1]));



  create policy "Users can view their own case documents"
  on "storage"."buckets"
  as permissive
  for select
  to authenticated, anon
using (((auth.uid())::text = (storage.foldername(name))[1]));



  create policy "Users can delete their own files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));



  create policy "Users can update their own files"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
with check (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));



  create policy "Users can upload to their own folder"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));



  create policy "Users can view their own folder"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'case-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));



  create policy "Users can delete their own documents"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'user-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));



  create policy "Users can update their own documents"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'user-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
with check (((bucket_id = 'user-docs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));



  create policy "Users can view their own documents"
  on "storage"."objects"
  as permissive
  for select
  to authenticated, anon
using (((auth.uid())::text = (storage.foldername(name))[1]));


CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


