-- 020_disqualification_approval.sql
--
-- Disqualification requests now need explicit super-admin approval before
-- they take effect. The judge raises a request; the participant remains
-- qualified until the admin approves. Approval flips participants.qualified
-- to false; denial leaves the row in place but marks it denied so the
-- audit trail captures the rejection.
--
-- Adds the lifecycle to the existing `disqualifications` table:
--   status: pending → approved → cleared (admin can later re-qualify), or
--           pending → denied (judge appealed and lost).
--
-- The original `cleared_by` / `cleared_reason` columns are now overloaded:
--   - When status='approved', cleared_by means "person who cleared the DQ
--     after approval" (re-qualified the participant).
--   - When status='denied', resolved_by means "person who rejected the DQ".
-- To keep history readable we add fresh approved_by / approved_at columns
-- so each lifecycle step has its own audit fields.
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enum for the new status field.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disqualification_status') THEN
    CREATE TYPE disqualification_status AS ENUM ('pending', 'approved', 'denied', 'cleared');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Columns. Default existing rows to 'approved' since they were already
--    in effect under the old schema (judges marked DQ unilaterally).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE disqualifications
  ADD COLUMN IF NOT EXISTS status disqualification_status NOT NULL DEFAULT 'pending';

UPDATE disqualifications SET status = 'approved' WHERE status = 'pending' AND created_at < now() - INTERVAL '1 minute';

ALTER TABLE disqualifications
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS denied_by   uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS denied_at   timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text;

CREATE INDEX IF NOT EXISTS disqualifications_status_idx ON disqualifications (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Publish disqualifications via Realtime so the admin gets a live ping
--    when a judge raises one (same UX as edit_requests).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'disqualifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE disqualifications';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: existing super_admin policy already covers everything. Judges
--    insert / read their own (already in 006_rls.sql). No new policies
--    needed — the status transitions are app-layer.
-- ─────────────────────────────────────────────────────────────────────────────
