-- 015_event_phase_and_section.sql
--
-- Step 2 of the registration_committee + section A/B rollout. Runs in a
-- separate transaction from 012 so the new `registration_committee` enum
-- value is committed and usable.
--
-- This migration adds:
--   * `event_phase` enum + `event_state.phase` column
--   * `assignments.section` column (so different judges can score Section A
--     vs Section B for the same participant)
--   * `is_registration_committee()` helper
--   * RLS policies that give registration_committee full CRUD on schools +
--     participants (already inherits SELECT on criteria from the
--     "TO authenticated USING (true)" policy)
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Event phase enum + column.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_phase') THEN
    CREATE TYPE event_phase AS ENUM ('setup', 'section_a', 'section_b', 'finalised');
  END IF;
END $$;

ALTER TABLE event_state
  ADD COLUMN IF NOT EXISTS phase event_phase NOT NULL DEFAULT 'setup';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Section column on assignments + per-(participant, section) uniqueness.
--    Default 'B' so existing rows count as Section B (event-day) assignments.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS section section NOT NULL DEFAULT 'B';

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_participant_id_key;
DROP INDEX IF EXISTS assignments_participant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_participant_section_key
  ON assignments (participant_id, section);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registration committee RLS helper + policies.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_registration_committee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_role_is('registration_committee');
$$;

-- schools: registration_committee gets full CRUD (super_admin already does)
DROP POLICY IF EXISTS schools_registration_all ON schools;
CREATE POLICY schools_registration_all ON schools
  FOR ALL TO authenticated
  USING (is_registration_committee())
  WITH CHECK (is_registration_committee());

-- participants: full CRUD
DROP POLICY IF EXISTS participants_registration_all ON participants;
CREATE POLICY participants_registration_all ON participants
  FOR ALL TO authenticated
  USING (is_registration_committee())
  WITH CHECK (is_registration_committee());

-- criteria + criterion_levels already have SELECT TO authenticated USING (true)
-- so registration_committee can read them without an extra policy.
