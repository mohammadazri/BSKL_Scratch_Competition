-- 002_enums.sql
-- All Postgres ENUM types used across the schema.
-- Each CREATE TYPE is guarded so re-running this migration is a no-op.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'judge', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE category AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE section AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE perf_level AS ENUM ('Excellent', 'Proficient', 'Developing', 'Insufficient');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE theme AS ENUM ('Eco-Warriors', 'Smart Cities', 'Space Pioneers');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scoresheet_status AS ENUM ('draft', 'submitted', 'finalised');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dq_reason AS ENUM (
    'complete_on_arrival',
    'tutorial_or_ai_use',
    'parental_assistance',
    'unsportsmanlike_conduct',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
