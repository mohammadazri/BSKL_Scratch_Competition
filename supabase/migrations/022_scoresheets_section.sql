-- 022_scoresheets_section.sql
--
-- Multi-judge fairness: a participant can now be scored by DIFFERENT judges
-- for Section A vs Section B. To do that cleanly we move scoresheets from
-- "one row per (participant, judge)" to "one row per (participant, judge,
-- section)". Each scoresheet covers exactly one section.
--
-- Why: the previous schema forced a single judge to score the whole
-- participant. Re-assigning a participant to a new judge for Section B
-- would orphan Section A scores on the original judge's row, or — if we
-- shared one scoresheet — would let Judge X read Judge Y's work, breaking
-- bias prevention. Section-scoped sheets keep each judge's scoring isolated.
--
-- IMPORTANT: This migration runs assuming Section B has NOT yet been scored
-- with the new schema. Existing scoresheets are treated as Section A by
-- default since `section_a_submitted_at` was the only "done" signal before.
-- If a row still has status='submitted' or 'finalised', we keep it as is
-- (it represents a fully-scored Section A under the old single-judge model).
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Column. Default 'A' so the historical rows belong to the section they
--    were ACTUALLY filling: in practice everything pre-event was Section A.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE scoresheets
  ADD COLUMN IF NOT EXISTS section section NOT NULL DEFAULT 'A';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Replace the old unique (participant_id, judge_id) with a three-column
--    unique (participant_id, judge_id, section). This is the single most
--    important change in this migration — it's what allows a participant to
--    have TWO scoresheets from different judges, one per section.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE scoresheets
  DROP CONSTRAINT IF EXISTS scoresheets_participant_id_judge_id_key;
DROP INDEX IF EXISTS scoresheets_participant_id_judge_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS scoresheets_participant_judge_section_key
  ON scoresheets (participant_id, judge_id, section);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper index for queries that filter by (judge_id, section) — the
--    judge_queue view + auto-refresh on phase change both hit this path.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS scoresheets_judge_section_idx
  ON scoresheets (judge_id, section);
