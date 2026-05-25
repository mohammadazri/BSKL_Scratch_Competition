# `e2e/` — Playwright smoke suite

Owned by Track 6 (QA). These tests codify the dry-run from `docs/qa-dry-run.md`
so the same set of regressions can't slip through twice.

## Setup

1. **Spin up a separate staging Supabase project.** Do not point these tests at
   production — they create / mutate / delete data freely. The seed script
   (`scripts/seed-fake-event.ts`) refuses to run against any host whose name
   contains `prod`, but the Playwright suite has no equivalent guardrail, so
   the responsibility is on you.

2. **Apply migrations + seed rubrics on staging.** Same commands as production:

   ```bash
   pnpm tsx scripts/apply-migrations.ts
   pnpm tsx scripts/seed-rubrics.ts
   ```

3. **Bootstrap a super_admin** for staging through the Supabase studio or the
   admin UI (`/admin/users` — but you'll need an existing super_admin to log in
   first; for the very first run, insert one row into `profiles` directly with
   `role = 'super_admin'`).

4. **Seed fake data** (judges, viewer, schools, participants, assignments):

   ```bash
   pnpm tsx scripts/seed-fake-event.ts
   ```

   This is idempotent — re-running wipes and recreates fixtures.

5. **Create `.env.test`** at the repo root (gitignored). Example:

   ```ini
   PLAYWRIGHT_BASE_URL=http://localhost:4173

   # Real super_admin you bootstrapped manually
   PLAYWRIGHT_SUPER_ADMIN_EMAIL=mohammad@example.com
   PLAYWRIGHT_SUPER_ADMIN_PASSWORD=<the real password>

   # Seeded by scripts/seed-fake-event.ts
   PLAYWRIGHT_JUDGE_EMAIL=judge1@seed.p3-judging.local
   PLAYWRIGHT_JUDGE_PASSWORD=p3-staging-pass!
   PLAYWRIGHT_JUDGE2_EMAIL=judge2@seed.p3-judging.local
   PLAYWRIGHT_JUDGE2_PASSWORD=p3-staging-pass!
   PLAYWRIGHT_VIEWER_EMAIL=viewer1@seed.p3-judging.local
   PLAYWRIGHT_VIEWER_PASSWORD=p3-staging-pass!

   # Required by the RLS isolation harness
   PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

   Then load it before the run:

   ```bash
   set -a; source .env.test; set +a
   ```

   (or use `dotenv -e .env.test -- pnpm playwright test` if you prefer).

6. **Run the suite:**

   ```bash
   pnpm playwright test           # all specs, headless
   pnpm playwright test --ui      # UI mode for debugging
   pnpm playwright test e2e/auth.spec.ts   # one spec
   ```

   `playwright.config.ts` boots `pnpm run build && pnpm run preview` for you
   on port 4173. To point at a long-running dev server instead:

   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:5173 \
   PLAYWRIGHT_WEB_SERVER_CMD="pnpm dev --port 5173" \
   PLAYWRIGHT_PORT=5173 \
   pnpm playwright test
   ```

## What each spec covers

| File | Covers |
| --- | --- |
| `auth.spec.ts` | `/login` UI shape (both password + magic-link forms reachable), wrong-password handling, role-based redirect (`/admin`, `/judge`, `/viewer`), logout. Also asserts both brand logos resolve to 200 (catches accidental Track 0 deletion). |
| `admin-import.spec.ts` | Schools CSV preview + commit, participants CSV preview + commit, DQ toggle on a participant row. Idempotent via a per-run `[e2e-import-<ts>]` prefix. |
| `admin-assign.spec.ts` | Auto-assign preview shows a balanced split (2-6 participants per judge for 15 ÷ 4), commit, manual reassign. |
| `judge-flow.spec.ts` | Pick first queue item, fill every criterion at Proficient, fill sprint time, autosave settles, submit, land on `/judge/done/[id]`. |
| `judge-autosave.spec.ts` | Fill two criteria, wait for autosave, hard-reload, both selections still checked. The single most important regression test in the suite — autosave is the most-trusted feature on event day. |
| `admin-override.spec.ts` | Super_admin overrides one criterion with a reason; audit log shows the before/after diff for `points` / `level`. |
| `leaderboard.spec.ts` | Tiebreak: in any tied-total bucket, the row with the smaller `live_sprint_time_seconds` appears higher; NULL sprints sort LAST. Skips itself with a hint if no tie exists in current staging data. |
| `event-lock.spec.ts` | Super_admin locks the event, judge form becomes read-only (radios disabled / banner visible), super_admin unlocks afterwards to restore staging. Touches global state — runs last alphabetically by design. |
| `viewer.spec.ts` | Viewer sees `/viewer/results` + `/viewer/audit`, has NO override / unlock / delete / reassign buttons anywhere, and is bounced away from `/admin`. |
| `rls-isolation.spec.ts` | Judge A's JWT can't read Judge B's scoresheet via direct PostgREST. Skips itself if `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` aren't in env. |

## Shared helpers

- `e2e/fixtures.ts` — `accounts.superAdmin / judge / judge2 / viewer`,
  `signIn(page, account)`, `signOut(page)`, `expectAutosaveSaved(page)`.

The harness deliberately does not use Playwright's `storageState` —
Supabase JWTs expire and the per-spec login is cheap (~1s).

## Adding a new spec

1. Pick a filename that sorts intelligently against the existing order
   (lock state mutators last, read-only reads early). Filename ends in
   `.spec.ts` so `playwright.config.ts`'s `testMatch` picks it up.

2. Import `accounts` + `signIn` from `./fixtures`, not from anywhere else.

3. Use `expect.poll()` or `expect(locator).toBeVisible({ timeout })` rather
   than `page.waitForTimeout(n)` — Supabase realtime is flake-prone.

4. If you mutate global singleton state (event lock, event metadata) you MUST
   restore it before the spec ends. The next spec assumes a writable DB.

5. Run the suite end-to-end at least once locally before pushing. Don't rely
   on CI for the first green.

## CI

Mohammad's call (per Track 6 spec). Likely setup: GitHub Actions job that
provisions ephemeral Supabase via a separate `pnpm tsx
scripts/seed-fake-event.ts`, runs `pnpm playwright test`, uploads the HTML
report on failure. Out of scope for this track — add `.github/workflows/e2e.yml`
post-event.
