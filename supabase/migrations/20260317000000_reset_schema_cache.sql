-- Reset PostgREST schema cache so new database changes are recognized immediately
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
