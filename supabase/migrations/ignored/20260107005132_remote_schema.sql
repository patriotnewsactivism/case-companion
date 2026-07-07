drop materialized view if exists "public"."case_analytics_summary";

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


CREATE INDEX idx_case_analytics_type ON public.case_analytics_summary USING btree (case_type);

CREATE INDEX idx_case_analytics_user_month ON public.case_analytics_summary USING btree (user_id, month DESC);


