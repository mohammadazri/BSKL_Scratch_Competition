-- 018_edit_requests.sql
--
-- Judges can request edit access on a locked scoresheet (either after they
-- submitted Section A or after final submission). Super-admin reviews the
-- request and approves or denies it from /admin/requests.
--
-- Approve flow:
--   • If the lock was section_a_submitted_at, the admin's approval clears it.
--   • If the lock was status='submitted' (final), approval flips status back
--     to 'draft' so the judge can edit again.
--   • Either way the request row gets status='approved', resolved_at, and
--     resolved_by stamped. The judge sees the unlock on next page load.
--
-- Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'edit_request_status') THEN
    CREATE TYPE edit_request_status AS ENUM ('pending', 'approved', 'denied');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS edit_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoresheet_id  uuid NOT NULL REFERENCES scoresheets(id) ON DELETE CASCADE,
  requested_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason         text NOT NULL,
  status         edit_request_status NOT NULL DEFAULT 'pending',
  resolved_by    uuid REFERENCES profiles(id),
  resolved_at    timestamptz,
  resolved_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edit_requests_scoresheet_idx ON edit_requests (scoresheet_id);
CREATE INDEX IF NOT EXISTS edit_requests_status_idx ON edit_requests (status);
CREATE INDEX IF NOT EXISTS edit_requests_requested_by_idx ON edit_requests (requested_by);

-- Stop two pending requests existing for the same scoresheet at once.
CREATE UNIQUE INDEX IF NOT EXISTS edit_requests_one_pending_per_sheet
  ON edit_requests (scoresheet_id)
  WHERE status = 'pending';

-- updated_at touch trigger (re-uses the helper from 004_functions.sql).
DROP TRIGGER IF EXISTS trg_edit_requests_updated ON edit_requests;
CREATE TRIGGER trg_edit_requests_updated
  BEFORE UPDATE ON edit_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE edit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edit_requests_super_all ON edit_requests;
CREATE POLICY edit_requests_super_all ON edit_requests
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Judges can SELECT their own requests + INSERT new ones for their own
-- scoresheets. Updates / deletes are admin-only.
DROP POLICY IF EXISTS edit_requests_judge_read ON edit_requests;
CREATE POLICY edit_requests_judge_read ON edit_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

DROP POLICY IF EXISTS edit_requests_judge_insert ON edit_requests;
CREATE POLICY edit_requests_judge_insert ON edit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = scoresheet_id AND s.judge_id = auth.uid()
    )
  );
