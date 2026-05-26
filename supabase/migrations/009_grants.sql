-- 009_grants.sql
--
-- Grant standard Supabase role privileges on the public schema.
--
-- Why this exists: when you provision Supabase from scratch via the dashboard,
-- Supabase auto-grants these to anon / authenticated / service_role. But when
-- the schema is rebuilt via `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
-- (our nuclear reset path), those auto-grants are gone. Without them, the
-- service-role client gets "permission denied for table profiles" on every
-- query, and the app gets stuck in an infinite /login → / → /login loop.
--
-- RLS still gates access for anon / authenticated. service_role bypasses RLS
-- because PostgREST sets the role to service_role for those requests, and we
-- haven't enabled RLS on that role's GRANTs.
--
-- Safe to re-run.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, anon, authenticated;

-- Cover tables/functions/sequences created in the future as well.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO postgres, service_role, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO postgres, service_role, anon, authenticated;
