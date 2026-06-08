-- 024_judge_queue_section_aware.sql
--
-- judge_queue now reflects the CURRENT event phase. With multi-judge per
-- participant, a judge X assigned to Section A but NOT Section B should
-- only see "their" participants while phase = section_a. When phase flips
-- to section_b, X's queue empties and Y's queue (whoever caught the Section
-- B assignments) populates.
--
-- We resolve the active section from event_state inside the view so the
-- query layer doesn't have to thread it through every call.
--
-- During setup / finalised the queue defaults to Section A so judges still
-- see something useful in pre-event / post-event prep windows.
--
-- Safe to re-run.
--
-- NOTE: this view ADDS `assignment_section` as a new column in the middle of
-- the column list, which CREATE OR REPLACE VIEW cannot do ("cannot change name
-- of view column ..."). We DROP first (like 023 does for final_rankings) so the
-- migration actually applies over the older section-unaware judge_queue.

DROP VIEW IF EXISTS judge_queue;

CREATE VIEW judge_queue AS
WITH active_section AS (
  SELECT CASE
           WHEN (SELECT phase FROM event_state WHERE id = 1) = 'section_b' THEN 'B'::section
           ELSE 'A'::section
         END AS section
)
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
  JOIN active_section act ON a.section = act.section
  JOIN participants p ON p.id = a.participant_id
  JOIN schools sch ON sch.id = p.school_id
  LEFT JOIN scoresheets s
         ON s.participant_id = p.id
        AND s.judge_id = a.judge_id
        AND s.section  = a.section;
