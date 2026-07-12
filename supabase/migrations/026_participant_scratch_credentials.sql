-- 026_participant_scratch_credentials.sql
--
-- Scratch login details are deliberately kept out of `participants` because
-- viewers can read that table. This one-to-one table is visible only to:
--   * super_admin
--   * registration_committee
--   * a judge assigned to that participant (Section A or B)
--
-- Passwords are operational event credentials that judges must be able to
-- read. They are never included in the local audit log or results exports.

CREATE TABLE IF NOT EXISTS participant_scratch_credentials (
  participant_id uuid PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  username       text NOT NULL,
  password       text NOT NULL,
  updated_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scratch_username_length CHECK (char_length(btrim(username)) BETWEEN 1 AND 50),
  CONSTRAINT scratch_username_format CHECK (username ~ '^[A-Za-z0-9_-]+$'),
  CONSTRAINT scratch_password_length CHECK (char_length(password) BETWEEN 1 AND 200),
  CONSTRAINT scratch_password_not_blank CHECK (char_length(btrim(password)) > 0)
);

DROP TRIGGER IF EXISTS trg_scratch_credentials_updated_at
  ON participant_scratch_credentials;
CREATE TRIGGER trg_scratch_credentials_updated_at
  BEFORE UPDATE ON participant_scratch_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE participant_scratch_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scratch_credentials_manage
  ON participant_scratch_credentials;
CREATE POLICY scratch_credentials_manage
  ON participant_scratch_credentials
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR current_role_is('registration_committee')
  )
  WITH CHECK (
    (
      is_super_admin()
      OR current_role_is('registration_committee')
    )
    AND (updated_by IS NULL OR updated_by = auth.uid())
  );

DROP POLICY IF EXISTS scratch_credentials_assigned_judge_read
  ON participant_scratch_credentials;
CREATE POLICY scratch_credentials_assigned_judge_read
  ON participant_scratch_credentials
  FOR SELECT TO authenticated
  USING (
    current_role_is('judge')
    AND EXISTS (
      SELECT 1
        FROM profiles p
       WHERE p.id = auth.uid()
         AND p.is_active = true
    )
    AND EXISTS (
      SELECT 1
        FROM assignments a
       WHERE a.participant_id = participant_scratch_credentials.participant_id
         AND a.judge_id = auth.uid()
    )
  );

REVOKE ALL ON participant_scratch_credentials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON participant_scratch_credentials TO authenticated;
GRANT ALL ON participant_scratch_credentials TO service_role;

-- Keep participant + credential writes atomic. The app calls these only after
-- its inline role guards; SECURITY INVOKER means direct authenticated calls
-- still have to satisfy both tables' RLS policies.
CREATE OR REPLACE FUNCTION create_participant_with_scratch(
  p_full_name text,
  p_school_id uuid,
  p_category category,
  p_theme theme,
  p_username text,
  p_password text,
  p_updated_by uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO participants (id, full_name, school_id, category, theme)
  VALUES (v_participant_id, p_full_name, p_school_id, p_category, p_theme);

  INSERT INTO participant_scratch_credentials
    (participant_id, username, password, updated_by)
  VALUES
    (v_participant_id, p_username, p_password, p_updated_by);

  RETURN v_participant_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_participant_with_scratch(
  p_participant_id uuid,
  p_full_name text,
  p_school_id uuid,
  p_category category,
  p_theme theme,
  p_username text,
  p_password text,
  p_updated_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE participants
     SET full_name = p_full_name,
         school_id = p_school_id,
         category = p_category,
         theme = p_theme
   WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found.';
  END IF;

  IF p_password IS NULL THEN
    UPDATE participant_scratch_credentials
       SET username = p_username,
           updated_by = p_updated_by
     WHERE participant_id = p_participant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Enter a Scratch password for this participant.';
    END IF;
  ELSE
    INSERT INTO participant_scratch_credentials
      (participant_id, username, password, updated_by)
    VALUES
      (p_participant_id, p_username, p_password, p_updated_by)
    ON CONFLICT (participant_id) DO UPDATE
      SET username = EXCLUDED.username,
          password = EXCLUDED.password,
          updated_by = EXCLUDED.updated_by;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION import_participants_with_scratch(
  p_rows jsonb,
  p_updated_by uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_participant_id uuid;
  v_created integer := 0;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Import rows must be a JSON array.';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_participant_id := COALESCE(NULLIF(v_row->>'id', '')::uuid, gen_random_uuid());

    INSERT INTO participants (id, full_name, school_id, category, theme)
    VALUES (
      v_participant_id,
      v_row->>'full_name',
      (v_row->>'school_id')::uuid,
      (v_row->>'category')::category,
      (v_row->>'theme')::theme
    );

    INSERT INTO participant_scratch_credentials
      (participant_id, username, password, updated_by)
    VALUES (
      v_participant_id,
      v_row->>'scratch_username',
      v_row->>'scratch_password',
      p_updated_by
    );

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION create_participant_with_scratch(text, uuid, category, theme, text, text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION update_participant_with_scratch(uuid, text, uuid, category, theme, text, text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION import_participants_with_scratch(jsonb, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION create_participant_with_scratch(text, uuid, category, theme, text, text, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_participant_with_scratch(uuid, text, uuid, category, theme, text, text, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION import_participants_with_scratch(jsonb, uuid)
  TO authenticated, service_role;
