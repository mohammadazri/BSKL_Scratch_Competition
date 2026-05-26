-- 012_registration_role_and_phase.sql
--
-- Step 1 of the registration_committee rollout. We can only ADD the enum
-- value here — using it (in functions, RLS policies, column defaults) has
-- to wait until a later migration runs in a separate transaction, because
-- Postgres enforces "new enum values must be committed before they can be
-- used" (error 55P04, hint at enum.c#97).
--
-- The "_and_phase" suffix is retained for git/log continuity; the actual
-- event_phase + assignments.section + RLS work moved to 015.
--
-- Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'registration_committee'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'registration_committee';
  END IF;
END $$;
