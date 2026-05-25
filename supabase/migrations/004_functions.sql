-- 004_functions.sql
-- Helper functions referenced by triggers and RLS policies.
-- All idempotent via CREATE OR REPLACE.

-- ─────────────────────────────────────────────────────────────────────────────
-- set_updated_at: generic BEFORE UPDATE trigger to bump updated_at.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- check_score_in_band: enforce that scores.points falls inside the chosen
-- criterion_levels band for the given (criterion_id, level).
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS helper: is the caller's profile of a given role?
-- ─────────────────────────────────────────────────────────────────────────────
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
-- Use this in every SELECT policy to grant read-all in one go.
CREATE OR REPLACE FUNCTION can_read_all() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT is_super_admin() OR is_viewer();
$$;

CREATE OR REPLACE FUNCTION is_event_locked() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT locked FROM event_state WHERE id = 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_row: AFTER INSERT|UPDATE|DELETE trigger that writes to audit_log.
-- SECURITY DEFINER so it can INSERT into audit_log even though no INSERT
-- policy exists for any role.
-- TG_ARGV[0] is the target_type prefix (e.g. 'participant' → 'participant_create').
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- handle_new_user: AFTER INSERT trigger on auth.users that materialises a
-- profiles row. SECURITY DEFINER so it can write to public.profiles from the
-- auth schema bypassing RLS.
-- ─────────────────────────────────────────────────────────────────────────────
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
