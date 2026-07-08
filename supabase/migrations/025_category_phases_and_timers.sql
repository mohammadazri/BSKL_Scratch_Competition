-- 025_category_phases_and_timers.sql
--
-- Replaces global event phase with per-category phases, and introduces 
-- sprint start times to enable countdown timers.

ALTER TABLE event_state
  ADD COLUMN IF NOT EXISTS phase_a event_phase NOT NULL DEFAULT 'setup',
  ADD COLUMN IF NOT EXISTS phase_b event_phase NOT NULL DEFAULT 'setup',
  ADD COLUMN IF NOT EXISTS phase_c event_phase NOT NULL DEFAULT 'setup',
  ADD COLUMN IF NOT EXISTS sprint_start_a timestamptz,
  ADD COLUMN IF NOT EXISTS sprint_start_b timestamptz,
  ADD COLUMN IF NOT EXISTS sprint_start_c timestamptz;

-- Migrate data from old global phase (if it exists) to the new columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_state' AND column_name = 'phase') THEN
    EXECUTE 'UPDATE event_state SET phase_a = phase, phase_b = phase, phase_c = phase';
    
    -- Drop dependent view before dropping column
    EXECUTE 'DROP VIEW IF EXISTS judge_queue';
    
    EXECUTE 'ALTER TABLE event_state DROP COLUMN phase';
  END IF;
END $$;

-- Recreate judge_queue view with per-category phase logic
CREATE OR REPLACE VIEW judge_queue AS
SELECT a.judge_id,
       a.section                                        AS assignment_section,
       p.id                                             AS participant_id,
       p.full_name,
       p.category,
       sch.name                                         AS school_name,
       p.theme,
       s.id                                             AS scoresheet_id,
       COALESCE(s.status, 'draft'::scoresheet_status)    AS status,
       (SELECT COUNT(*) FROM scores sc WHERE sc.scoresheet_id = s.id) AS scored_criteria_count,
       (SELECT COUNT(*) FROM criteria c
         WHERE c.category = p.category
           AND c.section = a.section)                   AS total_criteria_count
  FROM assignments a
  JOIN participants p ON p.id = a.participant_id
  JOIN schools sch ON sch.id = p.school_id
  LEFT JOIN scoresheets s
         ON s.participant_id = p.id
        AND s.judge_id = a.judge_id
        AND s.section  = a.section
  WHERE a.section = CASE
           WHEN p.category = 'A' AND (SELECT phase_a FROM event_state WHERE id = 1) = 'section_b' THEN 'B'::section
           WHEN p.category = 'B' AND (SELECT phase_b FROM event_state WHERE id = 1) = 'section_b' THEN 'B'::section
           WHEN p.category = 'C' AND (SELECT phase_c FROM event_state WHERE id = 1) = 'section_b' THEN 'B'::section
           ELSE 'A'::section
         END;
