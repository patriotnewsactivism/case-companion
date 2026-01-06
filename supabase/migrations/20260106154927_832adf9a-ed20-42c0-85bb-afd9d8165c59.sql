-- Reload backend schema cache so new columns (e.g. cases.case_type) are recognized immediately
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;