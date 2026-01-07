-- Reload PostgREST schema cache to ensure new columns (e.g. cases.case_type) are available
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
