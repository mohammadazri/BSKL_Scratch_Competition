-- 007_views.sql
-- Reporting views: final_rankings (results) and judge_queue (judge dashboard).
-- Both inherit RLS from their underlying tables, so role-based filtering
-- happens automatically.

-- ─────────────────────────────────────────────────────────────────────────────
-- final_rankings — auto-ranked per category, ties broken by sprint time
-- then by submission time.
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- judge_queue — per-judge dashboard listing their assigned participants and
-- the current scoresheet status (or 'draft' if not yet created).
-- ─────────────────────────────────────────────────────────────────────────────
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
