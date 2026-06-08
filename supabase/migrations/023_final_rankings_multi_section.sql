-- 023_final_rankings_multi_section.sql
--
-- Now that scoresheets are section-scoped (one per (participant, judge,
-- section)), the leaderboard has to combine BOTH sections to produce a
-- participant's total. The original view summed one scoresheet at a time
-- per participant — with two sheets, each participant showed up twice with
-- mismatched ranks.
--
-- New shape:
--   per_section: total points per (participant_id, section). Pulls the
--                MOST RECENT submitted/finalised sheet for that pair.
--                (There is at most one judge per section by the assignment
--                model, but if two scoresheets exist for some reason —
--                e.g. a re-assignment after work was done — we take the
--                one with the most recent submit time as canonical.)
--   per_participant: SUM section_a_points + SUM section_b_points.
--
-- Tiebreak inputs (sprint time, submission time) come from the Section B
-- sheet since the sprint happens during Section B. We coalesce so a
-- participant who only finished Section A still ranks below those with both.
--
-- Safe to re-run.

DROP VIEW IF EXISTS final_rankings;

CREATE VIEW final_rankings AS
WITH ranked_sheets AS (
  -- For each (participant, section), keep only the latest submitted sheet.
  -- ROW_NUMBER over submitted_at DESC means row_num=1 is canonical.
  SELECT s.id                              AS scoresheet_id,
         s.participant_id,
         s.judge_id,
         s.section,
         s.live_sprint_time_seconds,
         s.submitted_at,
         s.status,
         ROW_NUMBER() OVER (
           PARTITION BY s.participant_id, s.section
           ORDER BY s.submitted_at DESC NULLS LAST, s.id DESC
         ) AS rn
    FROM scoresheets s
   WHERE s.status IN ('submitted','finalised')
),
section_totals AS (
  SELECT rs.scoresheet_id,
         rs.participant_id,
         rs.judge_id,
         rs.section,
         rs.live_sprint_time_seconds,
         rs.submitted_at,
         COALESCE(SUM(sc.points), 0) AS total_points
    FROM ranked_sheets rs
    LEFT JOIN scores sc ON sc.scoresheet_id = rs.scoresheet_id
   WHERE rs.rn = 1
   GROUP BY rs.scoresheet_id, rs.participant_id, rs.judge_id,
            rs.section, rs.live_sprint_time_seconds, rs.submitted_at
),
per_participant AS (
  SELECT participant_id,
         COALESCE(SUM(total_points), 0) AS total_points,
         -- Sprint time + submitted_at come from Section B (event-day) sheets,
         -- since the sprint only happens during Section B.
         MAX(live_sprint_time_seconds) FILTER (WHERE section = 'B') AS live_sprint_time_seconds,
         MAX(submitted_at)              FILTER (WHERE section = 'B') AS submitted_at,
         -- Track which judges scored each section — useful for the UI's
         -- "scored by X (A) and Y (B)" caption. judge_id is a uuid and Postgres
         -- has no MAX(uuid); there is at most one judge per (participant,
         -- section) here, so aggregate via text and cast back.
         (MAX(judge_id::text) FILTER (WHERE section = 'A'))::uuid AS judge_id_a,
         (MAX(judge_id::text) FILTER (WHERE section = 'B'))::uuid AS judge_id_b
    FROM section_totals
   GROUP BY participant_id
)
SELECT p.id                              AS participant_id,
       p.full_name                       AS participant_name,
       sch.name                          AS school_name,
       p.category,
       p.theme,
       p.qualified,
       pp.total_points,
       pp.live_sprint_time_seconds,
       pp.submitted_at,
       -- Keep `judge_id` for backwards-compat with anything reading the old
       -- shape. Prefer the Section B judge (they're the event-day grader);
       -- fall back to Section A if only that exists.
       COALESCE(pp.judge_id_b, pp.judge_id_a) AS judge_id,
       pp.judge_id_a,
       pp.judge_id_b,
       RANK() OVER (
         PARTITION BY p.category
         ORDER BY pp.total_points DESC NULLS LAST,
                  pp.live_sprint_time_seconds ASC NULLS LAST,
                  pp.submitted_at ASC NULLS LAST
       ) AS rank
  FROM participants p
  JOIN schools sch ON sch.id = p.school_id
  LEFT JOIN per_participant pp ON pp.participant_id = p.id
 WHERE p.qualified = true;
