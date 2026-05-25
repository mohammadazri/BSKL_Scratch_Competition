# Track 5 — Results, leaderboard, overrides, export

**Goal:** the leaderboard view that updates in real time as scoresheets get submitted, plus the super_admin override flow and the CSV export the awards committee uses.

**Depends on:** Tracks 0, 1 merged. Track 3 (submit flow) provides the data this page displays.

**Branch:** `track/5-results`

**Inputs to read first:**
- [../DEVELOPMENT.md](../DEVELOPMENT.md)
- [../DESIGN.md](../DESIGN.md) § 4 C — leaderboard mockup
- [../SCHEMA.md](../SCHEMA.md) — `final_rankings` view, `scores`, `disqualifications`
- [../SEED_RUBRICS.md](../SEED_RUBRICS.md)

---

## Routes you own

```
/admin/results                                      super_admin: full results + override
/admin/scoresheets/[id]                             super_admin: drill into one scoresheet, override scores
/viewer/results                                     viewer: same leaderboard, no override
/viewer/scoresheets/[id]                            viewer: drill-in, read-only
```

---

## `/admin/results` and `/viewer/results` — the leaderboard

Per [DESIGN.md](../DESIGN.md) § 4 C. Reads from the `final_rankings` view (defined in [SCHEMA.md](../SCHEMA.md)).

Columns: Rank, Participant, School, Score, Time, Status.

- Top 3 ranks get medal styling (★ in `--accent` for 1st, ☆ in `--text-2` for 2nd, ☆ in a warm-brown for 3rd).
- Ties show `ⓘ tied` chip next to rank.
- Status pill: draft / submitted / finalised / override-applied / DQ.
- Click row → `/admin/scoresheets/[id]` (or `/viewer/scoresheets/[id]`).

Filters at the top:
- Category (A / B / C) — default current selection from URL
- Theme (Eco-Warriors / Smart Cities / Space Pioneers / All)
- School (multiselect)
- Status (multiselect)

Sort: default is by rank ascending. Click any column header to re-sort.

Footer:
- Total scored, total pending, ties broken by sprint time count
- `Export CSV` button
- `Print podium` (super_admin) — generates a 1st/2nd/3rd certificate-style printable page per category

### Real-time updates

Subscribe to changes on `scoresheets` and `scores`:
- Any submit / update → refetch the rankings query (it's quick, the view is small).
- Smooth transitions when ranks change (Svelte `animate:flip` directive).

---

## `/admin/scoresheets/[id]` — drill-in + override

Shows the full scoresheet:

```
┌────────────────────────────────────────────────────────────────┐
│  ‹ Back to results                                              │
├────────────────────────────────────────────────────────────────┤
│  Aisha Tan · BSKL · Cat B · Eco-Warriors                       │
│  Judge: Sarah Tan  ·  Submitted 14:32:08  ·  Time 41:27        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  SECTION A                                                      │
│  ───────────                                                    │
│  Theme & Visual Design        Excellent · 15 / 16   ✎ note ›  │
│  Variables & Gameplay         Proficient · 16 / 22  ⚠ override │
│  Broadcasts & Game Flow       Excellent · 21 / 22              │
│  Code Organisation            Proficient · 7 / 10              │
│                                                                 │
│  SECTION B                                                      │
│  ───────────                                                    │
│  ...                                                            │
│                                                                 │
│  TOTAL  84 / 100         [ Override score ▾ ]  [ Unlock ⚠ ]   │
└────────────────────────────────────────────────────────────────┘
```

- `Override score`: click a criterion → modal:
  ```
  Override — Variables & Gameplay
  ────────────────────────────────
  Current: Proficient · 16 / 22 (by Sarah Tan)

  New level:   [Excellent ▾]
  New points:  ⟨ 20 ⟩  /22
  Reason (required):
  [_______________________________]

  [ Cancel ]  [ Override ⚠ ]
  ```
  - Reason field required (enforced both UI and DB constraint).
  - On confirm: UPSERT into `scores` with `is_override = true`, `override_reason = ...`. Audit trigger captures before/after.
  - Original score is NOT lost — `before_json` in audit_log contains it.

- `Unlock` button (super_admin only): sets `scoresheets.status = 'draft'` so the judge can re-edit. Requires confirmation + audit reason.

Viewer route renders the same layout but with override and unlock buttons hidden.

---

## CSV export

For results page export. Columns:

```
rank, category, participant_name, school_name, theme,
total_score, live_sprint_time_seconds, status, qualified,
judge_email, submitted_at
```

One row per participant. Sorted by category then rank.

Filename: `p3-results-YYYY-MM-DD-HHMM.csv`

Per-scoresheet export (from drill-in page): full criterion breakdown — one row per criterion with level + points + comment + is_override + override_reason.

---

## Override flow specifics

Server action `?/override`:

```ts
override: async ({ request, locals, params }) => {
  if (locals.user.role !== 'super_admin') throw error(403);

  const fd = await request.formData();
  const criterionId = fd.get('criterion_id') as string;
  const level = fd.get('level') as string;
  const points = Number(fd.get('points'));
  const reason = String(fd.get('reason') ?? '').trim();
  if (!reason) throw error(400, 'reason required');

  const { error: err } = await locals.supabase.from('scores').upsert({
    scoresheet_id: params.id,
    criterion_id: criterionId,
    level,
    points,
    comment: undefined,         // don't overwrite judge's comment
    is_override: true,
    override_reason: reason
  }, { onConflict: 'scoresheet_id,criterion_id' });

  if (err) throw error(500, err.message);
  return { overridden: true };
}
```

Audit trigger captures the full before/after automatically.

---

## Print podium (optional, time-permitting)

```
┌─────────────────────────────────────┐
│         CATEGORY B WINNERS          │
│                                      │
│              🏆                       │
│           Aisha Tan                  │
│              BSKL                    │
│            94 / 100                  │
│                                      │
│       2nd            3rd             │
│   Ravi Singh    Mei Lin Wu          │
│      ISKL          MKIS              │
│      91/100        91/100            │
└─────────────────────────────────────┘
```

`@media print` styles — one category per page, hide nav. Use brand fonts (Space Grotesk display). Logos at top.

---

## Commit checkpoints

1. `results: leaderboard reading from final_rankings view`
2. `results: category, theme, school filters`
3. `results: tied-rank indicator and tiebreaker annotation`
4. `results: realtime updates when scoresheets submit`
5. `results: csv export with judge + timing columns`
6. `results: drill-in scoresheet view`
7. `results: super_admin override flow with required reason`
8. `results: super_admin unlock-scoresheet to draft`
9. `results: viewer variant (read-only)`
10. `results: print podium page (optional)`

---

## Acceptance criteria

- [ ] Leaderboard renders correct ranks for known test data (set up in Track 6 dry-run)
- [ ] Two participants with identical score have ranks ordered by `live_sprint_time_seconds` ascending; same time → earlier submission wins
- [ ] Tied ranks both show the same rank number with `ⓘ tied` chip
- [ ] DQ'd participants (`qualified = false`) don't appear on leaderboard
- [ ] Submitting a scoresheet from Track 3 causes the leaderboard to update within 1s without manual refresh
- [ ] Super_admin override: reason required, override persists, original visible in audit log (Track 4)
- [ ] After override, the scoresheet drill-in shows ⚠ override badge on the affected criterion
- [ ] Viewer route hides all override/unlock buttons
- [ ] CSV export produces a valid file Excel/Numbers can open
- [ ] Filters combine correctly (Cat B + Eco-Warriors + School=BSKL)
- [ ] Page renders correctly with 135 rows (full event scale)

## Out of scope

- ❌ Creating, editing, or deleting scoresheets directly (Track 3 owns judge flow, Track 2 owns admin flow)
- ❌ Audit log UI (Track 4)
- ❌ User/school/participant CRUD (Track 2)

## Gotchas

- **`final_rankings` is a view** — querying it is the same as querying tables, but ORDER BY in the view + RANK() means the rows arrive pre-sorted and pre-ranked. Don't re-rank in JS; trust the SQL.
- **NULL live_sprint_time_seconds** for not-yet-submitted scoresheets sorts last (NULLS LAST in the view).
- **Animations with `animate:flip`** are subtle — kill them under `prefers-reduced-motion`.
- **Override audit:** the `audit_row` trigger captures `before_json` and `after_json` automatically — you don't write to audit_log manually. Don't try to "double-log" the reason; it's already in `after_json.override_reason`.
- **Realtime channel filters:** subscribing to ALL changes on `scoresheets` works at this scale, but in larger events you'd filter to `category = currentFilter`. For 135 rows, just refetch on any change.
- **Concurrent override risk:** if two super_admins (rare) override the same criterion at the same time, last-write-wins. Audit log preserves the full history. Acceptable.
