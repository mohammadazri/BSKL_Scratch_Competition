-- 013_audit_to_local.sql
--
-- Move the audit log OUT of Supabase and onto the Raspberry Pi.
--
-- Rationale:
--   * The Supabase free-tier database is precious storage. The audit_log
--     table is by far the biggest single consumer (~10× bigger than every
--     other table combined for a single event).
--   * The audit-trigger model also kept hitting "invalid input value for
--     enum audit_action" gaps every time we added a new mutation site,
--     because the enum had to be kept in lockstep with the trigger code.
--   * Audit data does not need cross-region durability or web-scale querying
--     for our use case — it's reviewed locally by Mohammad post-event from
--     `/admin/audit`, and the Pi is the operational source of truth anyway.
--
-- After this migration, the app writes audit events to a local JSON-Lines
-- file on the Pi (default `~/.p3-judging/audit.jsonl`, overridable via the
-- `AUDIT_LOG_PATH` env var). The `/admin/audit`, `/judge/audit`,
-- `/viewer/audit` pages and their CSV exports read from that file directly.
--
-- This migration drops EVERYTHING audit-related in Postgres:
--   * Every `trg_audit_*` trigger
--   * The `audit_row()` function
--   * The mutation-block trigger + function from 008_security_fixes.sql
--   * The `audit_log` table
--   * The `audit_action` enum
--
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop the audit triggers from every table they're attached to.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_participants    ON participants;
DROP TRIGGER IF EXISTS trg_audit_schools         ON schools;
DROP TRIGGER IF EXISTS trg_audit_assignments     ON assignments;
DROP TRIGGER IF EXISTS trg_audit_scoresheets     ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scoresheets_ins ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scoresheets_del ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scoresheets_status ON scoresheets;
DROP TRIGGER IF EXISTS trg_audit_scores          ON scores;
DROP TRIGGER IF EXISTS trg_audit_scores_ins      ON scores;
DROP TRIGGER IF EXISTS trg_audit_scores_del      ON scores;
DROP TRIGGER IF EXISTS trg_audit_scores_override ON scores;
DROP TRIGGER IF EXISTS trg_audit_disqual         ON disqualifications;
DROP TRIGGER IF EXISTS trg_audit_event_state     ON event_state;
DROP TRIGGER IF EXISTS trg_audit_profiles        ON profiles;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop the append-only protection triggers from 008_security_fixes.sql —
--    they reference audit_log so they must go before the table does.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_log_no_update    ON audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_no_truncate  ON audit_log;
DROP FUNCTION IF EXISTS audit_log_block_mutations();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop the retention helper from 011_audit_quiet_mode.sql.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS audit_log_prune(interval);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop the audit_row() function and the audit_log table.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS audit_row() CASCADE;
DROP TABLE    IF EXISTS audit_log   CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Drop the audit_action enum.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS audit_action;
