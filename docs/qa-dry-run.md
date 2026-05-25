# Pre-event dry-run checklist

Roughly one hour. Walk this on the morning of, after `pnpm run build` ships
and before any judges are let near a tablet. Tick each step pass/fail. If
any step fails, fix-or-document-then-fix before the event starts.

The Playwright suite (`pnpm playwright test`) covers most of this
automatically — this document is the manual sanity check that catches the
things tests can't (visual polish, mobile feel, "does the flow actually
make sense").

## 0. Pre-flight

- [ ] `pnpm install` clean, no peer warnings beyond known noise.
- [ ] `pnpm run check` reports 0 errors + 0 warnings.
- [ ] `pnpm run build` finishes in under 30s without warnings.
- [ ] Production-equivalent `.env` populated (NOT the staging values).
- [ ] Staging Supabase project reachable; latest migrations applied.
- [ ] `static/brand/p3-logo.svg` and `static/brand/bskl-logo.svg` both
      load in a fresh tab (no 404).
- [ ] Mobile DevTools open at 768×1024 (iPad mini portrait) for the entire
      walkthrough — every page must render without horizontal scroll.

## 1. Seed staging

- [ ] `pnpm tsx scripts/seed-fake-event.ts` runs clean.
- [ ] Console reports 5 schools, 45 participants, 4 judges, 1 viewer, ~45
      assignments. Reasonable spread (each judge ~11 participants).
- [ ] Run it a second time — should still succeed (idempotency).

## 2. Sign in as super_admin

- [ ] `/login` renders the centred card with both logos visible.
- [ ] Email + password sign-in works first try; lands on `/admin`.
- [ ] Dashboard shows 3 progress bars (all at 0%), judge load card lists
      all 4 fake judges, recent activity has the `login` row at the top.
- [ ] LiveIndicator green dot ("live") visible.

## 3. Admin smoke

- [ ] `/admin/users` lists the 4 judges + 1 viewer + you. Print login slips
      → preview opens, the PDF / print dialog shows 4-up A4 layout.
- [ ] `/admin/schools` lists 5 schools. CSV import widget opens. Cancel.
- [ ] `/admin/participants` lists 45 rows. Filter by Category B → 15 rows.
      DQ toggle on one row flips visibly.
- [ ] `/admin/assignments` shows the assignment matrix with no empty judge
      columns. Auto-assign preview button opens a modal.
- [ ] `/admin/event` shows event name, sprint minutes 45, date set/locked.
      Lock + unlock buttons visible.
- [ ] `/admin/audit` shows the dashboard activity, including the
      `assignment_auto_run` row from step 1.
- [ ] `/admin/results` shows the leaderboard (likely empty totals so far).

## 4. Judge dry-run

Open a private window. Sign in as `judge1@seed.p3-judging.local` with the
staging password.

- [ ] Lands on `/judge` (queue). Sees ~11 participants.
- [ ] Click first row → `/judge/score/[id]`. Sticky header with participant
      name visible.
- [ ] Live total card on the right (desktop) / bottom (tablet) shows 0 / max.
- [ ] Click any "Excellent" radio → live total updates immediately.
- [ ] Save-status indicator transitions Saving… → Saved within ~1.5s.
- [ ] Fill out every criterion in Section A. Fill out every criterion in
      Section B. Enter a sprint time (mm:ss). Live total reflects sum.
- [ ] Hard-reload the page. **All selections must persist** (this is the
      autosave restore — the single most-tested path).
- [ ] Submit. Confirm modal appears. Confirm. Lands on `/judge/done/[id]`.
- [ ] Done page shows the recap (total, sprint, per-criterion).

## 5. Concurrent judges

Open 3 more private windows. Sign in as judges 2, 3, 4.

- [ ] Each can see their own queue, scoped to their assignments only.
- [ ] Each can submit at least one scoresheet.

## 6. Cross-judge isolation spot-check

In a private window logged in as Judge 2:

- [ ] Try navigating to `/judge/score/<participantId-belonging-to-judge1>`.
      Should either redirect to `/judge` or show "not in your queue."
- [ ] Try the same URL with the `?download=...` export hint — same result.

## 7. Live mid-event flow

Super_admin tab still open from step 2.

- [ ] `/admin` dashboard now shows non-zero progress for each category.
- [ ] Live activity tail receives `scoresheet_submit` rows in real time
      (within ~1s) as the judges submit.
- [ ] `/admin/results` updates (refresh) — submitted scoresheets show on
      the leaderboard.

## 8. Override + audit

Pick one submitted scoresheet via `/admin/results` → drill in.

- [ ] Click "Override" on one criterion.
- [ ] Modal pre-fills current level + points; pick a different level;
      supply a reason ("dry-run test override"); save.
- [ ] Criterion now shows the "override" pill + reason tooltip.
- [ ] Leaderboard re-totals correctly.
- [ ] `/admin/audit` top row is the `score_override` action; expand →
      JsonDiff shows `points` and `level` before/after.

## 9. Reassignment

- [ ] `/admin/assignments` → reassign one participant from Judge 1 to Judge 4.
- [ ] Judge 1's queue refreshes (within a page reload) and no longer
      contains that participant.
- [ ] Judge 4's queue refreshes and now contains it.

## 10. DQ flag

In a judge tab:

- [ ] On any scoresheet, raise a DQ flag with a reason. The DQ badge shows.
- [ ] `/admin/audit` shows `dq_flag_raise`.
- [ ] `/admin/results` still lists the participant (DQ flag alone doesn't
      remove them from the leaderboard — only `qualified = false` does).
- [ ] As super_admin on `/admin/participants`, set the same participant's
      qualified=false. Leaderboard now drops them.

## 11. Lock + finalise

Super_admin tab:

- [ ] `/admin/event` → "Lock event". Confirm modal. Locks.
- [ ] Dashboard shows the red "Event locked" pill.
- [ ] In every judge tab, open any scoresheet (or refresh the existing
      one). Form is read-only — radios disabled, no autosave indicator.
- [ ] As super_admin, try to override a score. Either button is disabled
      or the action fails with a friendly message — never a 500.

## 12. Exports

- [ ] `/admin/results` → Export CSV. Open in Excel/Numbers/LibreOffice.
      Columns: rank, participant, school, category, total, sprint_time,
      per-section subtotals, DQ flag. No raw UUIDs in user-facing columns.
- [ ] `/admin/audit` → Export CSV. Every action from steps 2–11 present.
      Timestamps in ISO-8601 UTC. Before/after JSON survives Excel's
      auto-formatting (text-typed cells).
- [ ] `/admin/results/print` → A4 portrait, header has both logos, ranks
      legible from arm's length.

## 13. Viewer

Private window. Sign in as `viewer1@seed.p3-judging.local`.

- [ ] Lands on `/viewer` placeholder. Click through to `/viewer/results`.
- [ ] Leaderboard visible; NO override / unlock buttons anywhere on the page.
- [ ] `/viewer/audit` visible; Export CSV present; NO raise-DQ / clear-DQ
      / override / unlock buttons.
- [ ] Try navigating to `/admin` by URL → bounced (302 → `/viewer`, or
      403). Never reaches the admin dashboard.

## 14. Reset for the real event

- [ ] Unlock the event (`/admin/event`).
- [ ] **Either** wipe all scoresheets + DQ flags from the staging DB
      (`DELETE FROM scoresheets;` cascades — RLS off as super-admin)
      **or** re-run `pnpm tsx scripts/seed-fake-event.ts` (idempotent —
      deletes + recreates fixtures).
- [ ] Confirm dashboard returns to 0 / 45 across all categories.

## Sign-off

| Step | Result | Notes |
| --- | --- | --- |
| 0 | | |
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
| 9 | | |
| 10 | | |
| 11 | | |
| 12 | | |
| 13 | | |
| 14 | | |

Anything that fails: open an issue tagged with the responsible track number
(0–7) and either fix-and-retest or escalate to Mohammad. The dry-run is the
last line of defence — don't skip steps just because the Playwright suite
went green.
