-- 016_theme_required.sql
--
-- Make `participants.theme` mandatory. Previously the column was nullable
-- so participants could be registered without picking a theme; the spec
-- has been tightened so every entry must declare one of the three themes.
--
-- Backfills any NULL themes to 'Eco-Warriors' before adding the NOT NULL
-- constraint so we don't break on existing rows. Re-running is safe.

UPDATE participants SET theme = 'Eco-Warriors' WHERE theme IS NULL;

ALTER TABLE participants ALTER COLUMN theme SET NOT NULL;
