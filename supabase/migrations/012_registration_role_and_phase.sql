-- 012_registration_role_and_phase.sql
--
-- Phase 1 of the registration-committee + section A/B split rollout.
--
-- Adds:
--   1. New role `registration_committee` — pre-event school + participant
--      management only. No scoring, no audit log access.
--   2. New enum `event_phase` and `event_state.phase` column:
--          setup       → admins only; no scoring
--          section_a   → judges can score Section A criteria only
--          section_b   → judges can score Section B criteria only;
--                        Section A scores visible as read-only reference
--          finalised   → everything locked, view-only
--   3. New column `assignments.section` so different judges can be assigned
--      per section (Section A judges and Section B judges may differ).
--      Default 'B' preserves the existing model where existing rows count as
--      Section B (event-day) assignments.
--   4. Schema-wide RLS policies for registration_committee on schools +
--      participants (full CRUD) and read-only on criteria.
--
-- Phase 2 (separate migration) will wire the judge scoring UI to filter
-- criteria by `event_state.phase` and the per-section assignment lookup.
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add 'registration_committee' to user_role enum.
--    ALTER TYPE ADD VALUE cannot run inside an implicit transaction that
--    also references the new value, so it gets its own DO block.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'registration_committee'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'registration_committee';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Event phase enum + column.
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
-- 3. Add section column to assignments.
--    Default 'B' for existing rows so the current event-day assignments still
--    work as Section B assignments. New rows must specify.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS section section NOT NULL DEFAULT 'B';

-- The original unique constraint was on participant_id alone (one judge per
-- participant). With per-section judging, we now allow (and require) one judge
-- per (participant, section). Drop the old unique index if it exists from the
-- original schema and replace with the section-aware version.
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_participant_id_key;
DROP INDEX IF EXISTS assignments_participant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_participant_section_key
  ON assignments (participant_id, section);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS helper for registration_committee.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS policies — registration_committee can fully manage schools and
--    participants. They get SELECT on criteria for context. They can SELECT
--    their own profile row (already covered by the existing profiles_read
--    policy: `id = auth.uid()`).
-- ─────────────────────────────────────────────────────────────────────────────

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
