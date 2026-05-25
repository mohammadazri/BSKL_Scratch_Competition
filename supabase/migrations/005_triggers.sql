-- 005_triggers.sql
-- All triggers — set_updated_at, audit_row, check_score_in_band, handle_new_user.
-- DROP IF EXISTS pattern makes this safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at: bump on every UPDATE for mutable tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_profiles_updated      ON profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_schools_updated       ON schools;
CREATE TRIGGER trg_schools_updated
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_participants_updated  ON participants;
CREATE TRIGGER trg_participants_updated
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_scoresheets_updated   ON scoresheets;
CREATE TRIGGER trg_scoresheets_updated
  BEFORE UPDATE ON scoresheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_scores_updated        ON scores;
CREATE TRIGGER trg_scores_updated
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_event_state_updated   ON event_state;
CREATE TRIGGER trg_event_state_updated
  BEFORE UPDATE ON event_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- score-band check: validate scores.points falls in chosen level's band
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS scores_band_check ON scores;
CREATE TRIGGER scores_band_check
  BEFORE INSERT OR UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION check_score_in_band();

-- ─────────────────────────────────────────────────────────────────────────────
-- audit triggers: fire on every mutation, write to audit_log via SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_participants ON participants;
CREATE TRIGGER trg_audit_participants
  AFTER INSERT OR UPDATE OR DELETE ON participants
  FOR EACH ROW EXECUTE FUNCTION audit_row('participant');

DROP TRIGGER IF EXISTS trg_audit_schools ON schools;
CREATE TRIGGER trg_audit_schools
  AFTER INSERT OR UPDATE OR DELETE ON schools
  FOR EACH ROW EXECUTE FUNCTION audit_row('school');

DROP TRIGGER IF EXISTS trg_audit_assignments ON assignments;
CREATE TRIGGER trg_audit_assignments
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION audit_row('assignment');

DROP TRIGGER IF EXISTS trg_audit_scoresheets ON scoresheets;
CREATE TRIGGER trg_audit_scoresheets
  AFTER INSERT OR UPDATE OR DELETE ON scoresheets
  FOR EACH ROW EXECUTE FUNCTION audit_row('scoresheet');

DROP TRIGGER IF EXISTS trg_audit_scores ON scores;
CREATE TRIGGER trg_audit_scores
  AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW EXECUTE FUNCTION audit_row('score');

DROP TRIGGER IF EXISTS trg_audit_disqual ON disqualifications;
CREATE TRIGGER trg_audit_disqual
  AFTER INSERT OR UPDATE OR DELETE ON disqualifications
  FOR EACH ROW EXECUTE FUNCTION audit_row('dq_flag');

DROP TRIGGER IF EXISTS trg_audit_event_state ON event_state;
CREATE TRIGGER trg_audit_event_state
  AFTER INSERT OR UPDATE OR DELETE ON event_state
  FOR EACH ROW EXECUTE FUNCTION audit_row('event_state');

DROP TRIGGER IF EXISTS trg_audit_profiles ON profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_row('user');

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.users → profiles trigger
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
