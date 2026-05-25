-- 006_rls.sql
-- Enable RLS on every table and install the full policy set from
-- SCHEMA.md § Policy summary.
--
-- Rules of thumb:
--   • SELECT policies use can_read_all() to give super_admin + viewer read-all
--     in one go.
--   • super_admin gets a FOR ALL policy on every mutable table.
--   • Judges get scoped INSERT/UPDATE/DELETE only on the data they own.
--   • audit_log gets SELECT-only policies (no insert/update/delete).
--   • criteria + criterion_levels get SELECT-only to authenticated; the seed
--     loader runs against the service role and bypasses RLS.
--   • DROP POLICY IF EXISTS makes this migration safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on every table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterion_levels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoresheets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disqualifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_state         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
--   super_admin: all
--   judge:       SELECT self only; UPDATE self (limited cols enforced by API)
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_super_all   ON profiles;
CREATE POLICY profiles_super_all ON profiles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS profiles_read       ON profiles;
CREATE POLICY profiles_read ON profiles
  FOR SELECT TO authenticated
  USING (can_read_all() OR id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- schools
--   super_admin: all
--   judge:       SELECT all (for display)
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS schools_super_all ON schools;
CREATE POLICY schools_super_all ON schools
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS schools_read       ON schools;
CREATE POLICY schools_read ON schools
  FOR SELECT TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- participants
--   super_admin: all
--   judge:       SELECT assigned only
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS participants_super_all ON participants;
CREATE POLICY participants_super_all ON participants
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS participants_read     ON participants;
CREATE POLICY participants_read ON participants
  FOR SELECT TO authenticated
  USING (
    can_read_all()
    OR EXISTS (
      SELECT 1 FROM assignments a
       WHERE a.participant_id = participants.id AND a.judge_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- criteria / criterion_levels
--   All authenticated users can SELECT (rubric reference data).
--   No write policies — only the seed loader (service role) populates them.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS criteria_read ON criteria;
CREATE POLICY criteria_read ON criteria
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS criterion_levels_read ON criterion_levels;
CREATE POLICY criterion_levels_read ON criterion_levels
  FOR SELECT TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- assignments
--   super_admin: all
--   judge:       SELECT self only
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS assignments_super_all ON assignments;
CREATE POLICY assignments_super_all ON assignments
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS assignments_read       ON assignments;
CREATE POLICY assignments_read ON assignments
  FOR SELECT TO authenticated
  USING (can_read_all() OR judge_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- scoresheets
--   super_admin: all (no DELETE per matrix, but FOR ALL covers it; delete is
--                blocked at the application layer / not exposed in UI)
--   judge:       SELECT own only; INSERT own as draft when assigned & not
--                locked; UPDATE own draft (with optional transition to
--                submitted); no DELETE
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS scoresheets_super_all ON scoresheets;
CREATE POLICY scoresheets_super_all ON scoresheets
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS scoresheets_read     ON scoresheets;
CREATE POLICY scoresheets_read ON scoresheets
  FOR SELECT TO authenticated
  USING (can_read_all() OR judge_id = auth.uid());

DROP POLICY IF EXISTS scoresheets_judge_insert ON scoresheets;
CREATE POLICY scoresheets_judge_insert ON scoresheets
  FOR INSERT TO authenticated
  WITH CHECK (
    judge_id = auth.uid()
    AND status = 'draft'
    AND NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM assignments a
       WHERE a.participant_id = scoresheets.participant_id AND a.judge_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS scoresheets_judge_update ON scoresheets;
CREATE POLICY scoresheets_judge_update ON scoresheets
  FOR UPDATE TO authenticated
  USING (judge_id = auth.uid() AND status = 'draft' AND NOT is_event_locked())
  WITH CHECK (
    judge_id = auth.uid()
    AND status IN ('draft','submitted')
    AND NOT is_event_locked()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- scores
--   super_admin: all (including overrides)
--   judge:       SELECT own scoresheet; INSERT/UPDATE/DELETE on own draft
--                scoresheets only, while event is unlocked
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS scores_super_all ON scores;
CREATE POLICY scores_super_all ON scores
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS scores_read     ON scores;
CREATE POLICY scores_read ON scores
  FOR SELECT TO authenticated
  USING (
    can_read_all()
    OR EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = scores.scoresheet_id AND s.judge_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS scores_judge_insert ON scores;
CREATE POLICY scores_judge_insert ON scores
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = scores.scoresheet_id
         AND s.judge_id = auth.uid()
         AND s.status = 'draft'
    )
  );

DROP POLICY IF EXISTS scores_judge_update ON scores;
CREATE POLICY scores_judge_update ON scores
  FOR UPDATE TO authenticated
  USING (
    NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = scores.scoresheet_id
         AND s.judge_id = auth.uid()
         AND s.status = 'draft'
    )
  )
  WITH CHECK (
    NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = scores.scoresheet_id
         AND s.judge_id = auth.uid()
         AND s.status = 'draft'
    )
  );

DROP POLICY IF EXISTS scores_judge_delete ON scores;
CREATE POLICY scores_judge_delete ON scores
  FOR DELETE TO authenticated
  USING (
    NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = scores.scoresheet_id
         AND s.judge_id = auth.uid()
         AND s.status = 'draft'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- disqualifications
--   super_admin: all
--   judge:       SELECT own scoresheet; INSERT own (raise flag); no UPDATE/DELETE
--   viewer:      SELECT all
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS disqualifications_super_all ON disqualifications;
CREATE POLICY disqualifications_super_all ON disqualifications
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS disqualifications_read ON disqualifications;
CREATE POLICY disqualifications_read ON disqualifications
  FOR SELECT TO authenticated
  USING (
    can_read_all()
    OR EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = disqualifications.scoresheet_id AND s.judge_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS disqualifications_judge_insert ON disqualifications;
CREATE POLICY disqualifications_judge_insert ON disqualifications
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by = auth.uid()
    AND NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM scoresheets s
       WHERE s.id = disqualifications.scoresheet_id AND s.judge_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- event_state
--   super_admin: SELECT + UPDATE
--   judge:       SELECT
--   viewer:      SELECT
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS event_state_super_all ON event_state;
CREATE POLICY event_state_super_all ON event_state
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS event_state_read ON event_state;
CREATE POLICY event_state_read ON event_state
  FOR SELECT TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log — APPEND-ONLY
--   super_admin + viewer: SELECT all
--   judge:                SELECT own actions only
--   NO insert/update/delete policy → blocked for every role.
--   audit_row() runs SECURITY DEFINER and inserts as table owner, bypassing RLS.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_log_read_all       ON audit_log;
CREATE POLICY audit_log_read_all ON audit_log
  FOR SELECT TO authenticated
  USING (can_read_all());

DROP POLICY IF EXISTS audit_log_judge_self_read ON audit_log;
CREATE POLICY audit_log_judge_self_read ON audit_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());
