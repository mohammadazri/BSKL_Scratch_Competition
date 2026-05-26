-- 008_security_fixes.sql
--
-- Security hardening pass before the live event. Three concerns addressed:
--
--   1. `profiles_self_update` was scoped to (id = auth.uid()) on both USING
--      and WITH CHECK — which let any judge update their OWN profile row.
--      Because no column-level grant restricted WHICH columns they could touch,
--      a judge could `UPDATE profiles SET role='super_admin' WHERE id=auth.uid()`
--      via a direct PostgREST call and escalate to super_admin. Fix by dropping
--      the row-level UPDATE policy entirely — there is no UI for self-edit
--      anyway, and `/admin/users` (super_admin) is the canonical edit path.
--      If a self-edit UI is added later, re-introduce a policy that allows
--      only `full_name` / `pin_label` to change (Postgres has no native
--      column-level WITH CHECK, so the safer pattern is a SECURITY DEFINER
--      function `update_my_display_name(text)` rather than a broad policy).
--
--   2. `scoresheets.live_sprint_time_seconds` allowed `0`, but a 0-second
--      sprint would auto-win any tiebreaker (`live_sprint_time_seconds ASC
--      NULLS LAST` puts 0 first). A clean Phase 2 sprint cannot complete in
--      zero seconds. Tighten the CHECK to `> 0`.
--
--   3. `audit_log` had no INSERT/UPDATE/DELETE policy, which under RLS means
--      no role can perform those operations through PostgREST. Trigger inserts
--      via SECURITY DEFINER still work. Add explicit REVOKE statements so the
--      intent ("audit_log is append-only via trigger only") is in the schema
--      and survives any future "let's grant TRUNCATE temporarily" mishap.
--
-- This migration is safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop the over-broad self-update policy on profiles.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_self_update ON profiles;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tighten the sprint-time CHECK.
--    Postgres needs the constraint dropped + recreated (no ALTER CHECK).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'scoresheets'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%live_sprint_time_seconds%'
  LOOP
    EXECUTE format('ALTER TABLE scoresheets DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE scoresheets
  ADD CONSTRAINT scoresheets_sprint_seconds_check
  CHECK (
    live_sprint_time_seconds IS NULL
    OR (live_sprint_time_seconds > 0 AND live_sprint_time_seconds <= 2700)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Belt-and-suspenders on audit_log: revoke direct DML from authenticated +
--    anon roles. Trigger writes still work because audit_row() is SECURITY
--    DEFINER (runs as the table owner, typically `postgres`).
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Defence-in-depth: trigger that bars any UPDATE/DELETE/TRUNCATE on
--    audit_log even from a future SECURITY DEFINER function that might be
--    added by mistake. Raises an exception unless explicitly bypassed via
--    session var `app.allow_audit_mutation` = 'on' (intentional DBA-only
--    escape hatch for emergency manual cleanup).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_block_mutations() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_audit_mutation', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_log is append-only — % blocked', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutations();

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutations();
