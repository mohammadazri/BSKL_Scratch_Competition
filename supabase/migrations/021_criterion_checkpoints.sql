-- 021_criterion_checkpoints.sql
--
-- Adds binary-checklist scoring as a co-existing alternative to the existing
-- 4-band level system. Judges in the field reported that picking a level + a
-- specific number inside that level's range was the slowest, most anxiety-
-- inducing part of scoring; checkpoints turn each criterion into a list of
-- concrete yes/no items the judge ticks, and the points are computed.
--
-- New columns:
--   criteria.checkpoints     JSONB array of { id, label, points, sort_order }
--   scores.checkpoint_state  JSONB array of checkpoint ids the judge ticked
--
-- We do NOT drop criterion_levels — when a criterion has no checkpoints, the
-- form falls back to the old level UI. This makes the migration safe to roll
-- back (just drop the columns) and lets us migrate one category at a time.
--
-- The DB still stores scores.level + scores.points so the leaderboard / audit /
-- results views keep working unchanged. Level is derived from the % achieved
-- (≥80% = Excellent, 60–79% = Proficient, 30–59% = Developing, <30% = Insufficient).
--
-- Safe to re-run.

ALTER TABLE criteria
  ADD COLUMN IF NOT EXISTS checkpoints jsonb;

COMMENT ON COLUMN criteria.checkpoints IS
  'Optional JSON array [{ id, label, points, sort_order }]. When present, the scoring UI shows binary checkboxes instead of level bands.';

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS checkpoint_state jsonb;

COMMENT ON COLUMN scores.checkpoint_state IS
  'Optional JSON array of ticked checkpoint ids. Persisted so the judge sees the same ticks on return; the canonical score remains in scores.points.';
