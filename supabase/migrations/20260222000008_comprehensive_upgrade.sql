-- Comprehensive Upgrade Migration (No-op)
--
-- This project applies feature migrations individually via:
-- 20260222000000 through 20260222000007 and 20260222000009.
--
-- The previous composite script duplicated those objects and used
-- non-portable DDL that fails on this Postgres version.
-- Keep this migration as a no-op to preserve migration ordering.

DO $$
BEGIN
  RAISE NOTICE 'Skipping composite migration 20260222000008: superseded by granular migrations.';
END;
$$;

NOTIFY pgrst, 'reload schema';
