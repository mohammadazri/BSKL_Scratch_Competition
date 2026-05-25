# Schema — P3 Judging DB

**Shared reference.** All tracks read from this. Track 1 implements it; other tracks consume it.

If you need to change a table, update this file AND the Drizzle schema in the same commit, with commit message like `schema: add live_sprint_time_seconds to scoresheets`.

---

## Conventions

- All tables `snake_case`. All IDs are `uuid` default `gen_random_uuid()`.
- All tables have `created_at timestamptz default now()` and (where mutable) `updated_at timestamptz default now()` with a trigger.
- Money / score columns are `integer` (no decimals — bands are whole points).
- Enums via Postgres `CREATE TYPE` for cross-language safety.
- Every mutable table has a `BEFORE UPDATE` trigger setting `updated_at = now()`.
- Every audit-relevant table has an `AFTER INSERT OR UPDATE OR DELETE` trigger writing to `audit_log`.

---

## Enums

```sql
CREATE TYPE user_role        AS ENUM ('super_admin', 'judge', 'viewer');
CREATE TYPE category         AS ENUM ('A', 'B', 'C');
CREATE TYPE section          AS ENUM ('A', 'B');
CREATE TYPE perf_level       AS ENUM ('Excellent', 'Proficient', 'Developing', 'Insufficient');
CREATE TYPE theme            AS ENUM ('Eco-Warriors', 'Smart Cities', 'Space Pioneers');
CREATE TYPE scoresheet_status AS ENUM ('draft', 'submitted', 'finalised');
CREATE TYPE dq_reason        AS ENUM (
  'complete_on_arrival',
  'tutorial_or_ai_use',
  'parental_assistance',
  'unsportsmanlike_conduct',
  'other'
);
CREATE TYPE audit_action AS ENUM (
  'login','logout','user_create','user_update','user_role_change','user_disable',
  'school_create','school_update','school_delete',
  'participant_create','participant_update','participant_delete','participant_import',
  'assignment_create','assignment_update','assignment_delete','assignment_auto_run',
  'scoresheet_create','scoresheet_update','scoresheet_submit','scoresheet_unlock',
  'score_create','score_update','score_override',
  'dq_flag_raise','dq_flag_clear',
  'event_lock','event_unlock',
  'export_csv','export_pdf'
);
```

---

## Tables

### `profiles` (mirrors `auth.users` with app data)

```sql
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         user_role NOT NULL DEFAULT 'judge',
  categories   category[] NOT NULL DEFAULT ARRAY['A','B','C']::category[],
  is_active    boolean NOT NULL DEFAULT true,
  pin_label    text,  -- e.g. "Sticky note #3" — purely informational
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

A row is created here by a trigger on `auth.users` insert.

### `schools`

```sql
CREATE TABLE schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  short_code  text,  -- e.g. "BSKL" for compact display
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### `participants`

```sql
CREATE TABLE participants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  full_name   text NOT NULL,
  category    category NOT NULL,
  theme       theme,                 -- nullable until known
  qualified   boolean NOT NULL DEFAULT true, -- false = DQ'd, excluded from rankings
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX participants_category_idx ON participants(category);
CREATE INDEX participants_school_idx   ON participants(school_id);
```

### `criteria` — REFERENCE DATA, seeded once

```sql
CREATE TABLE criteria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    category NOT NULL,
  section     section NOT NULL,        -- 'A' = Phase 1 at-home, 'B' = Live Sprint
  name        text NOT NULL,
  max_points  integer NOT NULL CHECK (max_points > 0),
  sort_order  integer NOT NULL,
  UNIQUE (category, section, sort_order)
);
```

### `criterion_levels` — REFERENCE DATA, seeded once

```sql
CREATE TABLE criterion_levels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id  uuid NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  level         perf_level NOT NULL,
  min_pts       integer NOT NULL CHECK (min_pts >= 0),
  max_pts       integer NOT NULL,
  descriptor    text NOT NULL,
  UNIQUE (criterion_id, level),
  CHECK (max_pts >= min_pts)
);
```

### `assignments`

```sql
CREATE TABLE assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  judge_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id)  -- one primary judge per participant
);
CREATE INDEX assignments_judge_idx ON assignments(judge_id);
```

### `scoresheets`

```sql
CREATE TABLE scoresheets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id           uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  judge_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status                   scoresheet_status NOT NULL DEFAULT 'draft',
  theme_selected           theme,                 -- judge confirms what student picked
  live_sprint_time_seconds integer CHECK (live_sprint_time_seconds BETWEEN 0 AND 2700), -- max 45:00
  started_at               timestamptz NOT NULL DEFAULT now(),
  submitted_at             timestamptz,
  finalised_at             timestamptz,
  judge_notes              text,                  -- free-form scoresheet-level note
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, judge_id)
);
CREATE INDEX scoresheets_judge_status_idx ON scoresheets(judge_id, status);
CREATE INDEX scoresheets_participant_idx  ON scoresheets(participant_id);
```

### `scores` — one row per criterion per scoresheet

```sql
CREATE TABLE scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoresheet_id   uuid NOT NULL REFERENCES scoresheets(id) ON DELETE CASCADE,
  criterion_id    uuid NOT NULL REFERENCES criteria(id) ON DELETE RESTRICT,
  level           perf_level NOT NULL,
  points          integer NOT NULL CHECK (points >= 0),
  comment         text,
  is_override     boolean NOT NULL DEFAULT false,  -- true if super_admin overrode the judge's value
  override_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scoresheet_id, criterion_id)
);
-- Enforce that points falls in the chosen level's band:
CREATE OR REPLACE FUNCTION check_score_in_band() RETURNS trigger AS $$
DECLARE
  lvl criterion_levels%ROWTYPE;
BEGIN
  SELECT * INTO lvl
    FROM criterion_levels
   WHERE criterion_id = NEW.criterion_id AND level = NEW.level;
  IF NEW.points < lvl.min_pts OR NEW.points > lvl.max_pts THEN
    RAISE EXCEPTION 'points % outside band for level % (% - %)',
      NEW.points, NEW.level, lvl.min_pts, lvl.max_pts;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scores_band_check
  BEFORE INSERT OR UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION check_score_in_band();
```

### `disqualifications`

```sql
CREATE TABLE disqualifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scoresheet_id    uuid NOT NULL REFERENCES scoresheets(id) ON DELETE CASCADE,
  reason           dq_reason NOT NULL,
  notes            text NOT NULL,
  raised_by        uuid NOT NULL REFERENCES profiles(id),
  cleared_by       uuid REFERENCES profiles(id),
  cleared_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### `event_state` — singleton row

```sql
CREATE TABLE event_state (
  id            integer PRIMARY KEY CHECK (id = 1),
  event_name    text NOT NULL DEFAULT 'P3 Future Coders Challenge 2026',
  event_date    date,
  sprint_minutes integer NOT NULL DEFAULT 45,
  locked        boolean NOT NULL DEFAULT false, -- true = no more edits
  locked_at     timestamptz,
  locked_by     uuid REFERENCES profiles(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO event_state (id, event_date) VALUES (1, '2026-07-25');
```

### `audit_log` — APPEND-ONLY

```sql
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid REFERENCES profiles(id),  -- nullable (e.g. system actions)
  actor_role    user_role,
  actor_ip      inet,
  actor_ua      text,
  action        audit_action NOT NULL,
  target_type   text,    -- e.g. 'scoresheet', 'participant'
  target_id     uuid,
  before_json   jsonb,
  after_json    jsonb,
  reason        text
);
CREATE INDEX audit_log_at_idx        ON audit_log(at DESC);
CREATE INDEX audit_log_actor_idx     ON audit_log(actor_id, at DESC);
CREATE INDEX audit_log_target_idx    ON audit_log(target_type, target_id);
CREATE INDEX audit_log_action_idx    ON audit_log(action, at DESC);
```

---

## Views

### `final_rankings` — auto-ranked per category, ties broken by sprint time

```sql
CREATE OR REPLACE VIEW final_rankings AS
WITH sheet_totals AS (
  SELECT s.id                  AS scoresheet_id,
         s.participant_id,
         s.judge_id,
         s.live_sprint_time_seconds,
         s.submitted_at,
         s.status,
         COALESCE(SUM(sc.points), 0) AS total_points
    FROM scoresheets s
    LEFT JOIN scores sc ON sc.scoresheet_id = s.id
   WHERE s.status IN ('submitted','finalised')
   GROUP BY s.id
)
SELECT p.id                              AS participant_id,
       p.full_name                       AS participant_name,
       sch.name                          AS school_name,
       p.category,
       p.theme,
       p.qualified,
       st.total_points,
       st.live_sprint_time_seconds,
       st.submitted_at,
       st.judge_id,
       RANK() OVER (
         PARTITION BY p.category
         ORDER BY st.total_points DESC,
                  st.live_sprint_time_seconds ASC NULLS LAST,
                  st.submitted_at ASC NULLS LAST
       ) AS rank
  FROM participants p
  JOIN schools sch ON sch.id = p.school_id
  LEFT JOIN sheet_totals st ON st.participant_id = p.id
 WHERE p.qualified = true;
```

### `judge_queue` — what each judge sees on their dashboard

```sql
CREATE OR REPLACE VIEW judge_queue AS
SELECT a.judge_id,
       p.id   AS participant_id,
       p.full_name,
       p.category,
       sch.name AS school_name,
       p.theme,
       s.id     AS scoresheet_id,
       COALESCE(s.status, 'draft'::scoresheet_status) AS status,
       (SELECT COUNT(*) FROM scores sc WHERE sc.scoresheet_id = s.id) AS scored_criteria_count,
       (SELECT COUNT(*) FROM criteria c WHERE c.category = p.category) AS total_criteria_count
  FROM assignments a
  JOIN participants p ON p.id = a.participant_id
  JOIN schools sch ON sch.id = p.school_id
  LEFT JOIN scoresheets s ON s.participant_id = p.id AND s.judge_id = a.judge_id;
```

---

## Row Level Security (RLS)

**Enable RLS on every table:**

```sql
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterion_levels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoresheets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disqualifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_state         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
```

### Helper functions

```sql
CREATE OR REPLACE FUNCTION current_role_is(target user_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = auth.uid() AND role = target AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_role_is('super_admin');
$$;

CREATE OR REPLACE FUNCTION is_viewer() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_role_is('viewer');
$$;

-- Anyone in this set can READ everything (super_admin and viewer).
-- Use this in SELECT policies to grant read-all to observers without granting writes.
CREATE OR REPLACE FUNCTION can_read_all() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT is_super_admin() OR is_viewer();
$$;

CREATE OR REPLACE FUNCTION is_event_locked() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT locked FROM event_state WHERE id = 1;
$$;
```

### Policy summary

`viewer` = strict read-only observer (principals, P3 management, sponsors). Can see everything `super_admin` can, but cannot insert/update/delete anything anywhere.

| Table | Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `profiles` | super_admin | all | yes | yes | no (use `is_active`) |
| `profiles` | judge | self only | no | self (limited cols) | no |
| `profiles` | **viewer** | **all** | **no** | **no** | **no** |
| `schools` | super_admin | all | yes | yes | yes (if no participants) |
| `schools` | judge | all (read for display) | no | no | no |
| `schools` | **viewer** | **all** | **no** | **no** | **no** |
| `participants` | super_admin | all | yes | yes | yes |
| `participants` | judge | assigned only | no | no | no |
| `participants` | **viewer** | **all** | **no** | **no** | **no** |
| `criteria` / `criterion_levels` | all roles | all | no (seed only) | no | no |
| `assignments` | super_admin | all | yes | yes | yes |
| `assignments` | judge | self only | no | no | no |
| `assignments` | **viewer** | **all** | **no** | **no** | **no** |
| `scoresheets` | super_admin | all | yes | yes | no |
| `scoresheets` | judge | own only | own (draft) | own (draft only) | no |
| `scoresheets` | **viewer** | **all** | **no** | **no** | **no** |
| `scores` | super_admin | all | yes | yes (override) | yes |
| `scores` | judge | own scoresheet | own (draft) | own (draft) | own (draft) |
| `scores` | **viewer** | **all** | **no** | **no** | **no** |
| `disqualifications` | super_admin | all | yes | yes | no |
| `disqualifications` | judge | own scoresheet | own | no | no |
| `disqualifications` | **viewer** | **all** | **no** | **no** | **no** |
| `event_state` | super_admin | yes | n/a | yes | n/a |
| `event_state` | judge | yes | no | no | n/a |
| `event_state` | **viewer** | **yes** | **no** | **no** | n/a |
| `audit_log` | super_admin | all | no (trigger only) | **never** | **never** |
| `audit_log` | judge | own actions only | no | **never** | **never** |
| `audit_log` | **viewer** | **all** | **no** | **never** | **never** |

**Rule of thumb in policy writing:** use `can_read_all()` in every table's `SELECT` policy to grant read access to `super_admin` and `viewer` in one go.

### Policy SQL (key examples — Track 1 implements the full set)

```sql
-- profiles
CREATE POLICY profiles_super_all ON profiles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY profiles_self_read ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- participants — judges see only their assigned, viewers see all, super_admin does everything
CREATE POLICY participants_super_all ON participants
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY participants_read ON participants
  FOR SELECT TO authenticated
  USING (
    can_read_all()    -- super_admin or viewer sees all
    OR EXISTS (       -- judge sees only their assigned
      SELECT 1 FROM assignments a
       WHERE a.participant_id = participants.id AND a.judge_id = auth.uid()
    )
  );

-- scoresheets — judges can only touch their own drafts; cannot edit after submit
CREATE POLICY scoresheets_super_all ON scoresheets
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY scoresheets_read ON scoresheets
  FOR SELECT TO authenticated
  USING (can_read_all() OR judge_id = auth.uid());

CREATE POLICY scoresheets_judge_insert ON scoresheets
  FOR INSERT TO authenticated
  WITH CHECK (
    judge_id = auth.uid()
    AND status = 'draft'
    AND NOT is_event_locked()
    AND EXISTS (
      SELECT 1 FROM assignments a
       WHERE a.participant_id = scoresheets.participant_id AND a.judge_id = auth.uid()
    )
  );

CREATE POLICY scoresheets_judge_update ON scoresheets
  FOR UPDATE TO authenticated
  USING (judge_id = auth.uid() AND status = 'draft' AND NOT is_event_locked())
  WITH CHECK (
    judge_id = auth.uid()
    AND status IN ('draft','submitted')  -- transition to submitted allowed
    AND NOT is_event_locked()
  );

-- audit_log — NEVER updatable or deletable, even by super_admin via API
-- (only inserts via trigger; super_admin + viewer can SELECT all, judges see own only)
CREATE POLICY audit_log_read_all ON audit_log
  FOR SELECT TO authenticated USING (can_read_all());

CREATE POLICY audit_log_judge_self_read ON audit_log
  FOR SELECT TO authenticated USING (actor_id = auth.uid());

-- NO insert/update/delete policy → blocked for everyone via the API.
-- Trigger functions run as SECURITY DEFINER to bypass RLS on insert.
```

---

## Triggers — `updated_at` and audit

### Generic `updated_at` setter

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated      BEFORE UPDATE ON profiles      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_schools_updated       BEFORE UPDATE ON schools       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_participants_updated  BEFORE UPDATE ON participants  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_scoresheets_updated   BEFORE UPDATE ON scoresheets   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_scores_updated        BEFORE UPDATE ON scores        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_event_state_updated   BEFORE UPDATE ON event_state   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Audit trigger — auto-log every mutation

```sql
CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action audit_action;
  v_before jsonb;
  v_after  jsonb;
  v_target_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := (TG_ARGV[0] || '_create')::audit_action;
    v_before := NULL;
    v_after  := to_jsonb(NEW);
    v_target_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := (TG_ARGV[0] || '_update')::audit_action;
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_target_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := (TG_ARGV[0] || '_delete')::audit_action;
    v_before := to_jsonb(OLD);
    v_after  := NULL;
    v_target_id := OLD.id;
  END IF;

  INSERT INTO audit_log (actor_id, actor_role, action, target_type, target_id, before_json, after_json)
  VALUES (auth.uid(),
          (SELECT role FROM profiles WHERE id = auth.uid()),
          v_action, TG_ARGV[0], v_target_id, v_before, v_after);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to every audit-relevant table; pass the target_type as TG_ARGV[0]:
CREATE TRIGGER trg_audit_participants  AFTER INSERT OR UPDATE OR DELETE ON participants  FOR EACH ROW EXECUTE FUNCTION audit_row('participant');
CREATE TRIGGER trg_audit_schools       AFTER INSERT OR UPDATE OR DELETE ON schools       FOR EACH ROW EXECUTE FUNCTION audit_row('school');
CREATE TRIGGER trg_audit_assignments   AFTER INSERT OR UPDATE OR DELETE ON assignments   FOR EACH ROW EXECUTE FUNCTION audit_row('assignment');
CREATE TRIGGER trg_audit_scoresheets   AFTER INSERT OR UPDATE OR DELETE ON scoresheets   FOR EACH ROW EXECUTE FUNCTION audit_row('scoresheet');
CREATE TRIGGER trg_audit_scores        AFTER INSERT OR UPDATE OR DELETE ON scores        FOR EACH ROW EXECUTE FUNCTION audit_row('score');
CREATE TRIGGER trg_audit_disqual       AFTER INSERT OR UPDATE OR DELETE ON disqualifications FOR EACH ROW EXECUTE FUNCTION audit_row('dq_flag');
CREATE TRIGGER trg_audit_event_state   AFTER INSERT OR UPDATE OR DELETE ON event_state   FOR EACH ROW EXECUTE FUNCTION audit_row('event_state');
CREATE TRIGGER trg_audit_profiles      AFTER INSERT OR UPDATE OR DELETE ON profiles      FOR EACH ROW EXECUTE FUNCTION audit_row('user');
```

### Auto-create profile on new auth.users

```sql
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'judge')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Tiebreaker explained

Final ranking SQL (lives in the `final_rankings` view above):

```sql
ORDER BY total_points DESC,                       -- highest score wins
         live_sprint_time_seconds ASC NULLS LAST, -- faster sprint wins ties
         submitted_at ASC NULLS LAST              -- earliest submission as final fallback
```

This runs automatically — no manual aggregation step. `/admin/results` queries `final_rankings` directly.

---

## Bootstrapping the first super_admin

After the first migration runs, there are no users. The super_admin (Mohammad) is bootstrapped via the Supabase SQL editor:

```sql
-- 1. Mohammad signs up via the website's normal signup flow with his email.
--    This creates an auth.users row + a profiles row with role='judge' by default.
-- 2. Promote him manually in the Supabase SQL editor:
UPDATE profiles SET role = 'super_admin' WHERE email = 'aiman0608@gmail.com';
```

After this, all further user/role management happens via the super-admin UI (Track 2).
