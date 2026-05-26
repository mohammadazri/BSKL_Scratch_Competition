-- 010_fix_rls_recursion.sql
--
-- Fix: "stack depth limit exceeded" on every authenticated query against
-- `profiles`.
--
-- The `profiles_read` RLS policy is `can_read_all() OR id = auth.uid()`.
-- `can_read_all()` calls `is_super_admin()`, which calls `current_role_is()`,
-- which itself runs `SELECT FROM profiles ...`. That inner SELECT is *also*
-- evaluated under RLS, which calls `can_read_all()` again — infinite recursion
-- until Postgres aborts with stack overflow.
--
-- The standard fix is to make the leaf helper function `SECURITY DEFINER`, so
-- the inner profile lookup runs with the function-owner's privileges and skips
-- RLS. We also pin `search_path = public` to prevent search-path-injection.
--
-- Wrapper functions (`is_super_admin`, `is_viewer`, `can_read_all`) inherit
-- the RLS bypass because they only call `current_role_is`.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION current_role_is(target user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = auth.uid() AND role = target AND is_active = true
  );
$$;
