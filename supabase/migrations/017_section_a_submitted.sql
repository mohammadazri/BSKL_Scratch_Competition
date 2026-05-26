-- 017_section_a_submitted.sql
--
-- Per-judge "I'm done with Section A" marker. The whole scoresheet's
-- `status` (draft / submitted / finalised) still tracks the overall final
-- submission at the end of Section B — this new column is a soft lock
-- the judge can flip when they finish their pre-event scoring so they
-- can't accidentally edit Section A later.
--
-- Phase-locking (the admin moving the event from section_a → section_b)
-- is the hard lock. This column is the per-judge equivalent. The app
-- treats Section A as read-only for a given judge if either:
--   - event_state.phase != 'section_a', or
--   - the scoresheet has section_a_submitted_at set.
--
-- Safe to re-run.

ALTER TABLE scoresheets
  ADD COLUMN IF NOT EXISTS section_a_submitted_at timestamptz;
