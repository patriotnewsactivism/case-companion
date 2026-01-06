-- Force backend API to reload its schema cache (fixes "column ... not found in the schema cache" errors)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
