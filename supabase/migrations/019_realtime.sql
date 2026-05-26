-- 019_realtime.sql
--
-- Enable Supabase Realtime (postgres logical replication) on the tables we
-- want the browser to subscribe to so the UI can react to changes without
-- polling. Realtime delivers row-level INSERT/UPDATE/DELETE events to any
-- client that subscribes to a channel.
--
-- Tables published:
--   edit_requests — admin gets a priority toast when a new request appears
--                   and the requesting judge's page invalidates on approval.
--   scoresheets   — viewer / admin leaderboards refresh as judges submit.
--   scores        — fine-grained changes (override flow) trigger leaderboard refresh.
--   event_state   — every authenticated screen reacts to phase changes
--                   (e.g. opening Section B unlocks the scoring form).
--
-- Realtime respects RLS automatically when called from the browser with the
-- user's JWT, so we don't have to weaken any policies here.
--
-- Safe to re-run: ALTER PUBLICATION ADD TABLE is idempotent in Postgres 15+,
-- but we DO NOT have that guarantee on older versions, so wrap in DO blocks.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'edit_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE edit_requests';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'scoresheets'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE scoresheets';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE scores';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'event_state'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE event_state';
  END IF;
END $$;
