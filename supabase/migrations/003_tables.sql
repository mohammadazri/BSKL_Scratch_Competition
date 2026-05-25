-- 003_tables.sql
-- All application tables in FK-dependency order, plus indexes from SCHEMA.md.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles (mirrors auth.users with app data)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         user_role NOT NULL DEFAULT 'judge',
  categories   category[] NOT NULL DEFAULT ARRAY['A','B','C']::category[],
  is_active    boolean NOT NULL DEFAULT true,
  pin_label    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- schools
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  short_code  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- participants (FK → schools)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  full_name   text NOT NULL,
  category    category NOT NULL,
  theme       theme,
  qualified   boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS participants_category_idx ON participants(category);
CREATE INDEX IF NOT EXISTS participants_school_idx   ON participants(school_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- criteria (REFERENCE DATA, seeded once)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    category NOT NULL,
  section     section NOT NULL,
  name        text NOT NULL,
  max_points  integer NOT NULL CHECK (max_points > 0),
  sort_order  integer NOT NULL,
  UNIQUE (category, section, sort_order)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- criterion_levels (FK → criteria, REFERENCE DATA, seeded once)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS criterion_levels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id  uuid NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  level         perf_level NOT NULL,
  min_pts       integer NOT NULL CHECK (min_pts >= 0),
  max_pts       integer NOT NULL,
  descriptor    text NOT NULL,
  UNIQUE (criterion_id, level),
  CHECK (max_pts >= min_pts)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- assignments (FK → participants, profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  judge_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id)
);
CREATE INDEX IF NOT EXISTS assignments_judge_idx ON assignments(judge_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- scoresheets (FK → participants, profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scoresheets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id           uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  judge_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status                   scoresheet_status NOT NULL DEFAULT 'draft',
  theme_selected           theme,
  live_sprint_time_seconds integer CHECK (live_sprint_time_seconds BETWEEN 0 AND 2700),
  started_at               timestamptz NOT NULL DEFAULT now(),
  submitted_at             timestamptz,
  finalised_at             timestamptz,
  judge_notes              text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, judge_id)
);
CREATE INDEX IF NOT EXISTS scoresheets_judge_status_idx ON scoresheets(judge_id, status);
CREATE INDEX IF NOT EXISTS scoresheets_participant_idx  ON scoresheets(participant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- scores (FK → scoresheets, criteria)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoresheet_id   uuid NOT NULL REFERENCES scoresheets(id) ON DELETE CASCADE,
  criterion_id    uuid NOT NULL REFERENCES criteria(id) ON DELETE RESTRICT,
  level           perf_level NOT NULL,
  points          integer NOT NULL CHECK (points >= 0),
  comment         text,
  is_override     boolean NOT NULL DEFAULT false,
  override_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scoresheet_id, criterion_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- disqualifications (FK → scoresheets, profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disqualifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoresheet_id    uuid NOT NULL REFERENCES scoresheets(id) ON DELETE CASCADE,
  reason           dq_reason NOT NULL,
  notes            text NOT NULL,
  raised_by        uuid NOT NULL REFERENCES profiles(id),
  cleared_by       uuid REFERENCES profiles(id),
  cleared_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- event_state (singleton row, id = 1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_state (
  id            integer PRIMARY KEY CHECK (id = 1),
  event_name    text NOT NULL DEFAULT 'P3 Future Coders Challenge 2026',
  event_date    date,
  sprint_minutes integer NOT NULL DEFAULT 45,
  locked        boolean NOT NULL DEFAULT false,
  locked_at     timestamptz,
  locked_by     uuid REFERENCES profiles(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO event_state (id, event_date)
VALUES (1, '2026-07-25')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log (APPEND-ONLY — no UPDATE/DELETE policies in 006_rls.sql)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid REFERENCES profiles(id),
  actor_role    user_role,
  actor_ip      inet,
  actor_ua      text,
  action        audit_action NOT NULL,
  target_type   text,
  target_id     uuid,
  before_json   jsonb,
  after_json    jsonb,
  reason        text
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx     ON audit_log(at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx  ON audit_log(actor_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action, at DESC);
