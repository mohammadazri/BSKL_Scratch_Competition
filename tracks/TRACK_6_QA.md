# Track 6 — Polish, mobile/tablet QA, end-to-end dry-run

**Goal:** make sure the app actually works on event day. Cover empty/loading/error states, run a full simulated event, fix what breaks, ship a small Playwright suite that re-runs the simulation on every push.

**Depends on:** Tracks 0–5 merged.

**Branch:** `track/6-qa`

**Inputs to read first:** all of them — you're the last person to look at the app before event day. The shared refs ([DEVELOPMENT.md](../DEVELOPMENT.md), [DESIGN.md](../DESIGN.md), [SCHEMA.md](../SCHEMA.md), [SEED_RUBRICS.md](../SEED_RUBRICS.md)) plus each `tracks/TRACK_N.md` for the acceptance criteria you're verifying.

---

## Approach

Three phases:

1. **Audit & checklist sweep** — walk every page, every state, fix gaps.
2. **End-to-end dry-run** with realistic fake data (15 students × 4 judges × 3 cats = at-scale rehearsal).
3. **Playwright smoke suite** — codify the dry-run so regressions can't slip through.

---

## Phase 1 — Audit sweep

For each page in the app, verify all four states:

| State | What to check |
|---|---|
| **Loading** | Skeleton or spinner; no layout shift when data arrives |
| **Empty** | Friendly `<EmptyState>` with action ("Your queue is empty. Check with admin.") |
| **Error** | Toast or banner with actionable message; not a raw stack trace |
| **Populated** | Renders correctly at small and large data sizes |

Create `docs/qa-audit.md` with a checklist row per page:

```
- [x] /admin/dashboard — loading + populated + error all good
- [ ] /admin/users — empty state missing on first install (no users) → fix
- [x] /judge — empty state present
- [ ] /judge/score/[id] — autosave error doesn't surface → fix
...
```

Tick each as you verify. Fix issues in small commits during this phase.

### Tablet pass (≥iPad-mini, 768×1024 portrait)

- All touch targets ≥ 44px
- Sidebar collapses to bottom-sheet or hamburger
- Scoring form sidebar becomes sticky bottom bar
- No horizontal scroll
- Forms readable without zoom

### Accessibility pass

Tools: axe DevTools, Lighthouse, manual keyboard nav.

- All interactive elements reachable by Tab
- Visible focus ring on every focused element (no `outline: none` without replacement)
- Form inputs have `<label>` (never placeholder-as-label)
- Status icons paired with text
- Contrast ratio ≥ 4.5:1 (verify dark mode + light mode)
- `prefers-reduced-motion` kills count-ups and flip animations

Track findings in `docs/qa-a11y.md`; fix as you go.

---

## Phase 2 — End-to-end dry-run

### Set up fake data

`scripts/seed-fake-event.ts` — creates a realistic state:

- 5 schools (e.g. "BSKL", "ISKL", "MKIS", "Garden", "Alice Smith")
- 45 participants (15 per category, ~9 per school)
- 4 judges + 1 super_admin (your test account) + 1 viewer
- Runs auto-assign for all 3 categories

Run as a one-shot against a **separate Supabase project** named `p3-judging-staging` — do NOT pollute the production DB.

### Walk the simulation

Open 5 browser profiles (or use Playwright trace mode):

1. **Super_admin tab** — open `/admin`, watch live dashboard
2. **Judge tab × 4** — each logs in as a different fake judge
3. **Viewer tab** — open `/viewer/results`

Simulate event flow:
- All 4 judges open their queue, start scoring their first participant
- Judges fill out scoresheets at realistic pace (3–5 min each, varied)
- Mid-event: super_admin overrides one score (verify it lands in audit, leaderboard updates)
- Mid-event: super_admin reassigns one participant from Judge A to Judge B (verify queue updates for both)
- Some scoresheets are submitted with sprint time set, some without (verify submit-blocked path)
- One judge raises a DQ flag (verify it shows in audit, participant still on leaderboard until super_admin sets `qualified = false`)
- End of event: super_admin locks event (verify all judges' forms become read-only)
- Super_admin exports results CSV; opens in Excel — looks right
- Super_admin exports audit CSV; opens in Excel — every action present

Document anything off in `docs/qa-dry-run.md`. Fix any issues. Re-run.

---

## Phase 3 — Playwright smoke suite

`e2e/` directory. Tests run against the staging Supabase project (configured via `.env.test`).

Required tests (one file each):

| File | Covers |
|---|---|
| `e2e/auth.spec.ts` | login (password + magic link), role redirect, logout |
| `e2e/admin-users.spec.ts` | create judge, assign role, deactivate |
| `e2e/admin-import.spec.ts` | CSV import of schools + participants, dq toggle |
| `e2e/admin-assign.spec.ts` | auto-assign preview + commit, manual swap |
| `e2e/judge-flow.spec.ts` | complete scoresheet end-to-end, submit, see in done page |
| `e2e/judge-autosave.spec.ts` | partial score, refresh page, draft restored exactly |
| `e2e/admin-override.spec.ts` | super_admin overrides score, audit log shows before/after |
| `e2e/leaderboard.spec.ts` | submit two scoresheets with same score; tiebreak by sprint time |
| `e2e/event-lock.spec.ts` | lock event, verify judge cannot save |
| `e2e/viewer.spec.ts` | viewer sees results + audit; no edit buttons |
| `e2e/rls-isolation.spec.ts` | Judge A cannot read Judge B's scoresheet via direct API call |

CI hook: `pnpm test:e2e` in a GitHub Actions or local pre-push hook (per Mohammad's preference — discuss in PR).

---

## Commit checkpoints

1. `qa: empty/loading/error state audit checklist`
2. `qa: fix missing empty state on /admin/users first-install`
3. `qa: fix autosave error not surfacing to user`
4. `qa: tablet portrait layout fixes`
5. `qa: keyboard navigation + focus-ring fixes`
6. `qa: contrast fixes in light mode`
7. `qa: seed-fake-event script for staging`
8. `qa: dry-run findings documented and fixed`
9. `qa: playwright auth + admin specs`
10. `qa: playwright judge flow + autosave specs`
11. `qa: playwright override + leaderboard tiebreak specs`
12. `qa: playwright rls isolation spec`
13. `qa: playwright event-lock + viewer specs`

(Many small commits — easy to bisect if something regresses.)

---

## Acceptance criteria

- [ ] Every page has verified loading, empty, error, populated states
- [ ] Tablet portrait (768×1024) usable without horizontal scroll on every page
- [ ] Axe DevTools reports 0 serious + 0 critical issues on every page
- [ ] Tab-only navigation can complete a full scoresheet from queue to done
- [ ] Contrast passes WCAG AA in both dark and light modes
- [ ] `pnpm tsx scripts/seed-fake-event.ts` produces a runnable staging environment
- [ ] Dry-run walkthrough completes with zero errors and matches expected leaderboard
- [ ] All Playwright specs pass green
- [ ] `docs/qa-dry-run.md` shows the simulation steps and outcomes
- [ ] No console errors / warnings during the full dry-run

## Out of scope

- ❌ Building new features (anything missing belongs to its track owner — open an issue, don't bandage here)
- ❌ Changing schema, design tokens, or rubric data (escalate to Track 1 / DESIGN / SEED owners)
- ❌ Production deploy (Track 7)

## Gotchas

- **Use a separate Supabase project for staging** — do NOT run fake-event seeding against production. Keeps real audit log clean.
- **Playwright + Supabase realtime:** flake-prone. Use `expect.poll()` for assertions on realtime-updated UI; don't use fixed `waitForTimeout`.
- **Tiebreak test:** to verify `live_sprint_time_seconds` sorting, set up two participants with identical total scores and different sprint times, then assert order. Watch out for NULLS LAST behaviour.
- **Logo verification:** add a Playwright assertion that both `static/brand/p3-logo.*` and `static/brand/bskl-logo.*` resolve to 200 (not 404). Catches the case where Track 0 brand assets get deleted accidentally.
- **The dry-run is the most important deliverable.** Tests catch regressions; the dry-run catches "the whole flow doesn't actually make sense." Don't skip it.
