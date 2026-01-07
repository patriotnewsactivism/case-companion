drop extension if exists "pg_net";

create extension if not exists "pg_trgm" with schema "public";

create extension if not exists "vector" with schema "public";

drop trigger if exists "update_cases_updated_at" on "public"."cases";

drop trigger if exists "update_documents_updated_at" on "public"."documents";

drop trigger if exists "update_import_jobs_updated_at_trigger" on "public"."import_jobs";

drop trigger if exists "update_profiles_updated_at" on "public"."profiles";

drop trigger if exists "update_timeline_events_updated_at" on "public"."timeline_events";

drop trigger if exists "update_video_rooms_updated_at" on "public"."video_rooms";

drop policy "Users can delete their own cases" on "public"."cases";

drop policy "Users can insert their own cases" on "public"."cases";

drop policy "Users can update their own cases" on "public"."cases";

drop policy "Users can view their own cases" on "public"."cases";

drop policy "Users can delete their own documents" on "public"."documents";

drop policy "Users can insert their own documents" on "public"."documents";

drop policy "Users can update their own documents" on "public"."documents";

drop policy "Users can view their own documents" on "public"."documents";

drop policy "Users can create their own import jobs" on "public"."import_jobs";

drop policy "Users can delete their own import jobs" on "public"."import_jobs";

drop policy "Users can update their own import jobs" on "public"."import_jobs";

drop policy "Users can view their own import jobs" on "public"."import_jobs";

drop policy "Users can delete their own profile" on "public"."profiles";

drop policy "Users can insert their own profile" on "public"."profiles";

drop policy "Users can update their own profile" on "public"."profiles";

drop policy "Users can view their own profile" on "public"."profiles";

drop policy "Users can delete their own timeline events" on "public"."timeline_events";

drop policy "Users can insert their own timeline events" on "public"."timeline_events";

drop policy "Users can update their own timeline events" on "public"."timeline_events";

drop policy "Users can view their own timeline events" on "public"."timeline_events";

drop policy "Users can insert participants for their video rooms" on "public"."video_room_participants";

drop policy "Users can update participants in their video rooms" on "public"."video_room_participants";

drop policy "Users can view participants in their video rooms" on "public"."video_room_participants";

drop policy "Users can create video rooms for their cases" on "public"."video_rooms";

drop policy "Users can delete their video rooms" on "public"."video_rooms";

drop policy "Users can update their video rooms" on "public"."video_rooms";

drop policy "Users can view video rooms for their cases" on "public"."video_rooms";

revoke delete on table "public"."import_jobs" from "anon";

revoke insert on table "public"."import_jobs" from "anon";

revoke references on table "public"."import_jobs" from "anon";

revoke select on table "public"."import_jobs" from "anon";

revoke trigger on table "public"."import_jobs" from "anon";

revoke truncate on table "public"."import_jobs" from "anon";

revoke update on table "public"."import_jobs" from "anon";

revoke delete on table "public"."import_jobs" from "authenticated";

revoke insert on table "public"."import_jobs" from "authenticated";

revoke references on table "public"."import_jobs" from "authenticated";

revoke select on table "public"."import_jobs" from "authenticated";

revoke trigger on table "public"."import_jobs" from "authenticated";

revoke truncate on table "public"."import_jobs" from "authenticated";

revoke update on table "public"."import_jobs" from "authenticated";

revoke delete on table "public"."import_jobs" from "service_role";

revoke insert on table "public"."import_jobs" from "service_role";

revoke references on table "public"."import_jobs" from "service_role";

revoke select on table "public"."import_jobs" from "service_role";

revoke trigger on table "public"."import_jobs" from "service_role";

revoke truncate on table "public"."import_jobs" from "service_role";

revoke update on table "public"."import_jobs" from "service_role";

revoke delete on table "public"."timeline_events" from "anon";

revoke insert on table "public"."timeline_events" from "anon";

revoke references on table "public"."timeline_events" from "anon";

revoke select on table "public"."timeline_events" from "anon";

revoke trigger on table "public"."timeline_events" from "anon";

revoke truncate on table "public"."timeline_events" from "anon";

revoke update on table "public"."timeline_events" from "anon";

revoke delete on table "public"."timeline_events" from "authenticated";

revoke insert on table "public"."timeline_events" from "authenticated";

revoke references on table "public"."timeline_events" from "authenticated";

revoke select on table "public"."timeline_events" from "authenticated";

revoke trigger on table "public"."timeline_events" from "authenticated";

revoke truncate on table "public"."timeline_events" from "authenticated";

revoke update on table "public"."timeline_events" from "authenticated";

revoke delete on table "public"."timeline_events" from "service_role";

revoke insert on table "public"."timeline_events" from "service_role";

revoke references on table "public"."timeline_events" from "service_role";

revoke select on table "public"."timeline_events" from "service_role";

revoke trigger on table "public"."timeline_events" from "service_role";

revoke truncate on table "public"."timeline_events" from "service_role";

revoke update on table "public"."timeline_events" from "service_role";

revoke delete on table "public"."video_room_participants" from "anon";

revoke insert on table "public"."video_room_participants" from "anon";

revoke references on table "public"."video_room_participants" from "anon";

revoke select on table "public"."video_room_participants" from "anon";

revoke trigger on table "public"."video_room_participants" from "anon";

revoke truncate on table "public"."video_room_participants" from "anon";

revoke update on table "public"."video_room_participants" from "anon";

revoke delete on table "public"."video_room_participants" from "authenticated";

revoke insert on table "public"."video_room_participants" from "authenticated";

revoke references on table "public"."video_room_participants" from "authenticated";

revoke select on table "public"."video_room_participants" from "authenticated";

revoke trigger on table "public"."video_room_participants" from "authenticated";

revoke truncate on table "public"."video_room_participants" from "authenticated";

revoke update on table "public"."video_room_participants" from "authenticated";

revoke delete on table "public"."video_room_participants" from "service_role";

revoke insert on table "public"."video_room_participants" from "service_role";

revoke references on table "public"."video_room_participants" from "service_role";

revoke select on table "public"."video_room_participants" from "service_role";

revoke trigger on table "public"."video_room_participants" from "service_role";

revoke truncate on table "public"."video_room_participants" from "service_role";

revoke update on table "public"."video_room_participants" from "service_role";

revoke delete on table "public"."video_rooms" from "anon";

revoke insert on table "public"."video_rooms" from "anon";

revoke references on table "public"."video_rooms" from "anon";

revoke select on table "public"."video_rooms" from "anon";

revoke trigger on table "public"."video_rooms" from "anon";

revoke truncate on table "public"."video_rooms" from "anon";

revoke update on table "public"."video_rooms" from "anon";

revoke delete on table "public"."video_rooms" from "authenticated";

revoke insert on table "public"."video_rooms" from "authenticated";

revoke references on table "public"."video_rooms" from "authenticated";

revoke select on table "public"."video_rooms" from "authenticated";

revoke trigger on table "public"."video_rooms" from "authenticated";

revoke truncate on table "public"."video_rooms" from "authenticated";

revoke update on table "public"."video_rooms" from "authenticated";

revoke delete on table "public"."video_rooms" from "service_role";

revoke insert on table "public"."video_rooms" from "service_role";

revoke references on table "public"."video_rooms" from "service_role";

revoke select on table "public"."video_rooms" from "service_role";

revoke trigger on table "public"."video_rooms" from "service_role";

revoke truncate on table "public"."video_rooms" from "service_role";

revoke update on table "public"."video_rooms" from "service_role";

alter table "public"."documents" drop constraint "documents_import_job_id_fkey";

alter table "public"."import_jobs" drop constraint "import_jobs_case_id_fkey";

alter table "public"."import_jobs" drop constraint "import_jobs_user_id_fkey";

alter table "public"."profiles" drop constraint "profiles_user_id_fkey";

alter table "public"."profiles" drop constraint "profiles_user_id_key";

alter table "public"."timeline_events" drop constraint "timeline_events_case_id_fkey";

alter table "public"."timeline_events" drop constraint "timeline_events_linked_document_id_fkey";

alter table "public"."timeline_events" drop constraint "timeline_events_user_id_fkey";

alter table "public"."video_room_participants" drop constraint "video_room_participants_room_id_fkey";

alter table "public"."video_room_participants" drop constraint "video_room_participants_user_id_fkey";

alter table "public"."video_rooms" drop constraint "video_rooms_case_id_fkey";

alter table "public"."video_rooms" drop constraint "video_rooms_room_name_key";

alter table "public"."video_rooms" drop constraint "video_rooms_user_id_fkey";

drop function if exists "public"."expire_video_rooms"();

drop view if exists "public"."media_files_pending_transcription";

drop function if exists "public"."update_import_jobs_updated_at"();

drop function if exists "public"."update_updated_at_column"();

alter table "public"."import_jobs" drop constraint "import_jobs_pkey";

alter table "public"."timeline_events" drop constraint "timeline_events_pkey";

alter table "public"."video_room_participants" drop constraint "video_room_participants_pkey";

alter table "public"."video_rooms" drop constraint "video_rooms_pkey";

drop index if exists "public"."idx_cases_deadline";

drop index if exists "public"."idx_cases_notes_search";

drop index if exists "public"."idx_cases_status";

drop index if exists "public"."idx_cases_user_id";

drop index if exists "public"."idx_cases_user_status";

drop index if exists "public"."idx_cases_user_type";

drop index if exists "public"."idx_documents_ai_analyzed";

drop index if exists "public"."idx_documents_case_created";

drop index if exists "public"."idx_documents_case_id";

drop index if exists "public"."idx_documents_case_type";

drop index if exists "public"."idx_documents_drive_file_id";

drop index if exists "public"."idx_documents_import_job_id";

drop index if exists "public"."idx_documents_media_type";

drop index if exists "public"."idx_documents_ocr_processed";

drop index if exists "public"."idx_documents_ocr_text_search";

drop index if exists "public"."idx_documents_user_id";

drop index if exists "public"."idx_import_jobs_active";

drop index if exists "public"."idx_import_jobs_case";

drop index if exists "public"."idx_import_jobs_case_id";

drop index if exists "public"."idx_import_jobs_status";

drop index if exists "public"."idx_import_jobs_user_id";

drop index if exists "public"."idx_import_jobs_user_status";

drop index if exists "public"."idx_timeline_case_date";

drop index if exists "public"."idx_timeline_events_case_id";

drop index if exists "public"."idx_timeline_events_event_date";

drop index if exists "public"."idx_timeline_important";

drop index if exists "public"."idx_timeline_upcoming";

drop index if exists "public"."idx_video_room_participants_room_id";

drop index if exists "public"."idx_video_room_participants_user_id";

drop index if exists "public"."idx_video_rooms_active";

drop index if exists "public"."idx_video_rooms_case_id";

drop index if exists "public"."idx_video_rooms_case_status";

drop index if exists "public"."idx_video_rooms_room_name";

drop index if exists "public"."idx_video_rooms_status";

drop index if exists "public"."idx_video_rooms_user_id";

drop index if exists "public"."import_jobs_pkey";

drop index if exists "public"."profiles_user_id_key";

drop index if exists "public"."timeline_events_pkey";

drop index if exists "public"."video_room_participants_pkey";

drop index if exists "public"."video_rooms_pkey";

drop index if exists "public"."video_rooms_room_name_key";

drop table "public"."import_jobs";

drop table "public"."timeline_events";

drop table "public"."video_room_participants";

drop table "public"."video_rooms";


  create table "public"."agent_actions" (
    "id" uuid not null default gen_random_uuid(),
    "agent_id" uuid not null,
    "case_id" uuid,
    "document_id" uuid,
    "action_type" text not null,
    "action_details" jsonb default '{}'::jsonb,
    "confidence_score" numeric(3,2),
    "requires_review" boolean default false,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid,
    "review_decision" text,
    "review_notes" text,
    "impact_level" text default 'low'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."agent_actions" enable row level security;


  create table "public"."agent_feedback" (
    "id" uuid not null default gen_random_uuid(),
    "agent_id" uuid not null,
    "action_id" uuid,
    "user_id" uuid not null,
    "feedback_type" text not null,
    "feedback_text" text,
    "correction_data" jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."agent_feedback" enable row level security;


  create table "public"."ai_agents" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "agent_type" text not null,
    "name" text not null,
    "description" text,
    "configuration" jsonb default '{}'::jsonb,
    "status" text default 'active'::text,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "runs_count" integer default 0,
    "errors_count" integer default 0,
    "success_rate" numeric(4,3),
    "schedule" text,
    "triggers" jsonb default '[]'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_agents" enable row level security;


  create table "public"."ai_jobs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "job_type" text not null,
    "status" text not null default 'pending'::text,
    "priority" integer default 5,
    "input_data" jsonb,
    "output_data" jsonb,
    "error_message" text,
    "retry_count" integer default 0,
    "max_retries" integer default 3,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_jobs" enable row level security;


  create table "public"."ai_usage_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "service" text not null,
    "model" text not null,
    "operation" text not null,
    "input_tokens" integer,
    "output_tokens" integer,
    "total_tokens" integer generated always as ((COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0))) stored,
    "cost_usd" numeric(10,6),
    "latency_ms" integer,
    "success" boolean default true,
    "error_code" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_usage_logs" enable row level security;


  create table "public"."audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "action" text not null,
    "entity_type" text,
    "entity_id" uuid,
    "changes" jsonb,
    "ip_address" inet,
    "user_agent" text,
    "success" boolean default true,
    "error_message" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."audit_logs" enable row level security;


  create table "public"."billing_records" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "billing_date" date not null,
    "hours_worked" numeric(5,2),
    "hourly_rate" numeric(8,2),
    "amount" numeric(10,2),
    "description" text,
    "task_category" text,
    "billable" boolean default true,
    "invoiced" boolean default false,
    "invoice_id" text,
    "paid" boolean default false,
    "payment_date" date,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."billing_records" enable row level security;


  create table "public"."case_collaborators" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "added_by" uuid not null,
    "role" text,
    "permissions" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."case_collaborators" enable row level security;


  create table "public"."case_events" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "title" text not null,
    "description" text,
    "event_date" date not null,
    "event_type" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."case_events" enable row level security;


  create table "public"."case_insights" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "insight_type" text not null,
    "title" text not null,
    "description" text,
    "confidence_score" numeric(3,2),
    "supporting_documents" uuid[],
    "ai_reasoning" text,
    "impact_level" text,
    "status" text default 'active'::text,
    "dismissed_reason" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."case_insights" enable row level security;


  create table "public"."case_precedents" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "precedent_id" uuid not null,
    "user_id" uuid not null,
    "relevance_score" numeric(3,2),
    "application" text,
    "supporting_or_opposing" text,
    "cited_in_documents" uuid[],
    "discovered_by" text default 'ai'::text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."case_precedents" enable row level security;


  create table "public"."client_access" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "client_email" text not null,
    "client_name" text,
    "access_code" text not null,
    "permissions" jsonb default '{"message": true, "view_updates": true, "view_documents": true}'::jsonb,
    "last_accessed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."client_interactions" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "client_name" text,
    "interaction_type" text,
    "interaction_date" date not null,
    "duration_minutes" integer,
    "sentiment" text,
    "client_satisfaction_indicator" text,
    "topics_discussed" text[] default ARRAY[]::text[],
    "action_items" text[] default ARRAY[]::text[],
    "notes" text,
    "billable" boolean default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."client_interactions" enable row level security;


  create table "public"."comments" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid,
    "document_id" uuid,
    "task_id" uuid,
    "parent_comment_id" uuid,
    "user_id" uuid not null,
    "comment_text" text not null,
    "mentions" uuid[] default ARRAY[]::uuid[],
    "attachments" jsonb default '[]'::jsonb,
    "edited" boolean default false,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."comments" enable row level security;


  create table "public"."competitive_cases" (
    "id" uuid not null default gen_random_uuid(),
    "our_case_id" uuid not null,
    "user_id" uuid not null,
    "opposing_counsel_id" uuid,
    "opposing_counsel_name" text,
    "outcome" text,
    "our_side" text,
    "outcome_favorability" text,
    "settlement_amount" numeric(12,2),
    "claimed_amount" numeric(12,2),
    "verdict_amount" numeric(12,2),
    "duration_days" integer,
    "lessons_learned" text,
    "strategies_effective" text[] default ARRAY[]::text[],
    "strategies_ineffective" text[] default ARRAY[]::text[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."competitive_cases" enable row level security;


  create table "public"."compliance_checks" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid,
    "user_id" uuid not null,
    "check_type" text not null,
    "rule_id" uuid,
    "status" text not null,
    "severity" text,
    "details" text not null,
    "remediation_steps" text[] default ARRAY[]::text[],
    "resolved" boolean default false,
    "resolved_at" timestamp with time zone,
    "resolved_by" uuid,
    "auto_generated" boolean default true,
    "checked_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."compliance_checks" enable row level security;


  create table "public"."compliance_rules" (
    "id" uuid not null default gen_random_uuid(),
    "rule_type" text,
    "jurisdiction" text not null,
    "rule_citation" text not null,
    "rule_title" text,
    "rule_text" text,
    "summary" text,
    "applies_to" text[] default ARRAY[]::text[],
    "effective_date" date not null,
    "sunset_date" date,
    "source_url" text,
    "keywords" text[] default ARRAY[]::text[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."contracts" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid,
    "user_id" uuid not null,
    "contract_type" text,
    "title" text not null,
    "parties" jsonb default '[]'::jsonb,
    "key_terms" jsonb default '{}'::jsonb,
    "contract_text" text,
    "document_id" uuid,
    "risk_score" numeric(3,1),
    "ai_review_summary" text,
    "flagged_clauses" jsonb default '[]'::jsonb,
    "missing_clauses" text[] default ARRAY[]::text[],
    "recommended_changes" text[] default ARRAY[]::text[],
    "execution_date" date,
    "expiration_date" date,
    "status" text default 'draft'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."contracts" enable row level security;


  create table "public"."deadlines" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "title" text not null,
    "description" text,
    "deadline_date" date not null,
    "deadline_time" time without time zone,
    "deadline_type" text,
    "source_document_id" uuid,
    "status" text default 'upcoming'::text,
    "notification_sent" boolean default false,
    "notification_schedule" jsonb default '[7, 3, 1]'::jsonb,
    "last_notification_sent_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "completed_by" uuid,
    "extended_to_date" date,
    "extension_reason" text,
    "priority" text default 'medium'::text,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."deadlines" enable row level security;


  create table "public"."document_relationships" (
    "id" uuid not null default gen_random_uuid(),
    "source_document_id" uuid not null,
    "target_document_id" uuid not null,
    "relationship_type" text not null,
    "confidence_score" numeric(3,2),
    "metadata" jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."document_relationships" enable row level security;


  create table "public"."embeddings" (
    "id" uuid not null default gen_random_uuid(),
    "entity_type" text not null,
    "entity_id" uuid not null,
    "user_id" uuid not null,
    "embedding" public.vector(1536),
    "model_version" text not null default 'text-embedding-3-large'::text,
    "content_hash" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."embeddings" enable row level security;


  create table "public"."entities" (
    "id" uuid not null default gen_random_uuid(),
    "entity_type" text not null,
    "name" text not null,
    "aliases" text[] default ARRAY[]::text[],
    "canonical_name" text,
    "description" text,
    "metadata" jsonb default '{}'::jsonb,
    "attributes" jsonb default '{}'::jsonb,
    "external_ids" jsonb,
    "confidence_score" numeric(3,2),
    "occurrence_count" integer default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."entity_relationships" (
    "id" uuid not null default gen_random_uuid(),
    "source_entity_id" uuid not null,
    "target_entity_id" uuid not null,
    "relationship_type" text not null,
    "context" text,
    "case_id" uuid,
    "document_id" uuid,
    "confidence_score" numeric(3,2),
    "strength" numeric(3,2),
    "valid_from" date,
    "valid_to" date,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."expertise_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "practice_area" text not null,
    "case_count" integer default 0,
    "win_rate" numeric(4,3),
    "avg_case_value" numeric(12,2),
    "avg_case_duration_days" integer,
    "specialization_score" numeric(3,2),
    "skills_identified" text[] default ARRAY[]::text[],
    "common_case_types" text[] default ARRAY[]::text[],
    "jurisdictions" text[] default ARRAY[]::text[],
    "first_case_date" date,
    "last_case_date" date,
    "total_billable_hours" numeric(10,2),
    "avg_hourly_rate" numeric(8,2),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."expertise_profiles" enable row level security;


  create table "public"."judge_patterns" (
    "id" uuid not null default gen_random_uuid(),
    "judge_id" uuid not null,
    "pattern_type" text not null,
    "case_type" text,
    "context" text,
    "metric_name" text not null,
    "metric_value" numeric,
    "metric_unit" text,
    "sample_size" integer,
    "confidence_level" numeric(3,2),
    "analysis_period_start" date,
    "analysis_period_end" date,
    "supporting_data" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."judges" (
    "id" uuid not null default gen_random_uuid(),
    "full_name" text not null,
    "court" text not null,
    "jurisdiction" text,
    "court_type" text,
    "appointment_date" date,
    "appointed_by" text,
    "biographical_info" text,
    "specialties" text[] default ARRAY[]::text[],
    "education" text,
    "prior_experience" text,
    "contact_info" jsonb,
    "external_ids" jsonb,
    "data_source" text,
    "data_quality_score" numeric(3,2),
    "last_updated" timestamp with time zone default now(),
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."legal_arguments" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "argument_type" text,
    "legal_theory" text,
    "argument_title" text not null,
    "argument_text" text not null,
    "supporting_precedents" uuid[] default ARRAY[]::uuid[],
    "supporting_facts" text[] default ARRAY[]::text[],
    "strength_score" numeric(3,1),
    "ai_generated" boolean default true,
    "reviewed" boolean default false,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "review_notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."legal_arguments" enable row level security;


  create table "public"."market_insights" (
    "id" uuid not null default gen_random_uuid(),
    "insight_type" text not null,
    "practice_area" text[] default ARRAY[]::text[],
    "jurisdiction" text,
    "title" text not null,
    "description" text,
    "impact_level" text,
    "source_url" text,
    "source_name" text,
    "insight_date" date not null,
    "relevance_score" numeric(3,2),
    "action_items" text[] default ARRAY[]::text[],
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."opposing_counsel" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "firm" text,
    "entity_id" uuid,
    "bar_number" text,
    "jurisdiction" text[] default ARRAY[]::text[],
    "practice_areas" text[] default ARRAY[]::text[],
    "win_rate" numeric(4,3),
    "case_count" integer default 0,
    "avg_settlement_ratio" numeric(4,3),
    "settlement_tendency" text,
    "common_strategies" text[] default ARRAY[]::text[],
    "negotiation_style" text,
    "strengths" text[] default ARRAY[]::text[],
    "weaknesses" text[] default ARRAY[]::text[],
    "data_source" text,
    "data_quality_score" numeric(3,2),
    "last_updated" timestamp with time zone default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."organizations" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "billing_plan" text,
    "max_users" integer default 5,
    "max_cases" integer default 100,
    "settings" jsonb default '{}'::jsonb,
    "subscription_status" text default 'active'::text,
    "subscription_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."precedents" (
    "id" uuid not null default gen_random_uuid(),
    "citation" text not null,
    "case_name" text not null,
    "court" text,
    "decision_date" date,
    "summary" text,
    "legal_issues" text[] default ARRAY[]::text[],
    "holding" text,
    "reasoning" text,
    "key_facts" text,
    "procedural_posture" text,
    "disposition" text,
    "strength_score" numeric(3,1),
    "citation_count" integer default 0,
    "overruled" boolean default false,
    "overruled_by" text,
    "distinguished_count" integer default 0,
    "followed_count" integer default 0,
    "jurisdiction" text,
    "court_level" text,
    "data_source" text,
    "external_url" text,
    "full_text" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."predictions" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "prediction_type" text not null,
    "predicted_value" text,
    "predicted_value_numeric" numeric,
    "predicted_value_category" text,
    "confidence_score" numeric(3,2),
    "confidence_interval_low" numeric,
    "confidence_interval_high" numeric,
    "probability_distribution" jsonb,
    "factors" jsonb,
    "model_version" text,
    "algorithm_used" text,
    "prediction_date" date default CURRENT_DATE,
    "valid_until" date,
    "actual_value" text,
    "actual_value_numeric" numeric,
    "actual_value_category" text,
    "accuracy_score" numeric(3,2),
    "feedback" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."predictions" enable row level security;


  create table "public"."reports" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "report_type" text not null,
    "title" text not null,
    "parameters" jsonb,
    "format" text default 'pdf'::text,
    "status" text default 'generating'::text,
    "file_path" text,
    "file_size" integer,
    "error_message" text,
    "created_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone
      );


alter table "public"."reports" enable row level security;


  create table "public"."sentiment_analyses" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" uuid not null,
    "case_id" uuid not null,
    "user_id" uuid not null,
    "overall_sentiment" text,
    "sentiment_score" numeric(4,3),
    "emotional_tone" text[] default ARRAY[]::text[],
    "key_phrases" jsonb default '[]'::jsonb,
    "concerns_flagged" text[] default ARRAY[]::text[],
    "cooperation_level" text,
    "confidence_score" numeric(3,2),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."sentiment_analyses" enable row level security;


  create table "public"."settlement_analyses" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "analysis_date" date default CURRENT_DATE,
    "recommended_range_low" numeric(12,2),
    "recommended_range_high" numeric(12,2),
    "optimal_value" numeric(12,2),
    "optimal_timing" text,
    "timing_rationale" text,
    "risk_analysis" jsonb,
    "cost_benefit_analysis" jsonb,
    "negotiation_strategy" text,
    "leverage_factors" jsonb,
    "opponent_analysis" jsonb,
    "confidence_score" numeric(3,2),
    "supporting_data" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."settlement_analyses" enable row level security;


  create table "public"."strategy_simulations" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "strategy_name" text not null,
    "strategy_description" text,
    "simulated_actions" jsonb default '[]'::jsonb,
    "decision_tree" jsonb,
    "predicted_outcome" text,
    "win_probability" numeric(4,3),
    "expected_value" numeric(12,2),
    "estimated_costs" numeric(12,2),
    "risk_level" text,
    "time_estimate_days" integer,
    "pros" text[] default ARRAY[]::text[],
    "cons" text[] default ARRAY[]::text[],
    "assumptions" text[] default ARRAY[]::text[],
    "recommended" boolean default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."strategy_simulations" enable row level security;


  create table "public"."tasks" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid,
    "user_id" uuid not null,
    "assigned_to" uuid,
    "title" text not null,
    "description" text,
    "priority" text default 'medium'::text,
    "status" text default 'pending'::text,
    "due_date" date,
    "source" text default 'manual'::text,
    "source_document_id" uuid,
    "source_deadline_id" uuid,
    "blocked_reason" text,
    "completed_at" timestamp with time zone,
    "completed_by" uuid,
    "estimated_hours" numeric(5,2),
    "actual_hours" numeric(5,2),
    "tags" text[] default ARRAY[]::text[],
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."tasks" enable row level security;


  create table "public"."team_members" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null,
    "permissions" jsonb default '{}'::jsonb,
    "invited_by" uuid,
    "invitation_accepted" boolean default false,
    "joined_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."team_members" enable row level security;


  create table "public"."witness_analyses" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid not null,
    "user_id" uuid not null,
    "witness_name" text not null,
    "entity_id" uuid,
    "role" text,
    "credibility_score" numeric(3,1),
    "inconsistencies" jsonb default '[]'::jsonb,
    "supporting_facts" jsonb default '[]'::jsonb,
    "damaging_facts" jsonb default '[]'::jsonb,
    "cross_exam_suggestions" text[] default ARRAY[]::text[],
    "deposition_summary" text,
    "key_statements" jsonb default '[]'::jsonb,
    "documents_cited" uuid[] default ARRAY[]::uuid[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."witness_analyses" enable row level security;

alter table "public"."cases" drop column "case_theory";

alter table "public"."cases" drop column "client_name";

alter table "public"."cases" drop column "key_issues";

alter table "public"."cases" drop column "name";

alter table "public"."cases" drop column "next_deadline";

alter table "public"."cases" drop column "notes";

alter table "public"."cases" drop column "representation";

alter table "public"."cases" drop column "winning_factors";

alter table "public"."cases" add column "ai_summary" text;

alter table "public"."cases" add column "case_number" text;

alter table "public"."cases" add column "court" text;

alter table "public"."cases" add column "defendant" text;

alter table "public"."cases" add column "description" text;

alter table "public"."cases" add column "filing_date" date;

alter table "public"."cases" add column "judge" text;

alter table "public"."cases" add column "judge_id" uuid;

alter table "public"."cases" add column "organization_id" uuid;

alter table "public"."cases" add column "overall_strength_score" numeric(3,1);

alter table "public"."cases" add column "plaintiff" text;

alter table "public"."cases" add column "title" text not null;

alter table "public"."cases" add column "trial_date" date;

alter table "public"."cases" add column "visibility" text default 'private'::text;

alter table "public"."cases" alter column "case_type" drop not null;

alter table "public"."cases" alter column "status" set default 'active'::text;

alter table "public"."cases" alter column "status" set data type text using "status"::text;

alter table "public"."documents" drop column "adverse_findings";

alter table "public"."documents" drop column "ai_analyzed";

alter table "public"."documents" drop column "bates_number";

alter table "public"."documents" drop column "drive_file_id";

alter table "public"."documents" drop column "drive_file_path";

alter table "public"."documents" drop column "duration_seconds";

alter table "public"."documents" drop column "favorable_findings";

alter table "public"."documents" drop column "file_url";

alter table "public"."documents" drop column "import_job_id";

alter table "public"."documents" drop column "media_type";

alter table "public"."documents" drop column "name";

alter table "public"."documents" drop column "ocr_page_count";

alter table "public"."documents" drop column "ocr_processed_at";

alter table "public"."documents" drop column "ocr_text";

alter table "public"."documents" drop column "summary";

alter table "public"."documents" drop column "transcription_processed_at";

alter table "public"."documents" drop column "transcription_text";

alter table "public"."documents" add column "ai_analysis" text;

alter table "public"."documents" add column "citations" jsonb default '[]'::jsonb;

alter table "public"."documents" add column "classification" text;

alter table "public"."documents" add column "confidence_scores" jsonb default '{}'::jsonb;

alter table "public"."documents" add column "deadlines" jsonb default '[]'::jsonb;

alter table "public"."documents" add column "document_date" date;

alter table "public"."documents" add column "document_type" text;

alter table "public"."documents" add column "entities" jsonb default '[]'::jsonb;

alter table "public"."documents" add column "extracted_text" text;

alter table "public"."documents" add column "file_path" text;

alter table "public"."documents" add column "legal_issues" jsonb default '[]'::jsonb;

alter table "public"."documents" add column "ocr_status" text default 'pending'::text;

alter table "public"."documents" add column "processed_at" timestamp with time zone;

alter table "public"."documents" add column "processing_status" text default 'pending'::text;

alter table "public"."documents" add column "strength_score" numeric(3,1);

alter table "public"."documents" add column "title" text not null;

alter table "public"."documents" alter column "action_items" set default '[]'::jsonb;

alter table "public"."documents" alter column "action_items" set data type jsonb using "action_items"::jsonb;

alter table "public"."documents" alter column "key_facts" set data type jsonb using "key_facts"::jsonb;

alter table "public"."profiles" drop column "avatar_url";

alter table "public"."profiles" drop column "firm_name";

alter table "public"."profiles" drop column "user_id";

alter table "public"."profiles" add column "email" text not null;

alter table "public"."profiles" alter column "id" drop default;

drop type "public"."case_status";

drop type "public"."representation_type";

CREATE UNIQUE INDEX agent_actions_pkey ON public.agent_actions USING btree (id);

CREATE UNIQUE INDEX agent_feedback_pkey ON public.agent_feedback USING btree (id);

CREATE UNIQUE INDEX ai_agents_pkey ON public.ai_agents USING btree (id);

CREATE UNIQUE INDEX ai_jobs_pkey ON public.ai_jobs USING btree (id);

CREATE UNIQUE INDEX ai_usage_logs_pkey ON public.ai_usage_logs USING btree (id);

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX billing_records_pkey ON public.billing_records USING btree (id);

CREATE UNIQUE INDEX case_collaborators_case_id_user_id_key ON public.case_collaborators USING btree (case_id, user_id);

CREATE UNIQUE INDEX case_collaborators_pkey ON public.case_collaborators USING btree (id);

CREATE UNIQUE INDEX case_events_pkey ON public.case_events USING btree (id);

CREATE UNIQUE INDEX case_insights_pkey ON public.case_insights USING btree (id);

CREATE UNIQUE INDEX case_precedents_case_id_precedent_id_key ON public.case_precedents USING btree (case_id, precedent_id);

CREATE UNIQUE INDEX case_precedents_pkey ON public.case_precedents USING btree (id);

CREATE UNIQUE INDEX client_access_access_code_key ON public.client_access USING btree (access_code);

CREATE UNIQUE INDEX client_access_pkey ON public.client_access USING btree (id);

CREATE UNIQUE INDEX client_interactions_pkey ON public.client_interactions USING btree (id);

CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);

CREATE UNIQUE INDEX competitive_cases_pkey ON public.competitive_cases USING btree (id);

CREATE UNIQUE INDEX compliance_checks_pkey ON public.compliance_checks USING btree (id);

CREATE UNIQUE INDEX compliance_rules_jurisdiction_rule_citation_key ON public.compliance_rules USING btree (jurisdiction, rule_citation);

CREATE UNIQUE INDEX compliance_rules_pkey ON public.compliance_rules USING btree (id);

CREATE UNIQUE INDEX contracts_pkey ON public.contracts USING btree (id);

CREATE UNIQUE INDEX deadlines_pkey ON public.deadlines USING btree (id);

CREATE UNIQUE INDEX document_relationships_pkey ON public.document_relationships USING btree (id);

CREATE UNIQUE INDEX document_relationships_source_document_id_target_document_i_key ON public.document_relationships USING btree (source_document_id, target_document_id, relationship_type);

CREATE UNIQUE INDEX embeddings_entity_type_entity_id_key ON public.embeddings USING btree (entity_type, entity_id);

CREATE UNIQUE INDEX embeddings_pkey ON public.embeddings USING btree (id);

CREATE UNIQUE INDEX entities_entity_type_canonical_name_key ON public.entities USING btree (entity_type, canonical_name);

CREATE UNIQUE INDEX entities_pkey ON public.entities USING btree (id);

CREATE UNIQUE INDEX entity_relationships_pkey ON public.entity_relationships USING btree (id);

CREATE UNIQUE INDEX expertise_profiles_pkey ON public.expertise_profiles USING btree (id);

CREATE UNIQUE INDEX expertise_profiles_user_id_practice_area_key ON public.expertise_profiles USING btree (user_id, practice_area);

CREATE INDEX idx_agent_actions_agent ON public.agent_actions USING btree (agent_id, created_at DESC);

CREATE INDEX idx_agent_actions_case ON public.agent_actions USING btree (case_id) WHERE (case_id IS NOT NULL);

CREATE INDEX idx_agent_actions_review ON public.agent_actions USING btree (requires_review, reviewed_at) WHERE (requires_review = true);

CREATE INDEX idx_agent_actions_type ON public.agent_actions USING btree (action_type);

CREATE INDEX idx_agent_feedback_agent ON public.agent_feedback USING btree (agent_id, created_at DESC);

CREATE INDEX idx_agent_feedback_type ON public.agent_feedback USING btree (feedback_type);

CREATE INDEX idx_agent_feedback_user ON public.agent_feedback USING btree (user_id);

CREATE INDEX idx_ai_agents_next_run ON public.ai_agents USING btree (next_run_at) WHERE ((status = 'active'::text) AND (next_run_at IS NOT NULL));

CREATE INDEX idx_ai_agents_type ON public.ai_agents USING btree (agent_type, status);

CREATE INDEX idx_ai_agents_user ON public.ai_agents USING btree (user_id);

CREATE INDEX idx_ai_jobs_created_at ON public.ai_jobs USING btree (created_at DESC);

CREATE INDEX idx_ai_jobs_pending ON public.ai_jobs USING btree (priority DESC, created_at) WHERE (status = 'pending'::text);

CREATE INDEX idx_ai_jobs_type_status ON public.ai_jobs USING btree (job_type, status);

CREATE INDEX idx_ai_jobs_user_status ON public.ai_jobs USING btree (user_id, status);

CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs USING btree (created_at DESC);

CREATE INDEX idx_ai_usage_logs_service ON public.ai_usage_logs USING btree (service, created_at DESC);

CREATE INDEX idx_ai_usage_logs_user ON public.ai_usage_logs USING btree (user_id, created_at DESC);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id, created_at DESC);

CREATE INDEX idx_billing_case ON public.billing_records USING btree (case_id, billing_date DESC);

CREATE INDEX idx_billing_date ON public.billing_records USING btree (billing_date DESC);

CREATE INDEX idx_billing_invoiced ON public.billing_records USING btree (invoiced, paid);

CREATE INDEX idx_billing_user ON public.billing_records USING btree (user_id, billing_date DESC);

CREATE INDEX idx_case_collaborators_case ON public.case_collaborators USING btree (case_id);

CREATE INDEX idx_case_collaborators_user ON public.case_collaborators USING btree (user_id);

CREATE INDEX idx_case_insights_case ON public.case_insights USING btree (case_id, status);

CREATE INDEX idx_case_insights_type ON public.case_insights USING btree (insight_type);

CREATE INDEX idx_case_insights_user ON public.case_insights USING btree (user_id, created_at DESC);

CREATE INDEX idx_case_precedents_case ON public.case_precedents USING btree (case_id, relevance_score DESC);

CREATE INDEX idx_case_precedents_precedent ON public.case_precedents USING btree (precedent_id);

CREATE INDEX idx_case_precedents_user ON public.case_precedents USING btree (user_id);

CREATE INDEX idx_cases_judge ON public.cases USING btree (judge_id) WHERE (judge_id IS NOT NULL);

CREATE INDEX idx_cases_organization ON public.cases USING btree (organization_id) WHERE (organization_id IS NOT NULL);

CREATE INDEX idx_cases_visibility ON public.cases USING btree (visibility);

CREATE INDEX idx_client_access_case ON public.client_access USING btree (case_id);

CREATE INDEX idx_client_access_code ON public.client_access USING btree (access_code);

CREATE INDEX idx_client_access_email ON public.client_access USING btree (client_email);

CREATE INDEX idx_client_interactions_case ON public.client_interactions USING btree (case_id, interaction_date DESC);

CREATE INDEX idx_client_interactions_date ON public.client_interactions USING btree (interaction_date DESC);

CREATE INDEX idx_client_interactions_satisfaction ON public.client_interactions USING btree (client_satisfaction_indicator);

CREATE INDEX idx_client_interactions_user ON public.client_interactions USING btree (user_id);

CREATE INDEX idx_comments_case ON public.comments USING btree (case_id) WHERE (case_id IS NOT NULL);

CREATE INDEX idx_comments_document ON public.comments USING btree (document_id) WHERE (document_id IS NOT NULL);

CREATE INDEX idx_comments_parent ON public.comments USING btree (parent_comment_id) WHERE (parent_comment_id IS NOT NULL);

CREATE INDEX idx_comments_task ON public.comments USING btree (task_id) WHERE (task_id IS NOT NULL);

CREATE INDEX idx_comments_user ON public.comments USING btree (user_id);

CREATE INDEX idx_competitive_cases_opposing ON public.competitive_cases USING btree (opposing_counsel_id);

CREATE INDEX idx_competitive_cases_our_case ON public.competitive_cases USING btree (our_case_id);

CREATE INDEX idx_competitive_cases_outcome ON public.competitive_cases USING btree (outcome);

CREATE INDEX idx_competitive_cases_user ON public.competitive_cases USING btree (user_id);

CREATE INDEX idx_compliance_checks_case ON public.compliance_checks USING btree (case_id);

CREATE INDEX idx_compliance_checks_status ON public.compliance_checks USING btree (status, severity);

CREATE INDEX idx_compliance_checks_unresolved ON public.compliance_checks USING btree (resolved) WHERE (resolved = false);

CREATE INDEX idx_compliance_checks_user ON public.compliance_checks USING btree (user_id);

CREATE INDEX idx_compliance_rules_effective ON public.compliance_rules USING btree (effective_date);

CREATE INDEX idx_compliance_rules_jurisdiction ON public.compliance_rules USING btree (jurisdiction);

CREATE INDEX idx_compliance_rules_keywords ON public.compliance_rules USING gin (keywords);

CREATE INDEX idx_compliance_rules_type ON public.compliance_rules USING btree (rule_type);

CREATE INDEX idx_contracts_case ON public.contracts USING btree (case_id);

CREATE INDEX idx_contracts_status ON public.contracts USING btree (status);

CREATE INDEX idx_contracts_type ON public.contracts USING btree (contract_type);

CREATE INDEX idx_contracts_user ON public.contracts USING btree (user_id);

CREATE INDEX idx_deadlines_case ON public.deadlines USING btree (case_id, status);

CREATE INDEX idx_deadlines_date ON public.deadlines USING btree (deadline_date) WHERE (status = 'upcoming'::text);

CREATE INDEX idx_deadlines_upcoming ON public.deadlines USING btree (status, deadline_date) WHERE (status = 'upcoming'::text);

CREATE INDEX idx_deadlines_user ON public.deadlines USING btree (user_id, deadline_date);

CREATE INDEX idx_document_rel_source ON public.document_relationships USING btree (source_document_id);

CREATE INDEX idx_document_rel_target ON public.document_relationships USING btree (target_document_id);

CREATE INDEX idx_document_rel_type ON public.document_relationships USING btree (relationship_type);

CREATE INDEX idx_documents_classification ON public.documents USING btree (classification) WHERE (classification IS NOT NULL);

CREATE INDEX idx_documents_ocr_status ON public.documents USING btree (ocr_status);

CREATE INDEX idx_documents_processing_status ON public.documents USING btree (processing_status);

CREATE INDEX idx_documents_text_search ON public.documents USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(extracted_text, ''::text))));

CREATE INDEX idx_embeddings_entity ON public.embeddings USING btree (entity_type, entity_id);

CREATE INDEX idx_embeddings_user ON public.embeddings USING btree (user_id);

CREATE INDEX idx_embeddings_vector ON public.embeddings USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');

CREATE INDEX idx_entities_aliases ON public.entities USING gin (aliases);

CREATE INDEX idx_entities_canonical ON public.entities USING btree (canonical_name);

CREATE INDEX idx_entities_fts ON public.entities USING gin (to_tsvector('english'::regconfig, ((name || ' '::text) || COALESCE(description, ''::text))));

CREATE INDEX idx_entities_name ON public.entities USING btree (name);

CREATE INDEX idx_entities_occurrence ON public.entities USING btree (occurrence_count DESC);

CREATE INDEX idx_entities_type ON public.entities USING btree (entity_type);

CREATE INDEX idx_entity_rel_case ON public.entity_relationships USING btree (case_id) WHERE (case_id IS NOT NULL);

CREATE INDEX idx_entity_rel_document ON public.entity_relationships USING btree (document_id) WHERE (document_id IS NOT NULL);

CREATE INDEX idx_entity_rel_source ON public.entity_relationships USING btree (source_entity_id);

CREATE INDEX idx_entity_rel_target ON public.entity_relationships USING btree (target_entity_id);

CREATE INDEX idx_entity_rel_type ON public.entity_relationships USING btree (relationship_type);

CREATE INDEX idx_expertise_area ON public.expertise_profiles USING btree (practice_area);

CREATE INDEX idx_expertise_specialization ON public.expertise_profiles USING btree (specialization_score DESC);

CREATE INDEX idx_expertise_user ON public.expertise_profiles USING btree (user_id);

CREATE INDEX idx_judge_patterns_judge ON public.judge_patterns USING btree (judge_id, pattern_type);

CREATE INDEX idx_judge_patterns_type ON public.judge_patterns USING btree (pattern_type, case_type);

CREATE INDEX idx_judge_patterns_updated ON public.judge_patterns USING btree (updated_at DESC);

CREATE INDEX idx_judges_court ON public.judges USING btree (court);

CREATE INDEX idx_judges_jurisdiction ON public.judges USING btree (jurisdiction);

CREATE INDEX idx_judges_name ON public.judges USING btree (full_name);

CREATE INDEX idx_judges_specialties ON public.judges USING gin (specialties);

CREATE INDEX idx_legal_arguments_case ON public.legal_arguments USING btree (case_id);

CREATE INDEX idx_legal_arguments_reviewed ON public.legal_arguments USING btree (reviewed, ai_generated);

CREATE INDEX idx_legal_arguments_type ON public.legal_arguments USING btree (argument_type);

CREATE INDEX idx_legal_arguments_user ON public.legal_arguments USING btree (user_id);

CREATE INDEX idx_market_insights_date ON public.market_insights USING btree (insight_date DESC);

CREATE INDEX idx_market_insights_impact ON public.market_insights USING btree (impact_level);

CREATE INDEX idx_market_insights_practice ON public.market_insights USING gin (practice_area);

CREATE INDEX idx_market_insights_type ON public.market_insights USING btree (insight_type);

CREATE INDEX idx_opposing_counsel_entity ON public.opposing_counsel USING btree (entity_id) WHERE (entity_id IS NOT NULL);

CREATE INDEX idx_opposing_counsel_firm ON public.opposing_counsel USING btree (firm);

CREATE INDEX idx_opposing_counsel_name ON public.opposing_counsel USING btree (name);

CREATE INDEX idx_opposing_counsel_practice ON public.opposing_counsel USING gin (practice_areas);

CREATE INDEX idx_organizations_billing ON public.organizations USING btree (billing_plan);

CREATE INDEX idx_organizations_name ON public.organizations USING btree (name);

CREATE INDEX idx_precedents_citation ON public.precedents USING btree (citation);

CREATE INDEX idx_precedents_court ON public.precedents USING btree (court);

CREATE INDEX idx_precedents_date ON public.precedents USING btree (decision_date DESC);

CREATE INDEX idx_precedents_fts ON public.precedents USING gin (to_tsvector('english'::regconfig, ((((case_name || ' '::text) || COALESCE(summary, ''::text)) || ' '::text) || COALESCE(holding, ''::text))));

CREATE INDEX idx_precedents_issues ON public.precedents USING gin (legal_issues);

CREATE INDEX idx_precedents_jurisdiction ON public.precedents USING btree (jurisdiction);

CREATE INDEX idx_precedents_strength ON public.precedents USING btree (strength_score DESC);

CREATE INDEX idx_predictions_case ON public.predictions USING btree (case_id, prediction_type);

CREATE INDEX idx_predictions_date ON public.predictions USING btree (prediction_date DESC);

CREATE INDEX idx_predictions_type ON public.predictions USING btree (prediction_type);

CREATE INDEX idx_predictions_user ON public.predictions USING btree (user_id, created_at DESC);

CREATE INDEX idx_reports_status ON public.reports USING btree (status);

CREATE INDEX idx_reports_user ON public.reports USING btree (user_id, created_at DESC);

CREATE INDEX idx_sentiment_case ON public.sentiment_analyses USING btree (case_id);

CREATE INDEX idx_sentiment_document ON public.sentiment_analyses USING btree (document_id);

CREATE INDEX idx_sentiment_overall ON public.sentiment_analyses USING btree (overall_sentiment);

CREATE INDEX idx_sentiment_user ON public.sentiment_analyses USING btree (user_id);

CREATE INDEX idx_settlement_analyses_case ON public.settlement_analyses USING btree (case_id);

CREATE INDEX idx_settlement_analyses_user ON public.settlement_analyses USING btree (user_id, analysis_date DESC);

CREATE INDEX idx_strategy_simulations_case ON public.strategy_simulations USING btree (case_id);

CREATE INDEX idx_strategy_simulations_recommended ON public.strategy_simulations USING btree (recommended);

CREATE INDEX idx_strategy_simulations_user ON public.strategy_simulations USING btree (user_id);

CREATE INDEX idx_tasks_assigned ON public.tasks USING btree (assigned_to, status) WHERE (assigned_to IS NOT NULL);

CREATE INDEX idx_tasks_case ON public.tasks USING btree (case_id, status);

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date) WHERE ((due_date IS NOT NULL) AND (status <> 'completed'::text));

CREATE INDEX idx_tasks_priority ON public.tasks USING btree (priority, due_date);

CREATE INDEX idx_tasks_user ON public.tasks USING btree (user_id, status);

CREATE INDEX idx_team_members_org ON public.team_members USING btree (organization_id);

CREATE INDEX idx_team_members_role ON public.team_members USING btree (role);

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);

CREATE INDEX idx_witness_case ON public.witness_analyses USING btree (case_id);

CREATE INDEX idx_witness_entity ON public.witness_analyses USING btree (entity_id) WHERE (entity_id IS NOT NULL);

CREATE INDEX idx_witness_name ON public.witness_analyses USING btree (witness_name);

CREATE INDEX idx_witness_user ON public.witness_analyses USING btree (user_id);

CREATE UNIQUE INDEX judge_patterns_pkey ON public.judge_patterns USING btree (id);

CREATE UNIQUE INDEX judges_full_name_court_key ON public.judges USING btree (full_name, court);

CREATE UNIQUE INDEX judges_pkey ON public.judges USING btree (id);

CREATE UNIQUE INDEX legal_arguments_pkey ON public.legal_arguments USING btree (id);

CREATE UNIQUE INDEX market_insights_pkey ON public.market_insights USING btree (id);

CREATE UNIQUE INDEX opposing_counsel_name_firm_key ON public.opposing_counsel USING btree (name, firm);

CREATE UNIQUE INDEX opposing_counsel_pkey ON public.opposing_counsel USING btree (id);

CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);

CREATE UNIQUE INDEX precedents_citation_key ON public.precedents USING btree (citation);

CREATE UNIQUE INDEX precedents_pkey ON public.precedents USING btree (id);

CREATE UNIQUE INDEX predictions_pkey ON public.predictions USING btree (id);

CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id);

CREATE UNIQUE INDEX sentiment_analyses_pkey ON public.sentiment_analyses USING btree (id);

CREATE UNIQUE INDEX settlement_analyses_pkey ON public.settlement_analyses USING btree (id);

CREATE UNIQUE INDEX strategy_simulations_pkey ON public.strategy_simulations USING btree (id);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX team_members_organization_id_user_id_key ON public.team_members USING btree (organization_id, user_id);

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);

CREATE UNIQUE INDEX witness_analyses_pkey ON public.witness_analyses USING btree (id);

alter table "public"."agent_actions" add constraint "agent_actions_pkey" PRIMARY KEY using index "agent_actions_pkey";

alter table "public"."agent_feedback" add constraint "agent_feedback_pkey" PRIMARY KEY using index "agent_feedback_pkey";

alter table "public"."ai_agents" add constraint "ai_agents_pkey" PRIMARY KEY using index "ai_agents_pkey";

alter table "public"."ai_jobs" add constraint "ai_jobs_pkey" PRIMARY KEY using index "ai_jobs_pkey";

alter table "public"."ai_usage_logs" add constraint "ai_usage_logs_pkey" PRIMARY KEY using index "ai_usage_logs_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."billing_records" add constraint "billing_records_pkey" PRIMARY KEY using index "billing_records_pkey";

alter table "public"."case_collaborators" add constraint "case_collaborators_pkey" PRIMARY KEY using index "case_collaborators_pkey";

alter table "public"."case_events" add constraint "case_events_pkey" PRIMARY KEY using index "case_events_pkey";

alter table "public"."case_insights" add constraint "case_insights_pkey" PRIMARY KEY using index "case_insights_pkey";

alter table "public"."case_precedents" add constraint "case_precedents_pkey" PRIMARY KEY using index "case_precedents_pkey";

alter table "public"."client_access" add constraint "client_access_pkey" PRIMARY KEY using index "client_access_pkey";

alter table "public"."client_interactions" add constraint "client_interactions_pkey" PRIMARY KEY using index "client_interactions_pkey";

alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY using index "comments_pkey";

alter table "public"."competitive_cases" add constraint "competitive_cases_pkey" PRIMARY KEY using index "competitive_cases_pkey";

alter table "public"."compliance_checks" add constraint "compliance_checks_pkey" PRIMARY KEY using index "compliance_checks_pkey";

alter table "public"."compliance_rules" add constraint "compliance_rules_pkey" PRIMARY KEY using index "compliance_rules_pkey";

alter table "public"."contracts" add constraint "contracts_pkey" PRIMARY KEY using index "contracts_pkey";

alter table "public"."deadlines" add constraint "deadlines_pkey" PRIMARY KEY using index "deadlines_pkey";

alter table "public"."document_relationships" add constraint "document_relationships_pkey" PRIMARY KEY using index "document_relationships_pkey";

alter table "public"."embeddings" add constraint "embeddings_pkey" PRIMARY KEY using index "embeddings_pkey";

alter table "public"."entities" add constraint "entities_pkey" PRIMARY KEY using index "entities_pkey";

alter table "public"."entity_relationships" add constraint "entity_relationships_pkey" PRIMARY KEY using index "entity_relationships_pkey";

alter table "public"."expertise_profiles" add constraint "expertise_profiles_pkey" PRIMARY KEY using index "expertise_profiles_pkey";

alter table "public"."judge_patterns" add constraint "judge_patterns_pkey" PRIMARY KEY using index "judge_patterns_pkey";

alter table "public"."judges" add constraint "judges_pkey" PRIMARY KEY using index "judges_pkey";

alter table "public"."legal_arguments" add constraint "legal_arguments_pkey" PRIMARY KEY using index "legal_arguments_pkey";

alter table "public"."market_insights" add constraint "market_insights_pkey" PRIMARY KEY using index "market_insights_pkey";

alter table "public"."opposing_counsel" add constraint "opposing_counsel_pkey" PRIMARY KEY using index "opposing_counsel_pkey";

alter table "public"."organizations" add constraint "organizations_pkey" PRIMARY KEY using index "organizations_pkey";

alter table "public"."precedents" add constraint "precedents_pkey" PRIMARY KEY using index "precedents_pkey";

alter table "public"."predictions" add constraint "predictions_pkey" PRIMARY KEY using index "predictions_pkey";

alter table "public"."reports" add constraint "reports_pkey" PRIMARY KEY using index "reports_pkey";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_pkey" PRIMARY KEY using index "sentiment_analyses_pkey";

alter table "public"."settlement_analyses" add constraint "settlement_analyses_pkey" PRIMARY KEY using index "settlement_analyses_pkey";

alter table "public"."strategy_simulations" add constraint "strategy_simulations_pkey" PRIMARY KEY using index "strategy_simulations_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."team_members" add constraint "team_members_pkey" PRIMARY KEY using index "team_members_pkey";

alter table "public"."witness_analyses" add constraint "witness_analyses_pkey" PRIMARY KEY using index "witness_analyses_pkey";

alter table "public"."agent_actions" add constraint "agent_actions_action_type_check" CHECK ((action_type = ANY (ARRAY['task_created'::text, 'deadline_flagged'::text, 'document_reviewed'::text, 'conflict_detected'::text, 'research_completed'::text, 'redaction_suggested'::text, 'citation_validated'::text, 'completeness_checked'::text, 'priority_adjusted'::text, 'escalation_triggered'::text]))) not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_action_type_check";

alter table "public"."agent_actions" add constraint "agent_actions_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE CASCADE not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_agent_id_fkey";

alter table "public"."agent_actions" add constraint "agent_actions_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_case_id_fkey";

alter table "public"."agent_actions" add constraint "agent_actions_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))) not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_confidence_score_check";

alter table "public"."agent_actions" add constraint "agent_actions_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_document_id_fkey";

alter table "public"."agent_actions" add constraint "agent_actions_impact_level_check" CHECK ((impact_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_impact_level_check";

alter table "public"."agent_actions" add constraint "agent_actions_review_decision_check" CHECK ((review_decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'modified'::text]))) not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_review_decision_check";

alter table "public"."agent_actions" add constraint "agent_actions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."agent_actions" validate constraint "agent_actions_reviewed_by_fkey";

alter table "public"."agent_feedback" add constraint "agent_feedback_action_id_fkey" FOREIGN KEY (action_id) REFERENCES public.agent_actions(id) ON DELETE CASCADE not valid;

alter table "public"."agent_feedback" validate constraint "agent_feedback_action_id_fkey";

alter table "public"."agent_feedback" add constraint "agent_feedback_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE CASCADE not valid;

alter table "public"."agent_feedback" validate constraint "agent_feedback_agent_id_fkey";

alter table "public"."agent_feedback" add constraint "agent_feedback_feedback_type_check" CHECK ((feedback_type = ANY (ARRAY['positive'::text, 'negative'::text, 'correction'::text, 'suggestion'::text]))) not valid;

alter table "public"."agent_feedback" validate constraint "agent_feedback_feedback_type_check";

alter table "public"."agent_feedback" add constraint "agent_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."agent_feedback" validate constraint "agent_feedback_user_id_fkey";

alter table "public"."ai_agents" add constraint "ai_agents_agent_type_check" CHECK ((agent_type = ANY (ARRAY['document_review'::text, 'deadline'::text, 'task_orchestration'::text, 'research'::text, 'compliance'::text, 'billing'::text]))) not valid;

alter table "public"."ai_agents" validate constraint "ai_agents_agent_type_check";

alter table "public"."ai_agents" add constraint "ai_agents_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text]))) not valid;

alter table "public"."ai_agents" validate constraint "ai_agents_status_check";

alter table "public"."ai_agents" add constraint "ai_agents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_agents" validate constraint "ai_agents_user_id_fkey";

alter table "public"."ai_jobs" add constraint "ai_jobs_job_type_check" CHECK ((job_type = ANY (ARRAY['document_analysis'::text, 'generate_embeddings'::text, 'predict_outcome'::text, 'extract_entities'::text, 'generate_summary'::text, 'sentiment_analysis'::text, 'deadline_extraction'::text]))) not valid;

alter table "public"."ai_jobs" validate constraint "ai_jobs_job_type_check";

alter table "public"."ai_jobs" add constraint "ai_jobs_priority_check" CHECK (((priority >= 1) AND (priority <= 10))) not valid;

alter table "public"."ai_jobs" validate constraint "ai_jobs_priority_check";

alter table "public"."ai_jobs" add constraint "ai_jobs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."ai_jobs" validate constraint "ai_jobs_status_check";

alter table "public"."ai_jobs" add constraint "ai_jobs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_jobs" validate constraint "ai_jobs_user_id_fkey";

alter table "public"."ai_usage_logs" add constraint "ai_usage_logs_service_check" CHECK ((service = ANY (ARRAY['claude'::text, 'openai'::text, 'other'::text]))) not valid;

alter table "public"."ai_usage_logs" validate constraint "ai_usage_logs_service_check";

alter table "public"."ai_usage_logs" add constraint "ai_usage_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ai_usage_logs" validate constraint "ai_usage_logs_user_id_fkey";

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

alter table "public"."billing_records" add constraint "billing_records_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."billing_records" validate constraint "billing_records_case_id_fkey";

alter table "public"."billing_records" add constraint "billing_records_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."billing_records" validate constraint "billing_records_user_id_fkey";

alter table "public"."case_collaborators" add constraint "case_collaborators_added_by_fkey" FOREIGN KEY (added_by) REFERENCES auth.users(id) not valid;

alter table "public"."case_collaborators" validate constraint "case_collaborators_added_by_fkey";

alter table "public"."case_collaborators" add constraint "case_collaborators_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."case_collaborators" validate constraint "case_collaborators_case_id_fkey";

alter table "public"."case_collaborators" add constraint "case_collaborators_case_id_user_id_key" UNIQUE using index "case_collaborators_case_id_user_id_key";

alter table "public"."case_collaborators" add constraint "case_collaborators_role_check" CHECK ((role = ANY (ARRAY['viewer'::text, 'editor'::text, 'admin'::text]))) not valid;

alter table "public"."case_collaborators" validate constraint "case_collaborators_role_check";

alter table "public"."case_collaborators" add constraint "case_collaborators_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."case_collaborators" validate constraint "case_collaborators_user_id_fkey";

alter table "public"."case_events" add constraint "case_events_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."case_events" validate constraint "case_events_case_id_fkey";

alter table "public"."case_events" add constraint "case_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."case_events" validate constraint "case_events_user_id_fkey";

alter table "public"."case_insights" add constraint "case_insights_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."case_insights" validate constraint "case_insights_case_id_fkey";

alter table "public"."case_insights" add constraint "case_insights_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))) not valid;

alter table "public"."case_insights" validate constraint "case_insights_confidence_score_check";

alter table "public"."case_insights" add constraint "case_insights_impact_level_check" CHECK ((impact_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."case_insights" validate constraint "case_insights_impact_level_check";

alter table "public"."case_insights" add constraint "case_insights_insight_type_check" CHECK ((insight_type = ANY (ARRAY['strength_analysis'::text, 'risk_assessment'::text, 'strategy_suggestion'::text, 'weakness_identified'::text, 'opportunity_identified'::text, 'timeline_analysis'::text, 'cost_projection'::text]))) not valid;

alter table "public"."case_insights" validate constraint "case_insights_insight_type_check";

alter table "public"."case_insights" add constraint "case_insights_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'dismissed'::text, 'implemented'::text, 'superseded'::text]))) not valid;

alter table "public"."case_insights" validate constraint "case_insights_status_check";

alter table "public"."case_insights" add constraint "case_insights_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."case_insights" validate constraint "case_insights_user_id_fkey";

alter table "public"."case_precedents" add constraint "case_precedents_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."case_precedents" validate constraint "case_precedents_case_id_fkey";

alter table "public"."case_precedents" add constraint "case_precedents_case_id_precedent_id_key" UNIQUE using index "case_precedents_case_id_precedent_id_key";

alter table "public"."case_precedents" add constraint "case_precedents_discovered_by_check" CHECK ((discovered_by = ANY (ARRAY['ai'::text, 'manual'::text, 'research'::text]))) not valid;

alter table "public"."case_precedents" validate constraint "case_precedents_discovered_by_check";

alter table "public"."case_precedents" add constraint "case_precedents_precedent_id_fkey" FOREIGN KEY (precedent_id) REFERENCES public.precedents(id) ON DELETE CASCADE not valid;

alter table "public"."case_precedents" validate constraint "case_precedents_precedent_id_fkey";

alter table "public"."case_precedents" add constraint "case_precedents_relevance_score_check" CHECK (((relevance_score >= (0)::numeric) AND (relevance_score <= (1)::numeric))) not valid;

alter table "public"."case_precedents" validate constraint "case_precedents_relevance_score_check";

alter table "public"."case_precedents" add constraint "case_precedents_supporting_or_opposing_check" CHECK ((supporting_or_opposing = ANY (ARRAY['supporting'::text, 'opposing'::text, 'neutral'::text, 'distinguishable'::text]))) not valid;

alter table "public"."case_precedents" validate constraint "case_precedents_supporting_or_opposing_check";

alter table "public"."case_precedents" add constraint "case_precedents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."case_precedents" validate constraint "case_precedents_user_id_fkey";

alter table "public"."cases" add constraint "cases_judge_id_fkey" FOREIGN KEY (judge_id) REFERENCES public.judges(id) ON DELETE SET NULL not valid;

alter table "public"."cases" validate constraint "cases_judge_id_fkey";

alter table "public"."cases" add constraint "cases_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL not valid;

alter table "public"."cases" validate constraint "cases_organization_id_fkey";

alter table "public"."cases" add constraint "cases_overall_strength_score_check" CHECK (((overall_strength_score >= (0)::numeric) AND (overall_strength_score <= (10)::numeric))) not valid;

alter table "public"."cases" validate constraint "cases_overall_strength_score_check";

alter table "public"."cases" add constraint "cases_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text, 'pending'::text, 'archived'::text]))) not valid;

alter table "public"."cases" validate constraint "cases_status_check";

alter table "public"."cases" add constraint "cases_visibility_check" CHECK ((visibility = ANY (ARRAY['private'::text, 'team'::text, 'organization'::text, 'client'::text]))) not valid;

alter table "public"."cases" validate constraint "cases_visibility_check";

alter table "public"."client_access" add constraint "client_access_access_code_key" UNIQUE using index "client_access_access_code_key";

alter table "public"."client_access" add constraint "client_access_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."client_access" validate constraint "client_access_case_id_fkey";

alter table "public"."client_access" add constraint "client_access_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."client_access" validate constraint "client_access_created_by_fkey";

alter table "public"."client_interactions" add constraint "client_interactions_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."client_interactions" validate constraint "client_interactions_case_id_fkey";

alter table "public"."client_interactions" add constraint "client_interactions_client_satisfaction_indicator_check" CHECK ((client_satisfaction_indicator = ANY (ARRAY['satisfied'::text, 'neutral'::text, 'concerned'::text, 'at_risk'::text, 'escalated'::text]))) not valid;

alter table "public"."client_interactions" validate constraint "client_interactions_client_satisfaction_indicator_check";

alter table "public"."client_interactions" add constraint "client_interactions_interaction_type_check" CHECK ((interaction_type = ANY (ARRAY['email'::text, 'call'::text, 'meeting'::text, 'document_shared'::text, 'message'::text, 'billing_discussion'::text]))) not valid;

alter table "public"."client_interactions" validate constraint "client_interactions_interaction_type_check";

alter table "public"."client_interactions" add constraint "client_interactions_sentiment_check" CHECK ((sentiment = ANY (ARRAY['very_positive'::text, 'positive'::text, 'neutral'::text, 'negative'::text, 'very_negative'::text]))) not valid;

alter table "public"."client_interactions" validate constraint "client_interactions_sentiment_check";

alter table "public"."client_interactions" add constraint "client_interactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."client_interactions" validate constraint "client_interactions_user_id_fkey";

alter table "public"."comments" add constraint "comments_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_case_id_fkey";

alter table "public"."comments" add constraint "comments_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_document_id_fkey";

alter table "public"."comments" add constraint "comments_parent_comment_id_fkey" FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_parent_comment_id_fkey";

alter table "public"."comments" add constraint "comments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_task_id_fkey";

alter table "public"."comments" add constraint "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_user_id_fkey";

alter table "public"."competitive_cases" add constraint "competitive_cases_opposing_counsel_id_fkey" FOREIGN KEY (opposing_counsel_id) REFERENCES public.opposing_counsel(id) not valid;

alter table "public"."competitive_cases" validate constraint "competitive_cases_opposing_counsel_id_fkey";

alter table "public"."competitive_cases" add constraint "competitive_cases_our_case_id_fkey" FOREIGN KEY (our_case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."competitive_cases" validate constraint "competitive_cases_our_case_id_fkey";

alter table "public"."competitive_cases" add constraint "competitive_cases_our_side_check" CHECK ((our_side = ANY (ARRAY['plaintiff'::text, 'defendant'::text, 'appellant'::text, 'respondent'::text]))) not valid;

alter table "public"."competitive_cases" validate constraint "competitive_cases_our_side_check";

alter table "public"."competitive_cases" add constraint "competitive_cases_outcome_check" CHECK ((outcome = ANY (ARRAY['won'::text, 'lost'::text, 'settled'::text, 'dismissed'::text, 'ongoing'::text]))) not valid;

alter table "public"."competitive_cases" validate constraint "competitive_cases_outcome_check";

alter table "public"."competitive_cases" add constraint "competitive_cases_outcome_favorability_check" CHECK ((outcome_favorability = ANY (ARRAY['very_favorable'::text, 'favorable'::text, 'neutral'::text, 'unfavorable'::text, 'very_unfavorable'::text]))) not valid;

alter table "public"."competitive_cases" validate constraint "competitive_cases_outcome_favorability_check";

alter table "public"."competitive_cases" add constraint "competitive_cases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."competitive_cases" validate constraint "competitive_cases_user_id_fkey";

alter table "public"."compliance_checks" add constraint "compliance_checks_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_case_id_fkey";

alter table "public"."compliance_checks" add constraint "compliance_checks_check_type_check" CHECK ((check_type = ANY (ARRAY['conflict_check'::text, 'deadline_check'::text, 'ethics_review'::text, 'documentation_check'::text, 'fee_agreement'::text, 'trust_accounting'::text, 'statute_limitations'::text, 'engagement_letter'::text]))) not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_check_type_check";

alter table "public"."compliance_checks" add constraint "compliance_checks_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_resolved_by_fkey";

alter table "public"."compliance_checks" add constraint "compliance_checks_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES public.compliance_rules(id) not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_rule_id_fkey";

alter table "public"."compliance_checks" add constraint "compliance_checks_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_severity_check";

alter table "public"."compliance_checks" add constraint "compliance_checks_status_check" CHECK ((status = ANY (ARRAY['compliant'::text, 'warning'::text, 'violation'::text, 'needs_review'::text]))) not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_status_check";

alter table "public"."compliance_checks" add constraint "compliance_checks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."compliance_checks" validate constraint "compliance_checks_user_id_fkey";

alter table "public"."compliance_rules" add constraint "compliance_rules_jurisdiction_rule_citation_key" UNIQUE using index "compliance_rules_jurisdiction_rule_citation_key";

alter table "public"."compliance_rules" add constraint "compliance_rules_rule_type_check" CHECK ((rule_type = ANY (ARRAY['ethics'::text, 'procedural'::text, 'regulatory'::text, 'bar_rules'::text, 'court_rules'::text]))) not valid;

alter table "public"."compliance_rules" validate constraint "compliance_rules_rule_type_check";

alter table "public"."contracts" add constraint "contracts_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."contracts" validate constraint "contracts_case_id_fkey";

alter table "public"."contracts" add constraint "contracts_contract_type_check" CHECK ((contract_type = ANY (ARRAY['engagement_letter'::text, 'settlement_agreement'::text, 'employment'::text, 'purchase_sale'::text, 'lease'::text, 'nda'::text, 'service_agreement'::text, 'licensing'::text, 'partnership'::text, 'other'::text]))) not valid;

alter table "public"."contracts" validate constraint "contracts_contract_type_check";

alter table "public"."contracts" add constraint "contracts_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id) not valid;

alter table "public"."contracts" validate constraint "contracts_document_id_fkey";

alter table "public"."contracts" add constraint "contracts_risk_score_check" CHECK (((risk_score >= (0)::numeric) AND (risk_score <= (10)::numeric))) not valid;

alter table "public"."contracts" validate constraint "contracts_risk_score_check";

alter table "public"."contracts" add constraint "contracts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'under_review'::text, 'negotiating'::text, 'executed'::text, 'terminated'::text]))) not valid;

alter table "public"."contracts" validate constraint "contracts_status_check";

alter table "public"."contracts" add constraint "contracts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."contracts" validate constraint "contracts_user_id_fkey";

alter table "public"."deadlines" add constraint "deadlines_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."deadlines" validate constraint "deadlines_case_id_fkey";

alter table "public"."deadlines" add constraint "deadlines_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id) not valid;

alter table "public"."deadlines" validate constraint "deadlines_completed_by_fkey";

alter table "public"."deadlines" add constraint "deadlines_deadline_type_check" CHECK ((deadline_type = ANY (ARRAY['filing'::text, 'response'::text, 'hearing'::text, 'discovery'::text, 'motion'::text, 'trial'::text, 'appeal'::text, 'settlement'::text, 'other'::text]))) not valid;

alter table "public"."deadlines" validate constraint "deadlines_deadline_type_check";

alter table "public"."deadlines" add constraint "deadlines_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."deadlines" validate constraint "deadlines_priority_check";

alter table "public"."deadlines" add constraint "deadlines_source_document_id_fkey" FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL not valid;

alter table "public"."deadlines" validate constraint "deadlines_source_document_id_fkey";

alter table "public"."deadlines" add constraint "deadlines_status_check" CHECK ((status = ANY (ARRAY['upcoming'::text, 'completed'::text, 'missed'::text, 'cancelled'::text, 'extended'::text]))) not valid;

alter table "public"."deadlines" validate constraint "deadlines_status_check";

alter table "public"."deadlines" add constraint "deadlines_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."deadlines" validate constraint "deadlines_user_id_fkey";

alter table "public"."document_relationships" add constraint "document_relationships_check" CHECK ((source_document_id <> target_document_id)) not valid;

alter table "public"."document_relationships" validate constraint "document_relationships_check";

alter table "public"."document_relationships" add constraint "document_relationships_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))) not valid;

alter table "public"."document_relationships" validate constraint "document_relationships_confidence_score_check";

alter table "public"."document_relationships" add constraint "document_relationships_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['responds_to'::text, 'amends'::text, 'cites'::text, 'opposes'::text, 'supersedes'::text, 'references'::text, 'exhibits'::text]))) not valid;

alter table "public"."document_relationships" validate constraint "document_relationships_relationship_type_check";

alter table "public"."document_relationships" add constraint "document_relationships_source_document_id_fkey" FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."document_relationships" validate constraint "document_relationships_source_document_id_fkey";

alter table "public"."document_relationships" add constraint "document_relationships_source_document_id_target_document_i_key" UNIQUE using index "document_relationships_source_document_id_target_document_i_key";

alter table "public"."document_relationships" add constraint "document_relationships_target_document_id_fkey" FOREIGN KEY (target_document_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."document_relationships" validate constraint "document_relationships_target_document_id_fkey";

alter table "public"."documents" add constraint "documents_classification_check" CHECK ((classification = ANY (ARRAY['pleading'::text, 'motion'::text, 'brief'::text, 'order'::text, 'evidence'::text, 'correspondence'::text, 'contract'::text, 'discovery'::text, 'other'::text]))) not valid;

alter table "public"."documents" validate constraint "documents_classification_check";

alter table "public"."documents" add constraint "documents_ocr_status_check" CHECK ((ocr_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'not_required'::text]))) not valid;

alter table "public"."documents" validate constraint "documents_ocr_status_check";

alter table "public"."documents" add constraint "documents_processing_status_check" CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."documents" validate constraint "documents_processing_status_check";

alter table "public"."documents" add constraint "documents_strength_score_check" CHECK (((strength_score >= (0)::numeric) AND (strength_score <= (10)::numeric))) not valid;

alter table "public"."documents" validate constraint "documents_strength_score_check";

alter table "public"."embeddings" add constraint "embeddings_entity_type_check" CHECK ((entity_type = ANY (ARRAY['document'::text, 'case'::text, 'event'::text, 'task'::text, 'precedent'::text]))) not valid;

alter table "public"."embeddings" validate constraint "embeddings_entity_type_check";

alter table "public"."embeddings" add constraint "embeddings_entity_type_entity_id_key" UNIQUE using index "embeddings_entity_type_entity_id_key";

alter table "public"."embeddings" add constraint "embeddings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."embeddings" validate constraint "embeddings_user_id_fkey";

alter table "public"."entities" add constraint "entities_entity_type_canonical_name_key" UNIQUE using index "entities_entity_type_canonical_name_key";

alter table "public"."entities" add constraint "entities_entity_type_check" CHECK ((entity_type = ANY (ARRAY['person'::text, 'organization'::text, 'law'::text, 'statute'::text, 'regulation'::text, 'precedent'::text, 'legal_concept'::text, 'expert_witness'::text, 'attorney'::text]))) not valid;

alter table "public"."entities" validate constraint "entities_entity_type_check";

alter table "public"."entity_relationships" add constraint "entity_relationships_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."entity_relationships" validate constraint "entity_relationships_case_id_fkey";

alter table "public"."entity_relationships" add constraint "entity_relationships_check" CHECK ((source_entity_id <> target_entity_id)) not valid;

alter table "public"."entity_relationships" validate constraint "entity_relationships_check";

alter table "public"."entity_relationships" add constraint "entity_relationships_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."entity_relationships" validate constraint "entity_relationships_document_id_fkey";

alter table "public"."entity_relationships" add constraint "entity_relationships_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['represents'::text, 'employs'::text, 'works_for'::text, 'opposes'::text, 'cites'::text, 'amends'::text, 'supersedes'::text, 'conflicts_with'::text, 'related_to'::text, 'expert_in'::text, 'affiliated_with'::text]))) not valid;

alter table "public"."entity_relationships" validate constraint "entity_relationships_relationship_type_check";

alter table "public"."entity_relationships" add constraint "entity_relationships_source_entity_id_fkey" FOREIGN KEY (source_entity_id) REFERENCES public.entities(id) ON DELETE CASCADE not valid;

alter table "public"."entity_relationships" validate constraint "entity_relationships_source_entity_id_fkey";

alter table "public"."entity_relationships" add constraint "entity_relationships_target_entity_id_fkey" FOREIGN KEY (target_entity_id) REFERENCES public.entities(id) ON DELETE CASCADE not valid;

alter table "public"."entity_relationships" validate constraint "entity_relationships_target_entity_id_fkey";

alter table "public"."expertise_profiles" add constraint "expertise_profiles_specialization_score_check" CHECK (((specialization_score >= (0)::numeric) AND (specialization_score <= (1)::numeric))) not valid;

alter table "public"."expertise_profiles" validate constraint "expertise_profiles_specialization_score_check";

alter table "public"."expertise_profiles" add constraint "expertise_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."expertise_profiles" validate constraint "expertise_profiles_user_id_fkey";

alter table "public"."expertise_profiles" add constraint "expertise_profiles_user_id_practice_area_key" UNIQUE using index "expertise_profiles_user_id_practice_area_key";

alter table "public"."judge_patterns" add constraint "judge_patterns_judge_id_fkey" FOREIGN KEY (judge_id) REFERENCES public.judges(id) ON DELETE CASCADE not valid;

alter table "public"."judge_patterns" validate constraint "judge_patterns_judge_id_fkey";

alter table "public"."judge_patterns" add constraint "judge_patterns_pattern_type_check" CHECK ((pattern_type = ANY (ARRAY['motion_grant_rate'::text, 'avg_sentence_length'::text, 'trial_preference'::text, 'settlement_encouragement'::text, 'discovery_strictness'::text, 'procedural_strictness'::text, 'plaintiff_favorability'::text, 'defendant_favorability'::text, 'appeal_reversal_rate'::text, 'case_duration_avg'::text]))) not valid;

alter table "public"."judge_patterns" validate constraint "judge_patterns_pattern_type_check";

alter table "public"."judges" add constraint "judges_court_type_check" CHECK ((court_type = ANY (ARRAY['federal'::text, 'state'::text, 'appellate'::text, 'trial'::text, 'supreme'::text, 'district'::text]))) not valid;

alter table "public"."judges" validate constraint "judges_court_type_check";

alter table "public"."judges" add constraint "judges_data_quality_score_check" CHECK (((data_quality_score >= (0)::numeric) AND (data_quality_score <= (1)::numeric))) not valid;

alter table "public"."judges" validate constraint "judges_data_quality_score_check";

alter table "public"."judges" add constraint "judges_full_name_court_key" UNIQUE using index "judges_full_name_court_key";

alter table "public"."legal_arguments" add constraint "legal_arguments_argument_type_check" CHECK ((argument_type = ANY (ARRAY['primary'::text, 'alternative'::text, 'counter'::text, 'rebuttal'::text]))) not valid;

alter table "public"."legal_arguments" validate constraint "legal_arguments_argument_type_check";

alter table "public"."legal_arguments" add constraint "legal_arguments_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."legal_arguments" validate constraint "legal_arguments_case_id_fkey";

alter table "public"."legal_arguments" add constraint "legal_arguments_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."legal_arguments" validate constraint "legal_arguments_reviewed_by_fkey";

alter table "public"."legal_arguments" add constraint "legal_arguments_strength_score_check" CHECK (((strength_score >= (0)::numeric) AND (strength_score <= (10)::numeric))) not valid;

alter table "public"."legal_arguments" validate constraint "legal_arguments_strength_score_check";

alter table "public"."legal_arguments" add constraint "legal_arguments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."legal_arguments" validate constraint "legal_arguments_user_id_fkey";

alter table "public"."market_insights" add constraint "market_insights_impact_level_check" CHECK ((impact_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."market_insights" validate constraint "market_insights_impact_level_check";

alter table "public"."market_insights" add constraint "market_insights_insight_type_check" CHECK ((insight_type = ANY (ARRAY['trend'::text, 'regulatory_change'::text, 'competitive_move'::text, 'technology'::text, 'market_opportunity'::text, 'risk_alert'::text]))) not valid;

alter table "public"."market_insights" validate constraint "market_insights_insight_type_check";

alter table "public"."opposing_counsel" add constraint "opposing_counsel_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES public.entities(id) not valid;

alter table "public"."opposing_counsel" validate constraint "opposing_counsel_entity_id_fkey";

alter table "public"."opposing_counsel" add constraint "opposing_counsel_name_firm_key" UNIQUE using index "opposing_counsel_name_firm_key";

alter table "public"."opposing_counsel" add constraint "opposing_counsel_negotiation_style_check" CHECK ((negotiation_style = ANY (ARRAY['aggressive'::text, 'collaborative'::text, 'analytical'::text, 'accommodating'::text]))) not valid;

alter table "public"."opposing_counsel" validate constraint "opposing_counsel_negotiation_style_check";

alter table "public"."opposing_counsel" add constraint "opposing_counsel_settlement_tendency_check" CHECK ((settlement_tendency = ANY (ARRAY['settles_early'::text, 'settles_late'::text, 'takes_to_trial'::text, 'varies'::text]))) not valid;

alter table "public"."opposing_counsel" validate constraint "opposing_counsel_settlement_tendency_check";

alter table "public"."organizations" add constraint "organizations_billing_plan_check" CHECK ((billing_plan = ANY (ARRAY['free'::text, 'starter'::text, 'professional'::text, 'enterprise'::text]))) not valid;

alter table "public"."organizations" validate constraint "organizations_billing_plan_check";

alter table "public"."organizations" add constraint "organizations_subscription_status_check" CHECK ((subscription_status = ANY (ARRAY['active'::text, 'trial'::text, 'suspended'::text, 'cancelled'::text]))) not valid;

alter table "public"."organizations" validate constraint "organizations_subscription_status_check";

alter table "public"."precedents" add constraint "precedents_citation_key" UNIQUE using index "precedents_citation_key";

alter table "public"."precedents" add constraint "precedents_court_level_check" CHECK ((court_level = ANY (ARRAY['supreme'::text, 'appellate'::text, 'district'::text, 'trial'::text]))) not valid;

alter table "public"."precedents" validate constraint "precedents_court_level_check";

alter table "public"."predictions" add constraint "predictions_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."predictions" validate constraint "predictions_case_id_fkey";

alter table "public"."predictions" add constraint "predictions_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))) not valid;

alter table "public"."predictions" validate constraint "predictions_confidence_score_check";

alter table "public"."predictions" add constraint "predictions_prediction_type_check" CHECK ((prediction_type = ANY (ARRAY['case_outcome'::text, 'case_duration'::text, 'settlement_value'::text, 'judge_ruling'::text, 'motion_success'::text, 'trial_verdict'::text, 'appeal_outcome'::text, 'cost_estimate'::text]))) not valid;

alter table "public"."predictions" validate constraint "predictions_prediction_type_check";

alter table "public"."predictions" add constraint "predictions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."predictions" validate constraint "predictions_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."reports" add constraint "reports_format_check" CHECK ((format = ANY (ARRAY['pdf'::text, 'csv'::text, 'json'::text, 'xlsx'::text]))) not valid;

alter table "public"."reports" validate constraint "reports_format_check";

alter table "public"."reports" add constraint "reports_report_type_check" CHECK ((report_type = ANY (ARRAY['case_status'::text, 'document_inventory'::text, 'deadline_compliance'::text, 'productivity_analysis'::text, 'win_loss_summary'::text, 'cost_analysis'::text, 'custom'::text]))) not valid;

alter table "public"."reports" validate constraint "reports_report_type_check";

alter table "public"."reports" add constraint "reports_status_check" CHECK ((status = ANY (ARRAY['generating'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."reports" validate constraint "reports_status_check";

alter table "public"."reports" add constraint "reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."reports" validate constraint "reports_user_id_fkey";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."sentiment_analyses" validate constraint "sentiment_analyses_case_id_fkey";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_cooperation_level_check" CHECK ((cooperation_level = ANY (ARRAY['cooperative'::text, 'neutral'::text, 'uncooperative'::text, 'hostile'::text]))) not valid;

alter table "public"."sentiment_analyses" validate constraint "sentiment_analyses_cooperation_level_check";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."sentiment_analyses" validate constraint "sentiment_analyses_document_id_fkey";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_overall_sentiment_check" CHECK ((overall_sentiment = ANY (ARRAY['very_positive'::text, 'positive'::text, 'neutral'::text, 'negative'::text, 'hostile'::text]))) not valid;

alter table "public"."sentiment_analyses" validate constraint "sentiment_analyses_overall_sentiment_check";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_sentiment_score_check" CHECK (((sentiment_score >= '-1.0'::numeric) AND (sentiment_score <= 1.0))) not valid;

alter table "public"."sentiment_analyses" validate constraint "sentiment_analyses_sentiment_score_check";

alter table "public"."sentiment_analyses" add constraint "sentiment_analyses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."sentiment_analyses" validate constraint "sentiment_analyses_user_id_fkey";

alter table "public"."settlement_analyses" add constraint "settlement_analyses_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."settlement_analyses" validate constraint "settlement_analyses_case_id_fkey";

alter table "public"."settlement_analyses" add constraint "settlement_analyses_optimal_timing_check" CHECK ((optimal_timing = ANY (ARRAY['immediate'::text, 'after_discovery'::text, 'before_trial'::text, 'during_trial'::text, 'post_trial'::text]))) not valid;

alter table "public"."settlement_analyses" validate constraint "settlement_analyses_optimal_timing_check";

alter table "public"."settlement_analyses" add constraint "settlement_analyses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."settlement_analyses" validate constraint "settlement_analyses_user_id_fkey";

alter table "public"."strategy_simulations" add constraint "strategy_simulations_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."strategy_simulations" validate constraint "strategy_simulations_case_id_fkey";

alter table "public"."strategy_simulations" add constraint "strategy_simulations_risk_level_check" CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'very_high'::text]))) not valid;

alter table "public"."strategy_simulations" validate constraint "strategy_simulations_risk_level_check";

alter table "public"."strategy_simulations" add constraint "strategy_simulations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."strategy_simulations" validate constraint "strategy_simulations_user_id_fkey";

alter table "public"."strategy_simulations" add constraint "strategy_simulations_win_probability_check" CHECK (((win_probability >= (0)::numeric) AND (win_probability <= (1)::numeric))) not valid;

alter table "public"."strategy_simulations" validate constraint "strategy_simulations_win_probability_check";

alter table "public"."tasks" add constraint "fk_tasks_source_deadline" FOREIGN KEY (source_deadline_id) REFERENCES public.deadlines(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "fk_tasks_source_deadline";

alter table "public"."tasks" add constraint "tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_assigned_to_fkey";

alter table "public"."tasks" add constraint "tasks_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_case_id_fkey";

alter table "public"."tasks" add constraint "tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id) not valid;

alter table "public"."tasks" validate constraint "tasks_completed_by_fkey";

alter table "public"."tasks" add constraint "tasks_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))) not valid;

alter table "public"."tasks" validate constraint "tasks_priority_check";

alter table "public"."tasks" add constraint "tasks_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'ai_generated'::text, 'deadline_derived'::text, 'template'::text]))) not valid;

alter table "public"."tasks" validate constraint "tasks_source_check";

alter table "public"."tasks" add constraint "tasks_source_document_id_fkey" FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_source_document_id_fkey";

alter table "public"."tasks" add constraint "tasks_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'blocked'::text]))) not valid;

alter table "public"."tasks" validate constraint "tasks_status_check";

alter table "public"."tasks" add constraint "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_user_id_fkey";

alter table "public"."team_members" add constraint "team_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) not valid;

alter table "public"."team_members" validate constraint "team_members_invited_by_fkey";

alter table "public"."team_members" add constraint "team_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_organization_id_fkey";

alter table "public"."team_members" add constraint "team_members_organization_id_user_id_key" UNIQUE using index "team_members_organization_id_user_id_key";

alter table "public"."team_members" add constraint "team_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'attorney'::text, 'paralegal'::text, 'staff'::text, 'client'::text]))) not valid;

alter table "public"."team_members" validate constraint "team_members_role_check";

alter table "public"."team_members" add constraint "team_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_user_id_fkey";

alter table "public"."witness_analyses" add constraint "witness_analyses_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE not valid;

alter table "public"."witness_analyses" validate constraint "witness_analyses_case_id_fkey";

alter table "public"."witness_analyses" add constraint "witness_analyses_credibility_score_check" CHECK (((credibility_score >= (0)::numeric) AND (credibility_score <= (10)::numeric))) not valid;

alter table "public"."witness_analyses" validate constraint "witness_analyses_credibility_score_check";

alter table "public"."witness_analyses" add constraint "witness_analyses_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES public.entities(id) not valid;

alter table "public"."witness_analyses" validate constraint "witness_analyses_entity_id_fkey";

alter table "public"."witness_analyses" add constraint "witness_analyses_role_check" CHECK ((role = ANY (ARRAY['plaintiff_witness'::text, 'defendant_witness'::text, 'expert'::text, 'fact_witness'::text, 'character_witness'::text]))) not valid;

alter table "public"."witness_analyses" validate constraint "witness_analyses_role_check";

alter table "public"."witness_analyses" add constraint "witness_analyses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."witness_analyses" validate constraint "witness_analyses_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_complete_deadline_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.tasks
    SET status = 'completed',
        completed_at = NEW.completed_at,
        completed_by = NEW.completed_by
    WHERE source_deadline_id = NEW.id
      AND status != 'completed';
  END IF;
  RETURN NEW;
END;
$function$
;

create materialized view "public"."case_analytics_summary" as  SELECT c.user_id,
    date_trunc('month'::text, c.created_at) AS month,
    c.status,
    c.case_type,
    count(*) AS case_count,
    avg(c.overall_strength_score) AS avg_strength_score,
    avg((COALESCE(c.trial_date, CURRENT_DATE) - c.filing_date)) AS avg_duration_days,
    count(
        CASE
            WHEN (c.status = 'closed'::text) THEN 1
            ELSE NULL::integer
        END) AS closed_count,
    count(
        CASE
            WHEN (c.status = 'active'::text) THEN 1
            ELSE NULL::integer
        END) AS active_count,
    count(DISTINCT d.id) AS total_documents,
    count(DISTINCT t.id) AS total_tasks,
    count(DISTINCT dl.id) AS total_deadlines
   FROM (((public.cases c
     LEFT JOIN public.documents d ON ((d.case_id = c.id)))
     LEFT JOIN public.tasks t ON ((t.case_id = c.id)))
     LEFT JOIN public.deadlines dl ON ((dl.case_id = c.id)))
  GROUP BY c.user_id, (date_trunc('month'::text, c.created_at)), c.status, c.case_type;


CREATE OR REPLACE FUNCTION public.check_organization_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  org_record RECORD;
  current_users INTEGER;
  current_cases INTEGER;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    SELECT * INTO org_record FROM public.organizations WHERE id = NEW.organization_id;

    IF TG_TABLE_NAME = 'team_members' THEN
      SELECT COUNT(*) INTO current_users
      FROM public.team_members
      WHERE organization_id = NEW.organization_id AND invitation_accepted = true;

      IF current_users >= org_record.max_users THEN
        RAISE EXCEPTION 'Organization has reached maximum user limit of %', org_record.max_users;
      END IF;
    END IF;

    IF TG_TABLE_NAME = 'cases' THEN
      SELECT COUNT(*) INTO current_cases
      FROM public.cases
      WHERE organization_id = NEW.organization_id;

      IF current_cases >= org_record.max_cases THEN
        RAISE EXCEPTION 'Organization has reached maximum case limit of %', org_record.max_cases;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_similar_cases(target_case_id uuid, similarity_threshold double precision DEFAULT 0.5, max_results integer DEFAULT 10)
 RETURNS TABLE(case_id uuid, title text, similarity_score double precision, matching_factors jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_case RECORD;
BEGIN
  -- Get target case details
  SELECT * INTO target_case FROM public.cases WHERE id = target_case_id;

  -- Find similar cases (simplified - in production would use embeddings)
  RETURN QUERY
  SELECT
    c.id as case_id,
    c.title,
    (
      (CASE WHEN c.case_type = target_case.case_type THEN 0.3 ELSE 0 END) +
      (CASE WHEN c.court = target_case.court THEN 0.2 ELSE 0 END) +
      (CASE WHEN c.judge_id = target_case.judge_id THEN 0.2 ELSE 0 END) +
      (CASE WHEN ABS(COALESCE(c.overall_strength_score, 5) - COALESCE(target_case.overall_strength_score, 5)) < 2 THEN 0.1 ELSE 0 END)
    ) as similarity_score,
    jsonb_build_object(
      'same_type', c.case_type = target_case.case_type,
      'same_court', c.court = target_case.court,
      'same_judge', c.judge_id = target_case.judge_id
    ) as matching_factors
  FROM public.cases c
  WHERE c.id != target_case_id
    AND c.user_id = target_case.user_id
  HAVING similarity_score >= similarity_threshold
  ORDER BY similarity_score DESC
  LIMIT max_results;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_deadline_notifications()
 RETURNS TABLE(deadline_id uuid, user_id uuid, case_id uuid, title text, deadline_date date, days_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id as deadline_id,
    d.user_id,
    d.case_id,
    d.title,
    d.deadline_date,
    (d.deadline_date - CURRENT_DATE)::int as days_remaining
  FROM public.deadlines d
  WHERE d.status = 'upcoming'
    AND d.deadline_date >= CURRENT_DATE
    AND (
      -- Check if notification is needed based on schedule
      d.notification_schedule ? (d.deadline_date - CURRENT_DATE)::text
      OR
      -- Send day-of notification
      d.deadline_date = CURRENT_DATE
    )
    AND (
      d.last_notification_sent_at IS NULL
      OR d.last_notification_sent_at < CURRENT_DATE
    )
  ORDER BY d.deadline_date ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_agent_metrics(agent_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  metrics jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_actions', COUNT(*),
    'pending_review', COUNT(*) FILTER (WHERE requires_review AND reviewed_at IS NULL),
    'approved', COUNT(*) FILTER (WHERE review_decision = 'approved'),
    'rejected', COUNT(*) FILTER (WHERE review_decision = 'rejected'),
    'modified', COUNT(*) FILTER (WHERE review_decision = 'modified'),
    'success_rate', CASE
      WHEN COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL) = 0 THEN NULL
      ELSE COUNT(*) FILTER (WHERE review_decision = 'approved')::NUMERIC /
           COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL)::NUMERIC
    END,
    'avg_confidence', AVG(confidence_score),
    'actions_by_type', jsonb_object_agg(action_type, COUNT(*))
  ) INTO metrics
  FROM public.agent_actions
  WHERE agent_id = agent_uuid;

  RETURN metrics;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_case_sentiment_timeline(target_case_id uuid)
 RETURNS TABLE(document_date date, document_title text, sentiment_score numeric, overall_sentiment text, concerns_flagged text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.document_date,
    d.title as document_title,
    sa.sentiment_score,
    sa.overall_sentiment,
    sa.concerns_flagged
  FROM public.sentiment_analyses sa
  JOIN public.documents d ON d.id = sa.document_id
  WHERE sa.case_id = target_case_id
  ORDER BY d.document_date ASC NULLS LAST, d.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_case_statistics(filter_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_documents', COUNT(DISTINCT d.id),
    'total_tasks', COUNT(DISTINCT t.id),
    'completed_tasks', COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed'),
    'pending_tasks', COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending'),
    'total_deadlines', COUNT(DISTINCT dl.id),
    'upcoming_deadlines', COUNT(DISTINCT dl.id) FILTER (WHERE dl.status = 'upcoming'),
    'missed_deadlines', COUNT(DISTINCT dl.id) FILTER (WHERE dl.status = 'missed'),
    'insights_count', COUNT(DISTINCT ci.id),
    'active_insights', COUNT(DISTINCT ci.id) FILTER (WHERE ci.status = 'active')
  ) INTO stats
  FROM public.cases c
  LEFT JOIN public.documents d ON d.case_id = c.id
  LEFT JOIN public.tasks t ON t.case_id = c.id
  LEFT JOIN public.deadlines dl ON dl.case_id = c.id
  LEFT JOIN public.case_insights ci ON ci.case_id = c.id
  WHERE c.id = filter_case_id;

  RETURN stats;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_compliance_summary(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  summary jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_checks', COUNT(*),
    'compliant', COUNT(*) FILTER (WHERE status = 'compliant'),
    'warnings', COUNT(*) FILTER (WHERE status = 'warning'),
    'violations', COUNT(*) FILTER (WHERE status = 'violation'),
    'needs_review', COUNT(*) FILTER (WHERE status = 'needs_review'),
    'unresolved', COUNT(*) FILTER (WHERE resolved = false),
    'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND resolved = false)
  ) INTO summary
  FROM public.compliance_checks
  WHERE user_id = target_user_id;

  RETURN summary;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_judge_statistics(judge_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_patterns', COUNT(*),
    'case_types_analyzed', COUNT(DISTINCT case_type),
    'avg_confidence', AVG(confidence_level),
    'data_freshness_days', EXTRACT(DAY FROM NOW() - MAX(updated_at))::int,
    'patterns_by_type', jsonb_object_agg(pattern_type, COUNT(*))
  ) INTO stats
  FROM public.judge_patterns
  WHERE judge_id = judge_uuid;

  RETURN stats;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_upcoming_deadlines(days_ahead integer DEFAULT 30, filter_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, case_id uuid, title text, deadline_date date, days_remaining integer, priority text, case_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.case_id,
    d.title,
    d.deadline_date,
    (d.deadline_date - CURRENT_DATE)::int as days_remaining,
    d.priority,
    c.title as case_title
  FROM public.deadlines d
  JOIN public.cases c ON c.id = d.case_id
  WHERE d.status = 'upcoming'
    AND d.deadline_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
    AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
  ORDER BY d.deadline_date ASC, d.priority DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_organizations(target_user_id uuid)
 RETURNS TABLE(organization_id uuid, organization_name text, role text, permissions jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    o.id as organization_id,
    o.name as organization_name,
    tm.role,
    tm.permissions
  FROM public.organizations o
  JOIN public.team_members tm ON tm.organization_id = o.id
  WHERE tm.user_id = target_user_id
    AND tm.invitation_accepted = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_sensitive_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    changes,
    success
  ) VALUES (
    auth.uid(),
    TG_OP || ' on ' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    NEW.id,
    jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)),
    true
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.case_analytics_summary;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_documents_by_embedding(query_embedding public.vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10, filter_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(document_id uuid, title text, similarity double precision, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    e.entity_id as document_id,
    d.title,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.metadata
  FROM public.embeddings e
  JOIN public.documents d ON d.id = e.entity_id
  WHERE e.entity_type = 'document'
    AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_agent_success_rate()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ai_agents
  SET success_rate = (
    SELECT
      CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE COUNT(*) FILTER (WHERE review_decision = 'approved')::NUMERIC / COUNT(*)::NUMERIC
      END
    FROM public.agent_actions
    WHERE agent_actions.agent_id = ai_agents.id
      AND reviewed_at IS NOT NULL
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_case_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.cases
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.case_id, OLD.case_id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_prediction_accuracy()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.predictions
  SET accuracy_score = CASE
    WHEN predicted_value = actual_value THEN 1.0
    WHEN predicted_value_numeric IS NOT NULL AND actual_value_numeric IS NOT NULL THEN
      1.0 - (ABS(predicted_value_numeric - actual_value_numeric) / NULLIF(actual_value_numeric, 0))
    ELSE 0.0
  END
  WHERE actual_value IS NOT NULL
    AND accuracy_score IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$function$
;

CREATE INDEX idx_case_analytics_type ON public.case_analytics_summary USING btree (case_type);

CREATE INDEX idx_case_analytics_user_month ON public.case_analytics_summary USING btree (user_id, month DESC);

grant delete on table "public"."agent_actions" to "anon";

grant insert on table "public"."agent_actions" to "anon";

grant references on table "public"."agent_actions" to "anon";

grant select on table "public"."agent_actions" to "anon";

grant trigger on table "public"."agent_actions" to "anon";

grant truncate on table "public"."agent_actions" to "anon";

grant update on table "public"."agent_actions" to "anon";

grant delete on table "public"."agent_actions" to "authenticated";

grant insert on table "public"."agent_actions" to "authenticated";

grant references on table "public"."agent_actions" to "authenticated";

grant select on table "public"."agent_actions" to "authenticated";

grant trigger on table "public"."agent_actions" to "authenticated";

grant truncate on table "public"."agent_actions" to "authenticated";

grant update on table "public"."agent_actions" to "authenticated";

grant delete on table "public"."agent_actions" to "service_role";

grant insert on table "public"."agent_actions" to "service_role";

grant references on table "public"."agent_actions" to "service_role";

grant select on table "public"."agent_actions" to "service_role";

grant trigger on table "public"."agent_actions" to "service_role";

grant truncate on table "public"."agent_actions" to "service_role";

grant update on table "public"."agent_actions" to "service_role";

grant delete on table "public"."agent_feedback" to "anon";

grant insert on table "public"."agent_feedback" to "anon";

grant references on table "public"."agent_feedback" to "anon";

grant select on table "public"."agent_feedback" to "anon";

grant trigger on table "public"."agent_feedback" to "anon";

grant truncate on table "public"."agent_feedback" to "anon";

grant update on table "public"."agent_feedback" to "anon";

grant delete on table "public"."agent_feedback" to "authenticated";

grant insert on table "public"."agent_feedback" to "authenticated";

grant references on table "public"."agent_feedback" to "authenticated";

grant select on table "public"."agent_feedback" to "authenticated";

grant trigger on table "public"."agent_feedback" to "authenticated";

grant truncate on table "public"."agent_feedback" to "authenticated";

grant update on table "public"."agent_feedback" to "authenticated";

grant delete on table "public"."agent_feedback" to "service_role";

grant insert on table "public"."agent_feedback" to "service_role";

grant references on table "public"."agent_feedback" to "service_role";

grant select on table "public"."agent_feedback" to "service_role";

grant trigger on table "public"."agent_feedback" to "service_role";

grant truncate on table "public"."agent_feedback" to "service_role";

grant update on table "public"."agent_feedback" to "service_role";

grant delete on table "public"."ai_agents" to "anon";

grant insert on table "public"."ai_agents" to "anon";

grant references on table "public"."ai_agents" to "anon";

grant select on table "public"."ai_agents" to "anon";

grant trigger on table "public"."ai_agents" to "anon";

grant truncate on table "public"."ai_agents" to "anon";

grant update on table "public"."ai_agents" to "anon";

grant delete on table "public"."ai_agents" to "authenticated";

grant insert on table "public"."ai_agents" to "authenticated";

grant references on table "public"."ai_agents" to "authenticated";

grant select on table "public"."ai_agents" to "authenticated";

grant trigger on table "public"."ai_agents" to "authenticated";

grant truncate on table "public"."ai_agents" to "authenticated";

grant update on table "public"."ai_agents" to "authenticated";

grant delete on table "public"."ai_agents" to "service_role";

grant insert on table "public"."ai_agents" to "service_role";

grant references on table "public"."ai_agents" to "service_role";

grant select on table "public"."ai_agents" to "service_role";

grant trigger on table "public"."ai_agents" to "service_role";

grant truncate on table "public"."ai_agents" to "service_role";

grant update on table "public"."ai_agents" to "service_role";

grant delete on table "public"."ai_jobs" to "anon";

grant insert on table "public"."ai_jobs" to "anon";

grant references on table "public"."ai_jobs" to "anon";

grant select on table "public"."ai_jobs" to "anon";

grant trigger on table "public"."ai_jobs" to "anon";

grant truncate on table "public"."ai_jobs" to "anon";

grant update on table "public"."ai_jobs" to "anon";

grant delete on table "public"."ai_jobs" to "authenticated";

grant insert on table "public"."ai_jobs" to "authenticated";

grant references on table "public"."ai_jobs" to "authenticated";

grant select on table "public"."ai_jobs" to "authenticated";

grant trigger on table "public"."ai_jobs" to "authenticated";

grant truncate on table "public"."ai_jobs" to "authenticated";

grant update on table "public"."ai_jobs" to "authenticated";

grant delete on table "public"."ai_jobs" to "service_role";

grant insert on table "public"."ai_jobs" to "service_role";

grant references on table "public"."ai_jobs" to "service_role";

grant select on table "public"."ai_jobs" to "service_role";

grant trigger on table "public"."ai_jobs" to "service_role";

grant truncate on table "public"."ai_jobs" to "service_role";

grant update on table "public"."ai_jobs" to "service_role";

grant delete on table "public"."ai_usage_logs" to "anon";

grant insert on table "public"."ai_usage_logs" to "anon";

grant references on table "public"."ai_usage_logs" to "anon";

grant select on table "public"."ai_usage_logs" to "anon";

grant trigger on table "public"."ai_usage_logs" to "anon";

grant truncate on table "public"."ai_usage_logs" to "anon";

grant update on table "public"."ai_usage_logs" to "anon";

grant delete on table "public"."ai_usage_logs" to "authenticated";

grant insert on table "public"."ai_usage_logs" to "authenticated";

grant references on table "public"."ai_usage_logs" to "authenticated";

grant select on table "public"."ai_usage_logs" to "authenticated";

grant trigger on table "public"."ai_usage_logs" to "authenticated";

grant truncate on table "public"."ai_usage_logs" to "authenticated";

grant update on table "public"."ai_usage_logs" to "authenticated";

grant delete on table "public"."ai_usage_logs" to "service_role";

grant insert on table "public"."ai_usage_logs" to "service_role";

grant references on table "public"."ai_usage_logs" to "service_role";

grant select on table "public"."ai_usage_logs" to "service_role";

grant trigger on table "public"."ai_usage_logs" to "service_role";

grant truncate on table "public"."ai_usage_logs" to "service_role";

grant update on table "public"."ai_usage_logs" to "service_role";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."billing_records" to "anon";

grant insert on table "public"."billing_records" to "anon";

grant references on table "public"."billing_records" to "anon";

grant select on table "public"."billing_records" to "anon";

grant trigger on table "public"."billing_records" to "anon";

grant truncate on table "public"."billing_records" to "anon";

grant update on table "public"."billing_records" to "anon";

grant delete on table "public"."billing_records" to "authenticated";

grant insert on table "public"."billing_records" to "authenticated";

grant references on table "public"."billing_records" to "authenticated";

grant select on table "public"."billing_records" to "authenticated";

grant trigger on table "public"."billing_records" to "authenticated";

grant truncate on table "public"."billing_records" to "authenticated";

grant update on table "public"."billing_records" to "authenticated";

grant delete on table "public"."billing_records" to "service_role";

grant insert on table "public"."billing_records" to "service_role";

grant references on table "public"."billing_records" to "service_role";

grant select on table "public"."billing_records" to "service_role";

grant trigger on table "public"."billing_records" to "service_role";

grant truncate on table "public"."billing_records" to "service_role";

grant update on table "public"."billing_records" to "service_role";

grant delete on table "public"."case_collaborators" to "anon";

grant insert on table "public"."case_collaborators" to "anon";

grant references on table "public"."case_collaborators" to "anon";

grant select on table "public"."case_collaborators" to "anon";

grant trigger on table "public"."case_collaborators" to "anon";

grant truncate on table "public"."case_collaborators" to "anon";

grant update on table "public"."case_collaborators" to "anon";

grant delete on table "public"."case_collaborators" to "authenticated";

grant insert on table "public"."case_collaborators" to "authenticated";

grant references on table "public"."case_collaborators" to "authenticated";

grant select on table "public"."case_collaborators" to "authenticated";

grant trigger on table "public"."case_collaborators" to "authenticated";

grant truncate on table "public"."case_collaborators" to "authenticated";

grant update on table "public"."case_collaborators" to "authenticated";

grant delete on table "public"."case_collaborators" to "service_role";

grant insert on table "public"."case_collaborators" to "service_role";

grant references on table "public"."case_collaborators" to "service_role";

grant select on table "public"."case_collaborators" to "service_role";

grant trigger on table "public"."case_collaborators" to "service_role";

grant truncate on table "public"."case_collaborators" to "service_role";

grant update on table "public"."case_collaborators" to "service_role";

grant delete on table "public"."case_events" to "anon";

grant insert on table "public"."case_events" to "anon";

grant references on table "public"."case_events" to "anon";

grant select on table "public"."case_events" to "anon";

grant trigger on table "public"."case_events" to "anon";

grant truncate on table "public"."case_events" to "anon";

grant update on table "public"."case_events" to "anon";

grant delete on table "public"."case_events" to "authenticated";

grant insert on table "public"."case_events" to "authenticated";

grant references on table "public"."case_events" to "authenticated";

grant select on table "public"."case_events" to "authenticated";

grant trigger on table "public"."case_events" to "authenticated";

grant truncate on table "public"."case_events" to "authenticated";

grant update on table "public"."case_events" to "authenticated";

grant delete on table "public"."case_events" to "service_role";

grant insert on table "public"."case_events" to "service_role";

grant references on table "public"."case_events" to "service_role";

grant select on table "public"."case_events" to "service_role";

grant trigger on table "public"."case_events" to "service_role";

grant truncate on table "public"."case_events" to "service_role";

grant update on table "public"."case_events" to "service_role";

grant delete on table "public"."case_insights" to "anon";

grant insert on table "public"."case_insights" to "anon";

grant references on table "public"."case_insights" to "anon";

grant select on table "public"."case_insights" to "anon";

grant trigger on table "public"."case_insights" to "anon";

grant truncate on table "public"."case_insights" to "anon";

grant update on table "public"."case_insights" to "anon";

grant delete on table "public"."case_insights" to "authenticated";

grant insert on table "public"."case_insights" to "authenticated";

grant references on table "public"."case_insights" to "authenticated";

grant select on table "public"."case_insights" to "authenticated";

grant trigger on table "public"."case_insights" to "authenticated";

grant truncate on table "public"."case_insights" to "authenticated";

grant update on table "public"."case_insights" to "authenticated";

grant delete on table "public"."case_insights" to "service_role";

grant insert on table "public"."case_insights" to "service_role";

grant references on table "public"."case_insights" to "service_role";

grant select on table "public"."case_insights" to "service_role";

grant trigger on table "public"."case_insights" to "service_role";

grant truncate on table "public"."case_insights" to "service_role";

grant update on table "public"."case_insights" to "service_role";

grant delete on table "public"."case_precedents" to "anon";

grant insert on table "public"."case_precedents" to "anon";

grant references on table "public"."case_precedents" to "anon";

grant select on table "public"."case_precedents" to "anon";

grant trigger on table "public"."case_precedents" to "anon";

grant truncate on table "public"."case_precedents" to "anon";

grant update on table "public"."case_precedents" to "anon";

grant delete on table "public"."case_precedents" to "authenticated";

grant insert on table "public"."case_precedents" to "authenticated";

grant references on table "public"."case_precedents" to "authenticated";

grant select on table "public"."case_precedents" to "authenticated";

grant trigger on table "public"."case_precedents" to "authenticated";

grant truncate on table "public"."case_precedents" to "authenticated";

grant update on table "public"."case_precedents" to "authenticated";

grant delete on table "public"."case_precedents" to "service_role";

grant insert on table "public"."case_precedents" to "service_role";

grant references on table "public"."case_precedents" to "service_role";

grant select on table "public"."case_precedents" to "service_role";

grant trigger on table "public"."case_precedents" to "service_role";

grant truncate on table "public"."case_precedents" to "service_role";

grant update on table "public"."case_precedents" to "service_role";

grant delete on table "public"."client_access" to "anon";

grant insert on table "public"."client_access" to "anon";

grant references on table "public"."client_access" to "anon";

grant select on table "public"."client_access" to "anon";

grant trigger on table "public"."client_access" to "anon";

grant truncate on table "public"."client_access" to "anon";

grant update on table "public"."client_access" to "anon";

grant delete on table "public"."client_access" to "authenticated";

grant insert on table "public"."client_access" to "authenticated";

grant references on table "public"."client_access" to "authenticated";

grant select on table "public"."client_access" to "authenticated";

grant trigger on table "public"."client_access" to "authenticated";

grant truncate on table "public"."client_access" to "authenticated";

grant update on table "public"."client_access" to "authenticated";

grant delete on table "public"."client_access" to "service_role";

grant insert on table "public"."client_access" to "service_role";

grant references on table "public"."client_access" to "service_role";

grant select on table "public"."client_access" to "service_role";

grant trigger on table "public"."client_access" to "service_role";

grant truncate on table "public"."client_access" to "service_role";

grant update on table "public"."client_access" to "service_role";

grant delete on table "public"."client_interactions" to "anon";

grant insert on table "public"."client_interactions" to "anon";

grant references on table "public"."client_interactions" to "anon";

grant select on table "public"."client_interactions" to "anon";

grant trigger on table "public"."client_interactions" to "anon";

grant truncate on table "public"."client_interactions" to "anon";

grant update on table "public"."client_interactions" to "anon";

grant delete on table "public"."client_interactions" to "authenticated";

grant insert on table "public"."client_interactions" to "authenticated";

grant references on table "public"."client_interactions" to "authenticated";

grant select on table "public"."client_interactions" to "authenticated";

grant trigger on table "public"."client_interactions" to "authenticated";

grant truncate on table "public"."client_interactions" to "authenticated";

grant update on table "public"."client_interactions" to "authenticated";

grant delete on table "public"."client_interactions" to "service_role";

grant insert on table "public"."client_interactions" to "service_role";

grant references on table "public"."client_interactions" to "service_role";

grant select on table "public"."client_interactions" to "service_role";

grant trigger on table "public"."client_interactions" to "service_role";

grant truncate on table "public"."client_interactions" to "service_role";

grant update on table "public"."client_interactions" to "service_role";

grant delete on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "anon";

grant references on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant trigger on table "public"."comments" to "anon";

grant truncate on table "public"."comments" to "anon";

grant update on table "public"."comments" to "anon";

grant delete on table "public"."comments" to "authenticated";

grant insert on table "public"."comments" to "authenticated";

grant references on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant trigger on table "public"."comments" to "authenticated";

grant truncate on table "public"."comments" to "authenticated";

grant update on table "public"."comments" to "authenticated";

grant delete on table "public"."comments" to "service_role";

grant insert on table "public"."comments" to "service_role";

grant references on table "public"."comments" to "service_role";

grant select on table "public"."comments" to "service_role";

grant trigger on table "public"."comments" to "service_role";

grant truncate on table "public"."comments" to "service_role";

grant update on table "public"."comments" to "service_role";

grant delete on table "public"."competitive_cases" to "anon";

grant insert on table "public"."competitive_cases" to "anon";

grant references on table "public"."competitive_cases" to "anon";

grant select on table "public"."competitive_cases" to "anon";

grant trigger on table "public"."competitive_cases" to "anon";

grant truncate on table "public"."competitive_cases" to "anon";

grant update on table "public"."competitive_cases" to "anon";

grant delete on table "public"."competitive_cases" to "authenticated";

grant insert on table "public"."competitive_cases" to "authenticated";

grant references on table "public"."competitive_cases" to "authenticated";

grant select on table "public"."competitive_cases" to "authenticated";

grant trigger on table "public"."competitive_cases" to "authenticated";

grant truncate on table "public"."competitive_cases" to "authenticated";

grant update on table "public"."competitive_cases" to "authenticated";

grant delete on table "public"."competitive_cases" to "service_role";

grant insert on table "public"."competitive_cases" to "service_role";

grant references on table "public"."competitive_cases" to "service_role";

grant select on table "public"."competitive_cases" to "service_role";

grant trigger on table "public"."competitive_cases" to "service_role";

grant truncate on table "public"."competitive_cases" to "service_role";

grant update on table "public"."competitive_cases" to "service_role";

grant delete on table "public"."compliance_checks" to "anon";

grant insert on table "public"."compliance_checks" to "anon";

grant references on table "public"."compliance_checks" to "anon";

grant select on table "public"."compliance_checks" to "anon";

grant trigger on table "public"."compliance_checks" to "anon";

grant truncate on table "public"."compliance_checks" to "anon";

grant update on table "public"."compliance_checks" to "anon";

grant delete on table "public"."compliance_checks" to "authenticated";

grant insert on table "public"."compliance_checks" to "authenticated";

grant references on table "public"."compliance_checks" to "authenticated";

grant select on table "public"."compliance_checks" to "authenticated";

grant trigger on table "public"."compliance_checks" to "authenticated";

grant truncate on table "public"."compliance_checks" to "authenticated";

grant update on table "public"."compliance_checks" to "authenticated";

grant delete on table "public"."compliance_checks" to "service_role";

grant insert on table "public"."compliance_checks" to "service_role";

grant references on table "public"."compliance_checks" to "service_role";

grant select on table "public"."compliance_checks" to "service_role";

grant trigger on table "public"."compliance_checks" to "service_role";

grant truncate on table "public"."compliance_checks" to "service_role";

grant update on table "public"."compliance_checks" to "service_role";

grant delete on table "public"."compliance_rules" to "anon";

grant insert on table "public"."compliance_rules" to "anon";

grant references on table "public"."compliance_rules" to "anon";

grant select on table "public"."compliance_rules" to "anon";

grant trigger on table "public"."compliance_rules" to "anon";

grant truncate on table "public"."compliance_rules" to "anon";

grant update on table "public"."compliance_rules" to "anon";

grant delete on table "public"."compliance_rules" to "authenticated";

grant insert on table "public"."compliance_rules" to "authenticated";

grant references on table "public"."compliance_rules" to "authenticated";

grant select on table "public"."compliance_rules" to "authenticated";

grant trigger on table "public"."compliance_rules" to "authenticated";

grant truncate on table "public"."compliance_rules" to "authenticated";

grant update on table "public"."compliance_rules" to "authenticated";

grant delete on table "public"."compliance_rules" to "service_role";

grant insert on table "public"."compliance_rules" to "service_role";

grant references on table "public"."compliance_rules" to "service_role";

grant select on table "public"."compliance_rules" to "service_role";

grant trigger on table "public"."compliance_rules" to "service_role";

grant truncate on table "public"."compliance_rules" to "service_role";

grant update on table "public"."compliance_rules" to "service_role";

grant delete on table "public"."contracts" to "anon";

grant insert on table "public"."contracts" to "anon";

grant references on table "public"."contracts" to "anon";

grant select on table "public"."contracts" to "anon";

grant trigger on table "public"."contracts" to "anon";

grant truncate on table "public"."contracts" to "anon";

grant update on table "public"."contracts" to "anon";

grant delete on table "public"."contracts" to "authenticated";

grant insert on table "public"."contracts" to "authenticated";

grant references on table "public"."contracts" to "authenticated";

grant select on table "public"."contracts" to "authenticated";

grant trigger on table "public"."contracts" to "authenticated";

grant truncate on table "public"."contracts" to "authenticated";

grant update on table "public"."contracts" to "authenticated";

grant delete on table "public"."contracts" to "service_role";

grant insert on table "public"."contracts" to "service_role";

grant references on table "public"."contracts" to "service_role";

grant select on table "public"."contracts" to "service_role";

grant trigger on table "public"."contracts" to "service_role";

grant truncate on table "public"."contracts" to "service_role";

grant update on table "public"."contracts" to "service_role";

grant delete on table "public"."deadlines" to "anon";

grant insert on table "public"."deadlines" to "anon";

grant references on table "public"."deadlines" to "anon";

grant select on table "public"."deadlines" to "anon";

grant trigger on table "public"."deadlines" to "anon";

grant truncate on table "public"."deadlines" to "anon";

grant update on table "public"."deadlines" to "anon";

grant delete on table "public"."deadlines" to "authenticated";

grant insert on table "public"."deadlines" to "authenticated";

grant references on table "public"."deadlines" to "authenticated";

grant select on table "public"."deadlines" to "authenticated";

grant trigger on table "public"."deadlines" to "authenticated";

grant truncate on table "public"."deadlines" to "authenticated";

grant update on table "public"."deadlines" to "authenticated";

grant delete on table "public"."deadlines" to "service_role";

grant insert on table "public"."deadlines" to "service_role";

grant references on table "public"."deadlines" to "service_role";

grant select on table "public"."deadlines" to "service_role";

grant trigger on table "public"."deadlines" to "service_role";

grant truncate on table "public"."deadlines" to "service_role";

grant update on table "public"."deadlines" to "service_role";

grant delete on table "public"."document_relationships" to "anon";

grant insert on table "public"."document_relationships" to "anon";

grant references on table "public"."document_relationships" to "anon";

grant select on table "public"."document_relationships" to "anon";

grant trigger on table "public"."document_relationships" to "anon";

grant truncate on table "public"."document_relationships" to "anon";

grant update on table "public"."document_relationships" to "anon";

grant delete on table "public"."document_relationships" to "authenticated";

grant insert on table "public"."document_relationships" to "authenticated";

grant references on table "public"."document_relationships" to "authenticated";

grant select on table "public"."document_relationships" to "authenticated";

grant trigger on table "public"."document_relationships" to "authenticated";

grant truncate on table "public"."document_relationships" to "authenticated";

grant update on table "public"."document_relationships" to "authenticated";

grant delete on table "public"."document_relationships" to "service_role";

grant insert on table "public"."document_relationships" to "service_role";

grant references on table "public"."document_relationships" to "service_role";

grant select on table "public"."document_relationships" to "service_role";

grant trigger on table "public"."document_relationships" to "service_role";

grant truncate on table "public"."document_relationships" to "service_role";

grant update on table "public"."document_relationships" to "service_role";

grant delete on table "public"."embeddings" to "anon";

grant insert on table "public"."embeddings" to "anon";

grant references on table "public"."embeddings" to "anon";

grant select on table "public"."embeddings" to "anon";

grant trigger on table "public"."embeddings" to "anon";

grant truncate on table "public"."embeddings" to "anon";

grant update on table "public"."embeddings" to "anon";

grant delete on table "public"."embeddings" to "authenticated";

grant insert on table "public"."embeddings" to "authenticated";

grant references on table "public"."embeddings" to "authenticated";

grant select on table "public"."embeddings" to "authenticated";

grant trigger on table "public"."embeddings" to "authenticated";

grant truncate on table "public"."embeddings" to "authenticated";

grant update on table "public"."embeddings" to "authenticated";

grant delete on table "public"."embeddings" to "service_role";

grant insert on table "public"."embeddings" to "service_role";

grant references on table "public"."embeddings" to "service_role";

grant select on table "public"."embeddings" to "service_role";

grant trigger on table "public"."embeddings" to "service_role";

grant truncate on table "public"."embeddings" to "service_role";

grant update on table "public"."embeddings" to "service_role";

grant delete on table "public"."entities" to "anon";

grant insert on table "public"."entities" to "anon";

grant references on table "public"."entities" to "anon";

grant select on table "public"."entities" to "anon";

grant trigger on table "public"."entities" to "anon";

grant truncate on table "public"."entities" to "anon";

grant update on table "public"."entities" to "anon";

grant delete on table "public"."entities" to "authenticated";

grant insert on table "public"."entities" to "authenticated";

grant references on table "public"."entities" to "authenticated";

grant select on table "public"."entities" to "authenticated";

grant trigger on table "public"."entities" to "authenticated";

grant truncate on table "public"."entities" to "authenticated";

grant update on table "public"."entities" to "authenticated";

grant delete on table "public"."entities" to "service_role";

grant insert on table "public"."entities" to "service_role";

grant references on table "public"."entities" to "service_role";

grant select on table "public"."entities" to "service_role";

grant trigger on table "public"."entities" to "service_role";

grant truncate on table "public"."entities" to "service_role";

grant update on table "public"."entities" to "service_role";

grant delete on table "public"."entity_relationships" to "anon";

grant insert on table "public"."entity_relationships" to "anon";

grant references on table "public"."entity_relationships" to "anon";

grant select on table "public"."entity_relationships" to "anon";

grant trigger on table "public"."entity_relationships" to "anon";

grant truncate on table "public"."entity_relationships" to "anon";

grant update on table "public"."entity_relationships" to "anon";

grant delete on table "public"."entity_relationships" to "authenticated";

grant insert on table "public"."entity_relationships" to "authenticated";

grant references on table "public"."entity_relationships" to "authenticated";

grant select on table "public"."entity_relationships" to "authenticated";

grant trigger on table "public"."entity_relationships" to "authenticated";

grant truncate on table "public"."entity_relationships" to "authenticated";

grant update on table "public"."entity_relationships" to "authenticated";

grant delete on table "public"."entity_relationships" to "service_role";

grant insert on table "public"."entity_relationships" to "service_role";

grant references on table "public"."entity_relationships" to "service_role";

grant select on table "public"."entity_relationships" to "service_role";

grant trigger on table "public"."entity_relationships" to "service_role";

grant truncate on table "public"."entity_relationships" to "service_role";

grant update on table "public"."entity_relationships" to "service_role";

grant delete on table "public"."expertise_profiles" to "anon";

grant insert on table "public"."expertise_profiles" to "anon";

grant references on table "public"."expertise_profiles" to "anon";

grant select on table "public"."expertise_profiles" to "anon";

grant trigger on table "public"."expertise_profiles" to "anon";

grant truncate on table "public"."expertise_profiles" to "anon";

grant update on table "public"."expertise_profiles" to "anon";

grant delete on table "public"."expertise_profiles" to "authenticated";

grant insert on table "public"."expertise_profiles" to "authenticated";

grant references on table "public"."expertise_profiles" to "authenticated";

grant select on table "public"."expertise_profiles" to "authenticated";

grant trigger on table "public"."expertise_profiles" to "authenticated";

grant truncate on table "public"."expertise_profiles" to "authenticated";

grant update on table "public"."expertise_profiles" to "authenticated";

grant delete on table "public"."expertise_profiles" to "service_role";

grant insert on table "public"."expertise_profiles" to "service_role";

grant references on table "public"."expertise_profiles" to "service_role";

grant select on table "public"."expertise_profiles" to "service_role";

grant trigger on table "public"."expertise_profiles" to "service_role";

grant truncate on table "public"."expertise_profiles" to "service_role";

grant update on table "public"."expertise_profiles" to "service_role";

grant delete on table "public"."judge_patterns" to "anon";

grant insert on table "public"."judge_patterns" to "anon";

grant references on table "public"."judge_patterns" to "anon";

grant select on table "public"."judge_patterns" to "anon";

grant trigger on table "public"."judge_patterns" to "anon";

grant truncate on table "public"."judge_patterns" to "anon";

grant update on table "public"."judge_patterns" to "anon";

grant delete on table "public"."judge_patterns" to "authenticated";

grant insert on table "public"."judge_patterns" to "authenticated";

grant references on table "public"."judge_patterns" to "authenticated";

grant select on table "public"."judge_patterns" to "authenticated";

grant trigger on table "public"."judge_patterns" to "authenticated";

grant truncate on table "public"."judge_patterns" to "authenticated";

grant update on table "public"."judge_patterns" to "authenticated";

grant delete on table "public"."judge_patterns" to "service_role";

grant insert on table "public"."judge_patterns" to "service_role";

grant references on table "public"."judge_patterns" to "service_role";

grant select on table "public"."judge_patterns" to "service_role";

grant trigger on table "public"."judge_patterns" to "service_role";

grant truncate on table "public"."judge_patterns" to "service_role";

grant update on table "public"."judge_patterns" to "service_role";

grant delete on table "public"."judges" to "anon";

grant insert on table "public"."judges" to "anon";

grant references on table "public"."judges" to "anon";

grant select on table "public"."judges" to "anon";

grant trigger on table "public"."judges" to "anon";

grant truncate on table "public"."judges" to "anon";

grant update on table "public"."judges" to "anon";

grant delete on table "public"."judges" to "authenticated";

grant insert on table "public"."judges" to "authenticated";

grant references on table "public"."judges" to "authenticated";

grant select on table "public"."judges" to "authenticated";

grant trigger on table "public"."judges" to "authenticated";

grant truncate on table "public"."judges" to "authenticated";

grant update on table "public"."judges" to "authenticated";

grant delete on table "public"."judges" to "service_role";

grant insert on table "public"."judges" to "service_role";

grant references on table "public"."judges" to "service_role";

grant select on table "public"."judges" to "service_role";

grant trigger on table "public"."judges" to "service_role";

grant truncate on table "public"."judges" to "service_role";

grant update on table "public"."judges" to "service_role";

grant delete on table "public"."legal_arguments" to "anon";

grant insert on table "public"."legal_arguments" to "anon";

grant references on table "public"."legal_arguments" to "anon";

grant select on table "public"."legal_arguments" to "anon";

grant trigger on table "public"."legal_arguments" to "anon";

grant truncate on table "public"."legal_arguments" to "anon";

grant update on table "public"."legal_arguments" to "anon";

grant delete on table "public"."legal_arguments" to "authenticated";

grant insert on table "public"."legal_arguments" to "authenticated";

grant references on table "public"."legal_arguments" to "authenticated";

grant select on table "public"."legal_arguments" to "authenticated";

grant trigger on table "public"."legal_arguments" to "authenticated";

grant truncate on table "public"."legal_arguments" to "authenticated";

grant update on table "public"."legal_arguments" to "authenticated";

grant delete on table "public"."legal_arguments" to "service_role";

grant insert on table "public"."legal_arguments" to "service_role";

grant references on table "public"."legal_arguments" to "service_role";

grant select on table "public"."legal_arguments" to "service_role";

grant trigger on table "public"."legal_arguments" to "service_role";

grant truncate on table "public"."legal_arguments" to "service_role";

grant update on table "public"."legal_arguments" to "service_role";

grant delete on table "public"."market_insights" to "anon";

grant insert on table "public"."market_insights" to "anon";

grant references on table "public"."market_insights" to "anon";

grant select on table "public"."market_insights" to "anon";

grant trigger on table "public"."market_insights" to "anon";

grant truncate on table "public"."market_insights" to "anon";

grant update on table "public"."market_insights" to "anon";

grant delete on table "public"."market_insights" to "authenticated";

grant insert on table "public"."market_insights" to "authenticated";

grant references on table "public"."market_insights" to "authenticated";

grant select on table "public"."market_insights" to "authenticated";

grant trigger on table "public"."market_insights" to "authenticated";

grant truncate on table "public"."market_insights" to "authenticated";

grant update on table "public"."market_insights" to "authenticated";

grant delete on table "public"."market_insights" to "service_role";

grant insert on table "public"."market_insights" to "service_role";

grant references on table "public"."market_insights" to "service_role";

grant select on table "public"."market_insights" to "service_role";

grant trigger on table "public"."market_insights" to "service_role";

grant truncate on table "public"."market_insights" to "service_role";

grant update on table "public"."market_insights" to "service_role";

grant delete on table "public"."opposing_counsel" to "anon";

grant insert on table "public"."opposing_counsel" to "anon";

grant references on table "public"."opposing_counsel" to "anon";

grant select on table "public"."opposing_counsel" to "anon";

grant trigger on table "public"."opposing_counsel" to "anon";

grant truncate on table "public"."opposing_counsel" to "anon";

grant update on table "public"."opposing_counsel" to "anon";

grant delete on table "public"."opposing_counsel" to "authenticated";

grant insert on table "public"."opposing_counsel" to "authenticated";

grant references on table "public"."opposing_counsel" to "authenticated";

grant select on table "public"."opposing_counsel" to "authenticated";

grant trigger on table "public"."opposing_counsel" to "authenticated";

grant truncate on table "public"."opposing_counsel" to "authenticated";

grant update on table "public"."opposing_counsel" to "authenticated";

grant delete on table "public"."opposing_counsel" to "service_role";

grant insert on table "public"."opposing_counsel" to "service_role";

grant references on table "public"."opposing_counsel" to "service_role";

grant select on table "public"."opposing_counsel" to "service_role";

grant trigger on table "public"."opposing_counsel" to "service_role";

grant truncate on table "public"."opposing_counsel" to "service_role";

grant update on table "public"."opposing_counsel" to "service_role";

grant delete on table "public"."organizations" to "anon";

grant insert on table "public"."organizations" to "anon";

grant references on table "public"."organizations" to "anon";

grant select on table "public"."organizations" to "anon";

grant trigger on table "public"."organizations" to "anon";

grant truncate on table "public"."organizations" to "anon";

grant update on table "public"."organizations" to "anon";

grant delete on table "public"."organizations" to "authenticated";

grant insert on table "public"."organizations" to "authenticated";

grant references on table "public"."organizations" to "authenticated";

grant select on table "public"."organizations" to "authenticated";

grant trigger on table "public"."organizations" to "authenticated";

grant truncate on table "public"."organizations" to "authenticated";

grant update on table "public"."organizations" to "authenticated";

grant delete on table "public"."organizations" to "service_role";

grant insert on table "public"."organizations" to "service_role";

grant references on table "public"."organizations" to "service_role";

grant select on table "public"."organizations" to "service_role";

grant trigger on table "public"."organizations" to "service_role";

grant truncate on table "public"."organizations" to "service_role";

grant update on table "public"."organizations" to "service_role";

grant delete on table "public"."precedents" to "anon";

grant insert on table "public"."precedents" to "anon";

grant references on table "public"."precedents" to "anon";

grant select on table "public"."precedents" to "anon";

grant trigger on table "public"."precedents" to "anon";

grant truncate on table "public"."precedents" to "anon";

grant update on table "public"."precedents" to "anon";

grant delete on table "public"."precedents" to "authenticated";

grant insert on table "public"."precedents" to "authenticated";

grant references on table "public"."precedents" to "authenticated";

grant select on table "public"."precedents" to "authenticated";

grant trigger on table "public"."precedents" to "authenticated";

grant truncate on table "public"."precedents" to "authenticated";

grant update on table "public"."precedents" to "authenticated";

grant delete on table "public"."precedents" to "service_role";

grant insert on table "public"."precedents" to "service_role";

grant references on table "public"."precedents" to "service_role";

grant select on table "public"."precedents" to "service_role";

grant trigger on table "public"."precedents" to "service_role";

grant truncate on table "public"."precedents" to "service_role";

grant update on table "public"."precedents" to "service_role";

grant delete on table "public"."predictions" to "anon";

grant insert on table "public"."predictions" to "anon";

grant references on table "public"."predictions" to "anon";

grant select on table "public"."predictions" to "anon";

grant trigger on table "public"."predictions" to "anon";

grant truncate on table "public"."predictions" to "anon";

grant update on table "public"."predictions" to "anon";

grant delete on table "public"."predictions" to "authenticated";

grant insert on table "public"."predictions" to "authenticated";

grant references on table "public"."predictions" to "authenticated";

grant select on table "public"."predictions" to "authenticated";

grant trigger on table "public"."predictions" to "authenticated";

grant truncate on table "public"."predictions" to "authenticated";

grant update on table "public"."predictions" to "authenticated";

grant delete on table "public"."predictions" to "service_role";

grant insert on table "public"."predictions" to "service_role";

grant references on table "public"."predictions" to "service_role";

grant select on table "public"."predictions" to "service_role";

grant trigger on table "public"."predictions" to "service_role";

grant truncate on table "public"."predictions" to "service_role";

grant update on table "public"."predictions" to "service_role";

grant delete on table "public"."reports" to "anon";

grant insert on table "public"."reports" to "anon";

grant references on table "public"."reports" to "anon";

grant select on table "public"."reports" to "anon";

grant trigger on table "public"."reports" to "anon";

grant truncate on table "public"."reports" to "anon";

grant update on table "public"."reports" to "anon";

grant delete on table "public"."reports" to "authenticated";

grant insert on table "public"."reports" to "authenticated";

grant references on table "public"."reports" to "authenticated";

grant select on table "public"."reports" to "authenticated";

grant trigger on table "public"."reports" to "authenticated";

grant truncate on table "public"."reports" to "authenticated";

grant update on table "public"."reports" to "authenticated";

grant delete on table "public"."reports" to "service_role";

grant insert on table "public"."reports" to "service_role";

grant references on table "public"."reports" to "service_role";

grant select on table "public"."reports" to "service_role";

grant trigger on table "public"."reports" to "service_role";

grant truncate on table "public"."reports" to "service_role";

grant update on table "public"."reports" to "service_role";

grant delete on table "public"."sentiment_analyses" to "anon";

grant insert on table "public"."sentiment_analyses" to "anon";

grant references on table "public"."sentiment_analyses" to "anon";

grant select on table "public"."sentiment_analyses" to "anon";

grant trigger on table "public"."sentiment_analyses" to "anon";

grant truncate on table "public"."sentiment_analyses" to "anon";

grant update on table "public"."sentiment_analyses" to "anon";

grant delete on table "public"."sentiment_analyses" to "authenticated";

grant insert on table "public"."sentiment_analyses" to "authenticated";

grant references on table "public"."sentiment_analyses" to "authenticated";

grant select on table "public"."sentiment_analyses" to "authenticated";

grant trigger on table "public"."sentiment_analyses" to "authenticated";

grant truncate on table "public"."sentiment_analyses" to "authenticated";

grant update on table "public"."sentiment_analyses" to "authenticated";

grant delete on table "public"."sentiment_analyses" to "service_role";

grant insert on table "public"."sentiment_analyses" to "service_role";

grant references on table "public"."sentiment_analyses" to "service_role";

grant select on table "public"."sentiment_analyses" to "service_role";

grant trigger on table "public"."sentiment_analyses" to "service_role";

grant truncate on table "public"."sentiment_analyses" to "service_role";

grant update on table "public"."sentiment_analyses" to "service_role";

grant delete on table "public"."settlement_analyses" to "anon";

grant insert on table "public"."settlement_analyses" to "anon";

grant references on table "public"."settlement_analyses" to "anon";

grant select on table "public"."settlement_analyses" to "anon";

grant trigger on table "public"."settlement_analyses" to "anon";

grant truncate on table "public"."settlement_analyses" to "anon";

grant update on table "public"."settlement_analyses" to "anon";

grant delete on table "public"."settlement_analyses" to "authenticated";

grant insert on table "public"."settlement_analyses" to "authenticated";

grant references on table "public"."settlement_analyses" to "authenticated";

grant select on table "public"."settlement_analyses" to "authenticated";

grant trigger on table "public"."settlement_analyses" to "authenticated";

grant truncate on table "public"."settlement_analyses" to "authenticated";

grant update on table "public"."settlement_analyses" to "authenticated";

grant delete on table "public"."settlement_analyses" to "service_role";

grant insert on table "public"."settlement_analyses" to "service_role";

grant references on table "public"."settlement_analyses" to "service_role";

grant select on table "public"."settlement_analyses" to "service_role";

grant trigger on table "public"."settlement_analyses" to "service_role";

grant truncate on table "public"."settlement_analyses" to "service_role";

grant update on table "public"."settlement_analyses" to "service_role";

grant delete on table "public"."strategy_simulations" to "anon";

grant insert on table "public"."strategy_simulations" to "anon";

grant references on table "public"."strategy_simulations" to "anon";

grant select on table "public"."strategy_simulations" to "anon";

grant trigger on table "public"."strategy_simulations" to "anon";

grant truncate on table "public"."strategy_simulations" to "anon";

grant update on table "public"."strategy_simulations" to "anon";

grant delete on table "public"."strategy_simulations" to "authenticated";

grant insert on table "public"."strategy_simulations" to "authenticated";

grant references on table "public"."strategy_simulations" to "authenticated";

grant select on table "public"."strategy_simulations" to "authenticated";

grant trigger on table "public"."strategy_simulations" to "authenticated";

grant truncate on table "public"."strategy_simulations" to "authenticated";

grant update on table "public"."strategy_simulations" to "authenticated";

grant delete on table "public"."strategy_simulations" to "service_role";

grant insert on table "public"."strategy_simulations" to "service_role";

grant references on table "public"."strategy_simulations" to "service_role";

grant select on table "public"."strategy_simulations" to "service_role";

grant trigger on table "public"."strategy_simulations" to "service_role";

grant truncate on table "public"."strategy_simulations" to "service_role";

grant update on table "public"."strategy_simulations" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."team_members" to "anon";

grant insert on table "public"."team_members" to "anon";

grant references on table "public"."team_members" to "anon";

grant select on table "public"."team_members" to "anon";

grant trigger on table "public"."team_members" to "anon";

grant truncate on table "public"."team_members" to "anon";

grant update on table "public"."team_members" to "anon";

grant delete on table "public"."team_members" to "authenticated";

grant insert on table "public"."team_members" to "authenticated";

grant references on table "public"."team_members" to "authenticated";

grant select on table "public"."team_members" to "authenticated";

grant trigger on table "public"."team_members" to "authenticated";

grant truncate on table "public"."team_members" to "authenticated";

grant update on table "public"."team_members" to "authenticated";

grant delete on table "public"."team_members" to "service_role";

grant insert on table "public"."team_members" to "service_role";

grant references on table "public"."team_members" to "service_role";

grant select on table "public"."team_members" to "service_role";

grant trigger on table "public"."team_members" to "service_role";

grant truncate on table "public"."team_members" to "service_role";

grant update on table "public"."team_members" to "service_role";

grant delete on table "public"."witness_analyses" to "anon";

grant insert on table "public"."witness_analyses" to "anon";

grant references on table "public"."witness_analyses" to "anon";

grant select on table "public"."witness_analyses" to "anon";

grant trigger on table "public"."witness_analyses" to "anon";

grant truncate on table "public"."witness_analyses" to "anon";

grant update on table "public"."witness_analyses" to "anon";

grant delete on table "public"."witness_analyses" to "authenticated";

grant insert on table "public"."witness_analyses" to "authenticated";

grant references on table "public"."witness_analyses" to "authenticated";

grant select on table "public"."witness_analyses" to "authenticated";

grant trigger on table "public"."witness_analyses" to "authenticated";

grant truncate on table "public"."witness_analyses" to "authenticated";

grant update on table "public"."witness_analyses" to "authenticated";

grant delete on table "public"."witness_analyses" to "service_role";

grant insert on table "public"."witness_analyses" to "service_role";

grant references on table "public"."witness_analyses" to "service_role";

grant select on table "public"."witness_analyses" to "service_role";

grant trigger on table "public"."witness_analyses" to "service_role";

grant truncate on table "public"."witness_analyses" to "service_role";

grant update on table "public"."witness_analyses" to "service_role";


  create policy "Users can review actions for their agents"
  on "public"."agent_actions"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.ai_agents a
  WHERE ((a.id = agent_actions.agent_id) AND (a.user_id = auth.uid())))));



  create policy "Users can view actions for their agents"
  on "public"."agent_actions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.ai_agents a
  WHERE ((a.id = agent_actions.agent_id) AND (a.user_id = auth.uid())))));



  create policy "Users can create feedback for their agents"
  on "public"."agent_feedback"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view feedback for their agents"
  on "public"."agent_feedback"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own agents"
  on "public"."ai_agents"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own agents"
  on "public"."ai_agents"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own agents"
  on "public"."ai_agents"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own agents"
  on "public"."ai_agents"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own AI jobs"
  on "public"."ai_jobs"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own AI jobs"
  on "public"."ai_jobs"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own AI jobs"
  on "public"."ai_jobs"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own AI usage"
  on "public"."ai_usage_logs"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own audit logs"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own billing records"
  on "public"."billing_records"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own billing records"
  on "public"."billing_records"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own billing records"
  on "public"."billing_records"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Collaborators can view cases they're added to"
  on "public"."case_collaborators"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own case events"
  on "public"."case_events"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own case events"
  on "public"."case_events"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own case events"
  on "public"."case_events"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own case events"
  on "public"."case_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own case insights"
  on "public"."case_insights"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own case insights"
  on "public"."case_insights"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own case insights"
  on "public"."case_insights"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own case insights"
  on "public"."case_insights"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own case precedents"
  on "public"."case_precedents"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own case precedents"
  on "public"."case_precedents"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own case precedents"
  on "public"."case_precedents"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Collaborators can view cases"
  on "public"."cases"
  as permissive
  for select
  to public
using ((id IN ( SELECT case_collaborators.case_id
   FROM public.case_collaborators
  WHERE (case_collaborators.user_id = auth.uid()))));



  create policy "Team members can view shared cases"
  on "public"."cases"
  as permissive
  for select
  to public
using (((visibility = ANY (ARRAY['team'::text, 'organization'::text])) AND (organization_id IN ( SELECT team_members.organization_id
   FROM public.team_members
  WHERE (team_members.user_id = auth.uid())))));



  create policy "Users can create own cases"
  on "public"."cases"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own cases"
  on "public"."cases"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own cases"
  on "public"."cases"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own cases"
  on "public"."cases"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own client interactions"
  on "public"."client_interactions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own client interactions"
  on "public"."client_interactions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own client interactions"
  on "public"."client_interactions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create comments on accessible entities"
  on "public"."comments"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) AND ((case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid()))) OR (case_id IN ( SELECT case_collaborators.case_id
   FROM public.case_collaborators
  WHERE (case_collaborators.user_id = auth.uid()))))));



  create policy "Users can view comments on accessible entities"
  on "public"."comments"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.user_id = auth.uid()))) OR (case_id IN ( SELECT case_collaborators.case_id
   FROM public.case_collaborators
  WHERE (case_collaborators.user_id = auth.uid())))));



  create policy "Users can create own competitive cases"
  on "public"."competitive_cases"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own competitive cases"
  on "public"."competitive_cases"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own competitive cases"
  on "public"."competitive_cases"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own compliance checks"
  on "public"."compliance_checks"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own compliance checks"
  on "public"."compliance_checks"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own compliance checks"
  on "public"."compliance_checks"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own contracts"
  on "public"."contracts"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own contracts"
  on "public"."contracts"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own contracts"
  on "public"."contracts"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own deadlines"
  on "public"."deadlines"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own deadlines"
  on "public"."deadlines"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own deadlines"
  on "public"."deadlines"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own deadlines"
  on "public"."deadlines"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create document relationships for their documents"
  on "public"."document_relationships"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_relationships.source_document_id) AND (d.user_id = auth.uid())))));



  create policy "Users can delete document relationships for their documents"
  on "public"."document_relationships"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_relationships.source_document_id) AND (d.user_id = auth.uid())))));



  create policy "Users can view document relationships for their documents"
  on "public"."document_relationships"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_relationships.source_document_id) AND (d.user_id = auth.uid())))));



  create policy "Users can create own documents"
  on "public"."documents"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own documents"
  on "public"."documents"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own documents"
  on "public"."documents"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own documents"
  on "public"."documents"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own embeddings"
  on "public"."embeddings"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own embeddings"
  on "public"."embeddings"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own embeddings"
  on "public"."embeddings"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own embeddings"
  on "public"."embeddings"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own expertise"
  on "public"."expertise_profiles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own legal arguments"
  on "public"."legal_arguments"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own legal arguments"
  on "public"."legal_arguments"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own legal arguments"
  on "public"."legal_arguments"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own predictions"
  on "public"."predictions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own predictions"
  on "public"."predictions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own predictions"
  on "public"."predictions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own predictions"
  on "public"."predictions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "Users can create own reports"
  on "public"."reports"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view own reports"
  on "public"."reports"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own sentiment analyses"
  on "public"."sentiment_analyses"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view own sentiment analyses"
  on "public"."sentiment_analyses"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own settlement analyses"
  on "public"."settlement_analyses"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own settlement analyses"
  on "public"."settlement_analyses"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own settlement analyses"
  on "public"."settlement_analyses"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own strategy simulations"
  on "public"."strategy_simulations"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own strategy simulations"
  on "public"."strategy_simulations"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own strategy simulations"
  on "public"."strategy_simulations"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create own tasks"
  on "public"."tasks"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete own tasks"
  on "public"."tasks"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own tasks"
  on "public"."tasks"
  as permissive
  for update
  to public
using (((auth.uid() = user_id) OR (auth.uid() = assigned_to)));



  create policy "Users can view own tasks"
  on "public"."tasks"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR (auth.uid() = assigned_to)));



  create policy "Team members can view own team"
  on "public"."team_members"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR (organization_id IN ( SELECT team_members_1.organization_id
   FROM public.team_members team_members_1
  WHERE (team_members_1.user_id = auth.uid())))));



  create policy "Users can create own witness analyses"
  on "public"."witness_analyses"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own witness analyses"
  on "public"."witness_analyses"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own witness analyses"
  on "public"."witness_analyses"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER set_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_ai_jobs_updated_at BEFORE UPDATE ON public.ai_jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_billing_records_updated_at BEFORE UPDATE ON public.billing_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_case_events_updated_at BEFORE UPDATE ON public.case_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_case_insights_updated_at BEFORE UPDATE ON public.case_insights FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_case_precedents_updated_at BEFORE UPDATE ON public.case_precedents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER audit_case_changes AFTER INSERT OR DELETE OR UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

CREATE TRIGGER check_case_limits BEFORE INSERT ON public.cases FOR EACH ROW EXECUTE FUNCTION public.check_organization_limits();

CREATE TRIGGER set_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_client_interactions_updated_at BEFORE UPDATE ON public.client_interactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_competitive_cases_updated_at BEFORE UPDATE ON public.competitive_cases FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_compliance_rules_updated_at BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER auto_complete_tasks_on_deadline AFTER UPDATE ON public.deadlines FOR EACH ROW EXECUTE FUNCTION public.auto_complete_deadline_tasks();

CREATE TRIGGER set_deadlines_updated_at BEFORE UPDATE ON public.deadlines FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_case_on_deadline_change AFTER INSERT OR DELETE OR UPDATE ON public.deadlines FOR EACH ROW EXECUTE FUNCTION public.update_case_timestamp();

CREATE TRIGGER audit_document_changes AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_action();

CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_case_on_document_change AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_case_timestamp();

CREATE TRIGGER set_embeddings_updated_at BEFORE UPDATE ON public.embeddings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_entities_updated_at BEFORE UPDATE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_judge_patterns_updated_at BEFORE UPDATE ON public.judge_patterns FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_legal_arguments_updated_at BEFORE UPDATE ON public.legal_arguments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_opposing_counsel_updated_at BEFORE UPDATE ON public.opposing_counsel FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_predictions_updated_at BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_sentiment_analyses_updated_at BEFORE UPDATE ON public.sentiment_analyses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_settlement_analyses_updated_at BEFORE UPDATE ON public.settlement_analyses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_strategy_simulations_updated_at BEFORE UPDATE ON public.strategy_simulations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_case_on_task_change AFTER INSERT OR DELETE OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_case_timestamp();

CREATE TRIGGER check_team_member_limits BEFORE INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.check_organization_limits();

CREATE TRIGGER set_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_witness_analyses_updated_at BEFORE UPDATE ON public.witness_analyses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

drop policy "Users can delete their own case documents" on "storage"."objects";

drop policy "Users can delete their own documents" on "storage"."objects";

drop policy "Users can update their own case documents" on "storage"."objects";

drop policy "Users can update their own documents" on "storage"."objects";

drop policy "Users can upload their own case documents" on "storage"."objects";

drop policy "Users can upload to their own folders" on "storage"."objects";

drop policy "Users can view their own case documents" on "storage"."objects";


  create policy "Users can delete own documents"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'case-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload own documents"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'case-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can view own documents"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'case-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



