-- 011_audit_quiet_mode.sql
--
-- Cut audit-log noise so the Supabase free tier doesn't fill up.
--
-- BEFORE: every judge autosave fired UPDATE on `scores` AND `scoresheets` (for
-- the `updated_at` bump), each one writing a full before/after JSON row to
-- audit_log. A typical event with 45 scoresheets × 20 criteria × ~10 edits
-- each produced ~9,000+ audit rows that were 95 % keystroke-by-keystroke
-- noise nobody ever reads.
--
-- AFTER: we keep all admin-significant events (user/school/participant CRUD,
-- DQ flags, event lock/unlock, score overrides, scoresheet status transitions)
-- and drop the autosave chatter. Expected per-event volume drops from
-- ~10,000 rows to ~1,500 rows — same audit value, ~7× less storage.
--
-- Also adds three enum values (`*_delete`) that were missing — without them
-- CASCADE deletes (and manual cleanup) fail with "invalid input value for
-- enum audit_action".
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add the missing audit_action enum values for DELETE on noisy tables.
--    `ALTER TYPE ... ADD VALUE` cannot run in a multi-statement transaction
--    block in older Postgres, so wrap each in its own DO block.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumtypid = 'audit_action'::regtype AND enumlabel = 'user_delete'
  ) THEN
    ALTER TYPE audit_action ADD VALUE 'user_delete';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumtypid = 'audit_action'::regtype AND enumlabel = 'score_delete'
  ) THEN
    ALTER TYPE audit_action ADD VALUE 'score_delete';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumtypid = 'audit_action'::regtype AND enumlabel = 'scoresheet_delete'
  ) THEN
    ALTER TYPE audit_action ADD VALUE 'scoresheet_delete';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Replace the noisy scoresheet trigger with one that only fires on real
--    status transitions (draft → submitted → finalised, unlock).
--    DROP both the old single name AND the new split names so this is safe
--    to re-run.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_scoresheets         ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scoresheets_ins     ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scoresheets_del     ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scoresheets_status  ON scoresheets;

CREATE TRIGGER trg_audit_scoresheets_ins
  AFTER INSERT ON scoresheets
  FOR EACH ROW EXECUTE FUNCTION audit_row('scoresheet');

CREATE TRIGGER trg_audit_scoresheets_del
  AFTER DELETE ON scoresheets
  FOR EACH ROW EXECUTE FUNCTION audit_row('scoresheet');

CREATE TRIGGER trg_audit_scoresheets_status
  AFTER UPDATE ON scoresheets
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION audit_row('scoresheet');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Replace the noisy scores trigger with one that only fires on the FIRST
--    creation of a score row and on super_admin overrides.
--    (Routine autosave edits by a judge on their own draft are not audited.)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_scores           ON scores;
DROP TRIGGER IF EXISTS trg_audit_scores_ins       ON scores;
DROP TRIGGER IF EXISTS trg_audit_scores_del       ON scores;
DROP TRIGGER IF EXISTS trg_audit_scores_override  ON scores;

CREATE TRIGGER trg_audit_scores_ins
  AFTER INSERT ON scores
  FOR EACH ROW EXECUTE FUNCTION audit_row('score');

CREATE TRIGGER trg_audit_scores_del
  AFTER DELETE ON scores
  FOR EACH ROW EXECUTE FUNCTION audit_row('score');

CREATE TRIGGER trg_audit_scores_override
  AFTER UPDATE ON scores
  FOR EACH ROW
  WHEN (
    NEW.is_override IS DISTINCT FROM OLD.is_override
    OR (NEW.is_override = true AND (
      NEW.points IS DISTINCT FROM OLD.points
      OR NEW.level  IS DISTINCT FROM OLD.level
    ))
  )
  EXECUTE FUNCTION audit_row('score');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Retention helper (no schedule attached — call manually after each event
--    or wire to a cron). audit_log has a "no UPDATE/DELETE" trigger from
--    008_security_fixes.sql; the session var `app.allow_audit_mutation` is
--    the documented escape hatch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_prune(older_than interval DEFAULT INTERVAL '180 days')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted bigint;
BEGIN
  PERFORM set_config('app.allow_audit_mutation', 'on', true);
  DELETE FROM audit_log WHERE at < now() - older_than;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION audit_log_prune(interval) IS
  'Delete audit_log rows older than the given interval (default 180 days). Returns the row count. Call as: SELECT audit_log_prune(INTERVAL ''90 days'');';
