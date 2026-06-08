# P3 Judging — Future Coders Challenge 2026

Judges' marking website for the **P3 Interschool Future Coders Challenge 2026** at the British International School of Kuala Lumpur (BSKL).

A digital scoring app that lets judges grade student Scratch projects across 3 categories using the official P3 rubric. The event runs in **two scored sections** (Section A pre-event prep, Section B the live event-day sprint), with auto-assignment, a live leaderboard, sprint-time tiebreaker, judge edit-request unlocks, an approval-gated disqualification flow, and a full audit log. Hosted on a Raspberry Pi behind a Cloudflare Zero Trust Tunnel.

**Event:** Saturday, July 25, 2026
**Tech lead:** Mohammad Azri, P3 Robotics & Coding

> **Coming back to this after a break? Jump to [Quick start](#quick-start).** That's the full "what do I run to get this going again" sequence.

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | SvelteKit 2 + TypeScript + Svelte 5 |
| Styling | TailwindCSS v4 (CSS-first tokens) + JetBrains Mono / Inter / Space Grotesk |
| DB | Supabase Postgres (free tier, `ap-southeast-1`) |
| Auth | Supabase Auth (email/password + magic link) |
| Access control | Postgres Row Level Security (RLS) |
| ORM | Drizzle (schema mirror + `drizzle-kit`) |
| Live updates | Supabase Realtime (leaderboard, edit-request + DQ toasts) |
| Audit log | Append-only **local JSONL file** on the host (not a Postgres table — see migration 013) |
| Hosting | Raspberry Pi 4/5 + Cloudflare Zero Trust Tunnel (`cloudflared`) |
| Tests | Playwright (e2e), Vitest (unit) |

---

## Prerequisites

- **Node 20+** (Node 25 confirmed working on Windows)
- **pnpm 11+** — `npm install -g pnpm` (`.npmrc` sets `engine-strict=true`, so the version matters)
- **git**
- A **Supabase project** (free tier) with the database in `ap-southeast-1` (Singapore)

---

## Quick start

This is the complete first-time-on-a-new-machine sequence. Every step is idempotent — safe to re-run if you get interrupted.

### 1. Clone & install

```bash
git clone <repo-url> judging-site
cd judging-site
pnpm install
```

If you hit `ERR_PNPM_IGNORED_BUILDS` for `esbuild`, the `pnpm-workspace.yaml` already lists it under `onlyBuiltDependencies`. If pnpm still complains, run `pnpm approve-builds esbuild` once.

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the values from your Supabase dashboard. The file is heavily commented — every variable says where to find it. The **five values required for local dev + seeding** are:

```bash
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co        # Settings → API → Project URL
PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>            # Settings → API → anon (a.k.a. publishable)
SUPABASE_URL=https://<project-ref>.supabase.co               # same URL again (server-side import)
SUPABASE_SERVICE_ROLE_KEY=<service_role / secret key>        # Settings → API → service_role (a.k.a. secret) — NEVER ship to browser
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Plus the **super-admin bootstrap** values, read only by `seed-superadmin.ts`:

```bash
SUPER_ADMIN_EMAIL=your@email.com
SUPER_ADMIN_PASSWORD=YourStrongPassword
SUPER_ADMIN_NAME=Your Name
```

> ⚠ **DATABASE_URL gotchas** (these are the two things that bite every time):
> - Use the **Session pooler** connection string (Database → Connect → Session pooler), *not* the direct `db.<ref>.supabase.co` host — the direct host isn't reachable on the free tier.
> - **URL-encode special characters in the password.** `#` → `%23`, `@` → `%40`, etc. Otherwise the connection truncates at the special character.

The remaining `.env` variables (`PUBLIC_APP_URL`, `HOST`/`PORT`/`NODE_ENV`, `CF_ACCESS_*`, `BACKUP_DIR`, `AUDIT_LOG_PATH`) are **deploy-only / optional** — local dev ignores them. They matter on the Pi (see [Deploy](#deploy-to-raspberry-pi)).

### 3. Apply DB migrations and seed

Run these **in this exact order**:

```bash
pnpm tsx scripts/apply-migrations.ts   # runs every supabase/migrations/*.sql in order (24 migrations) — tables, RLS, triggers, views
pnpm tsx scripts/seed-rubrics.ts       # seeds 20 criteria + 76 levels + checkpoints from supabase/seed/rubrics.json
pnpm tsx scripts/seed-superadmin.ts    # creates the super_admin account from your .env bootstrap values
```

All three are idempotent. `apply-migrations.ts` and `seed-rubrics.ts` only need `DATABASE_URL`. `seed-superadmin.ts` also needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the three `SUPER_ADMIN_*` values — if the account already exists it resets the password and re-promotes the profile.

Optionally verify RLS isolation:

```bash
pnpm tsx scripts/test-rls.ts           # needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SUPABASE_ANON_KEY
```

### 4. Run the dev server

```bash
pnpm dev
```

Open **http://localhost:5173** and sign in with the `super_admin` credentials from your `.env`. (The dev server binds `0.0.0.0`, so a tablet on the same WiFi can reach it at `http://<your-LAN-ip>:5173` for mobile testing.)

You're now the super_admin. From here you create the other accounts at **`/admin/users`** — judges, viewers, and registration-committee members. New accounts are created with a bootstrap password and a `must_change_password` flag, so each user is forced through `/auth/change-password` on first login.

---

## Daily workflow

```bash
pnpm dev                          # dev server with HMR (http://localhost:5173)
pnpm build                        # production build → build/ (adapter-node)
pnpm preview                      # preview the production build locally
pnpm check                        # svelte-check (type errors)
pnpm lint                         # prettier --check + eslint
pnpm format                       # prettier --write (auto-fix)
pnpm test:unit                    # vitest (client + server projects)
pnpm test:e2e                     # playwright (installs browsers first run; needs .env.test — see below)
```

**e2e tests** read `.env.test` (falling back to `.env`) and expect `PLAYWRIGHT_*` credentials plus `PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. They build and `preview` the app on **port 4173** (not the 5173 dev port). Point them at a **staging** Supabase project, never production.

---

## Roles & UX

| Role | Sees |
|---|---|
| `super_admin` | Everything. Creates users, imports schools/participants, auto-assigns, drives event phases, approves edit-requests and disqualifications, overrides scores (with required reason), locks the event, exports CSV. Can also be assigned scoring like any judge. |
| `registration_committee` | Setup-phase data-entry staff. Full CRUD on **schools and participants only** (own `/registration` area) — no scoring, no admin powers. |
| `judge` | Only their assigned participants, scoped per section. Fills the scoresheet (autosave drafts, checkpoint/level scoring, Live Sprint time on Section B), raises a DQ flag for admin approval, submits. Can request an unlock on a locked scoresheet. Cannot see other judges' scores. |
| `viewer` | Read-only mirror of the super_admin views (leaderboard, scoresheets, audit log). For principals, P3 management, sponsors. Cannot edit anything. |

---

## Event model (what changed since v1)

The scoring is split into **two sections**, gated by an **event phase** the super_admin advances from `/admin/event`:

```
setup ──► section_a ──► section_b ──► finalised
```

- **Section A** — pre-event preparation scoring. Assigned judges score Section A criteria; finishing soft-locks the sheet (`section_a_submitted_at`).
- **Section B** — the live event-day sprint. Potentially *different* judges score Section B (scoresheets are unique per **participant + judge + section**, so multiple judges can score one participant). Sprint completion time is captured here and is the leaderboard tiebreaker.

Other flows the original README predates:

- **Edit requests** — a judge who needs to fix a submitted/locked sheet raises a request; the super_admin approves or denies it at **`/admin/requests`**, which unlocks the sheet. Audit-logged.
- **Disqualification approval** — a judge's DQ flag is a *request* (`pending`), not an instant kill. The super_admin approves / denies / clears it before the participant drops off the leaderboard.
- **Realtime** — the leaderboard, edit-requests, and DQ pings update live via Supabase Realtime subscriptions (no refresh).
- **Audit log is local** — every audited action appends to a JSONL file on the host (`AUDIT_LOG_PATH`, default `~/.p3-judging/audit.jsonl`), read directly by the `/admin/audit`, `/judge/audit`, and `/viewer/audit` pages. It is no longer a Postgres table (migration 013, to dodge free-tier storage pressure).

---

## Event flow on the day

1. **Setup (pre-event):** super_admin (or registration_committee) imports schools + participants (CSV), super_admin creates judge / viewer accounts, prints login slips, and runs auto-assign (shuffle + round-robin + school-spread cap) at `/admin/assignments`.
2. **Section A:** assigned judges score the prep criteria; sheets soft-lock when submitted.
3. **Section B (45-min sprint):** super_admin advances the phase; judges score their Section-B participants on `/judge/score/[id]` — autosave, Live Sprint time capture, submit.
4. **Live leaderboard** at `/admin/results` sums Section A + Section B and updates as sheets submit. Ties auto-broken by the faster Section-B Live Sprint time.
5. **Adjustments:** super_admin approves edit-requests / disqualifications at `/admin/requests`, and overrides any disputed score with a required reason (audit-logged with before/after diff).
6. **End:** super_admin locks the event (`finalised` — no more edits), exports results CSV, prints the podium per category.

---

## Project structure

```
judging-site/
├── README.md                  ← you are here
├── DEVELOPMENT.md             ← multi-agent dev plan, hard rules (commit policy, no AI attribution)
├── SCHEMA.md                  ← DB schema + RLS + triggers (reference)
├── SEED_RUBRICS.md            ← all 3 categories' rubrics + JSON seed reference
├── DESIGN.md                  ← design tokens, components, screen mocks
├── TODO_BRAND_ASSETS.md       ← replace placeholder logos before deploy (lives at repo root)
├── tracks/                    ← per-track build specs (TRACK_0_SETUP … TRACK_7_DEPLOY)
├── docs/                      ← qa-audit.md, qa-dry-run.md, qa-findings.md
│
├── src/
│   ├── app.css                ← Tailwind v4 @theme tokens
│   ├── app.d.ts               ← App.Locals types (supabase, session, user, safeGetSession)
│   ├── app.html               ← document shell
│   ├── hooks.server.ts        ← per-request Supabase client + session (server-only; no client hook)
│   ├── lib/
│   │   ├── components/        ← shared UI — 30 root (AppShell, DataTable, CriterionCard,
│   │   │                        LiveTotalCard, OverrideModal, PrintableSlips, …) + audit/ + results/
│   │   ├── results/           ← leaderboard query, scoresheet view, CSV (types, query, scoresheet, csv)
│   │   ├── audit/             ← audit log query/loader, types, CSV
│   │   ├── stores/            ← global Svelte stores (toast.ts)
│   │   ├── utils/             ← csv.ts, random.ts
│   │   ├── server/
│   │   │   ├── db/schema.ts   ← Drizzle schema mirror
│   │   │   ├── supabase.ts    ← server-side admin client (service-role, bypasses RLS)
│   │   │   ├── guards.ts      ← requireRole() access control
│   │   │   ├── auto-assign.ts ← shuffle + round-robin + school-spread (pure, deterministic)
│   │   │   ├── reshuffle.ts   ← Section-B re-shuffle for category fairness
│   │   │   └── audit-local.ts ← append-only JSONL audit writer
│   │   ├── scoring.ts         ← rubric types + deriveLevelFromPoints / pointsFromCheckpoints
│   │   ├── realtime.ts        ← subscribeTable() Realtime wrapper
│   │   ├── app-url.ts         ← appUrl() canonical PUBLIC_APP_URL resolver
│   │   ├── types.ts           ← shared TS types (roles, phases, sections, table models)
│   │   └── supabase.ts        ← browser client
│   └── routes/
│       ├── login/             ← email + password + magic link, + forgot-password
│       ├── auth/              ← callback (OAuth), change-password, update-password
│       ├── logout/            ← POST sign-out
│       ├── admin/             ← super_admin: dashboard, users, schools, participants, assignments
│       │                        (auto / auto/commit / reshuffle-section-b), event, results (+export),
│       │                        scoresheets/[id] (+export), audit (+export), requests
│       ├── registration/      ← registration_committee: dashboard, schools (+import), participants (+import)
│       ├── judge/             ← judge: queue, score/[id], done/[id], audit
│       └── viewer/            ← viewer: results, scoresheets/[id], audit (+export)
│
├── supabase/
│   ├── migrations/            ← 001_extensions.sql … 024_judge_queue_section_aware.sql (24 files, applied in order)
│   └── seed/rubrics.json      ← 20 criteria across 3 categories × 2 sections, with checkpoints + 4-band levels
│
├── scripts/
│   ├── apply-migrations.ts    ← runs all .sql in supabase/migrations/ in order
│   ├── seed-rubrics.ts        ← imports rubrics.json
│   ├── seed-superadmin.ts     ← creates the super_admin from .env bootstrap values
│   ├── seed-fake-event.ts     ← 5 schools + 45 fake students + 4 judges + 1 viewer (staging dry-run)
│   ├── test-rls.ts            ← RLS isolation smoke test
│   ├── install-pi.sh          ← first-time Pi install (needs REPO_URL)
│   ├── update.sh              ← pull + build + restart on the Pi
│   ├── backup-supabase.sh     ← pg_dump rotation
│   └── README.md              ← Pi operator runbook (the real deploy reference)
│
├── systemd/p3-judging.service ← systemd unit (runs node build/index.js as p3judge on PORT 5999)
├── cloudflared/config.example.yml ← cloudflared tunnel config template
├── e2e/                       ← Playwright suite (11 specs + fixtures.ts + README)
└── static/brand/              ← P3 + BSKL logos (verify/replace before deploy)
```

---

## Documentation index

| File | What |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Overall plan, hard rules (commit policy, **no AI attribution anywhere**), track index |
| [SCHEMA.md](SCHEMA.md) | Postgres schema, RLS policies, triggers, views — reference |
| [SEED_RUBRICS.md](SEED_RUBRICS.md) | All 3 categories' rubrics (70/30 rebalance), JSON seed at the bottom |
| [DESIGN.md](DESIGN.md) | Premium Dark design system: tokens, components, screen mocks, brand rules |
| [tracks/TRACK_0_SETUP.md](tracks/TRACK_0_SETUP.md) → [TRACK_7_DEPLOY.md](tracks/TRACK_7_DEPLOY.md) | Per-track build specs |
| [docs/qa-audit.md](docs/qa-audit.md) | Empty / loading / error-state audit |
| [docs/qa-dry-run.md](docs/qa-dry-run.md) | 15-step manual sanity check to run before event day |
| [docs/qa-findings.md](docs/qa-findings.md) | Known minor issues + which track owner should address |
| [scripts/README.md](scripts/README.md) | Pi operator runbook (install, update, backup, logs, tunnel) — the authoritative deploy guide |
| [e2e/README.md](e2e/README.md) | How to run the Playwright suite, what each spec covers |
| [TODO_BRAND_ASSETS.md](TODO_BRAND_ASSETS.md) | Replace placeholder logos with real P3 + BSKL assets (at repo root) |

---

## Deploy to Raspberry Pi

Production runs on a **Raspberry Pi 4 (4GB+) or Pi 5** with a **Cloudflare Zero Trust Tunnel** exposing the app at `https://p3.sentrizk.me`. No port forwarding, free TLS, optional email-allowlist via Cloudflare Access.

```
[Judges' browsers] ──HTTPS──> [Cloudflare Edge] ──tunnel──> [Pi: node build/index.js :5999] ──> [Supabase Postgres]
```

> **Port note:** the systemd unit pins `PORT=5999` and the cloudflared config routes to `localhost:5999`, so **production listens on 5999** even though `.env`'s `PORT` default is `3000` (the unit's `Environment=` overrides the `.env` value). Local dev is unaffected (Vite uses 5173).

The full, current procedure lives in **[scripts/README.md](scripts/README.md)** — it covers `install-pi.sh`, the `cloudflared` tunnel + DNS, systemd, backups, logs, and troubleshooting. The short version:

```bash
# On the Pi — Raspberry Pi OS 64-bit (Bookworm+)
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<you>/judging-site.git /tmp/judging-site-bootstrap

# The installer handles Node 20, pnpm, cloudflared, postgresql-client, the p3judge
# user, clone to /opt/p3-judging, pnpm install + build, and the systemd unit.
REPO_URL="https://github.com/<you>/judging-site.git" \
  bash /tmp/judging-site-bootstrap/scripts/install-pi.sh
```

Then, per the installer's printed next steps:

1. Create `/opt/p3-judging/.env` from `.env.example`, fill in Supabase keys + `DATABASE_URL` (+ `PUBLIC_APP_URL`, and `AUDIT_LOG_PATH` if you want the audit log on a USB drive). `chown p3judge:p3judge` + `chmod 600` it. systemd's `EnvironmentFile` does **not** expand `${VAR}` — write literal values.
2. Apply migrations + seed (sources `.env` first so `DATABASE_URL` is in scope):
   ```bash
   set -a; source /opt/p3-judging/.env; set +a
   sudo -u p3judge -E pnpm tsx scripts/apply-migrations.ts
   sudo -u p3judge -E pnpm tsx scripts/seed-rubrics.ts
   sudo -u p3judge -E pnpm tsx scripts/seed-superadmin.ts
   ```
3. Set up the `cloudflared` tunnel + DNS (see [cloudflared/config.example.yml](cloudflared/config.example.yml)), then `sudo systemctl start p3-judging cloudflared`.

**Updating after a `git push` to main:**

```bash
sudo /opt/p3-judging/scripts/update.sh   # pull + install --frozen-lockfile + build + restart (sub-second)
```

---

## Pre-event day checklist

- [ ] Real **P3 Robotics & Coding** + **BSKL** logos in `static/brand/` (replace placeholders — see [TODO_BRAND_ASSETS.md](TODO_BRAND_ASSETS.md)). `install-pi.sh` / `update.sh` refuse to deploy if a logo is missing or zero bytes.
- [ ] **Supabase secret key + DB password rotated** (Settings → API + Database → Reset password) — `.env` updated everywhere
- [ ] `pnpm tsx scripts/seed-fake-event.ts` runs cleanly against a **separate staging Supabase project** (it refuses production unless `ALLOW_PROD=1`; seeded accounts use password `p3-staging-pass!`)
- [ ] [docs/qa-dry-run.md](docs/qa-dry-run.md) 15-step walkthrough completed end-to-end across both sections
- [ ] All 11 Playwright specs in `e2e/` pass green against staging (with `.env.test` set)
- [ ] Pi installed, cloudflared tunnel up, accessible at the public URL
- [ ] `AUDIT_LOG_PATH` directory exists and is writable on the Pi (the audit log is a local file now)
- [ ] `scripts/backup-supabase.sh` cron enabled on the Pi for event day (disable it that evening)
- [ ] Judge + registration accounts created, login slips printed, viewers (principals, sponsors) invited

---

## Troubleshooting

**Nuclear reset — wipe the DB and start from scratch.** Run in the Supabase SQL Editor:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
DELETE FROM auth.users;
```
Then re-run the three seed commands from [Quick start step 3](#3-apply-db-migrations-and-seed).

**`tenant/user postgres.X not found` when applying migrations** — the `DATABASE_URL` region or cluster digit is wrong. Copy the exact URI from Supabase → Database → Connect → **Session pooler**. Format is `aws-<N>-<region>.pooler.supabase.com`, e.g. `aws-1-ap-southeast-1.pooler.supabase.com`.

**`getaddrinfo ENOTFOUND db.X.supabase.co`** — the direct DB host isn't available on the free tier. Use the pooler URL (above).

**`ERR_PNPM_IGNORED_BUILDS: esbuild`** — `pnpm-workspace.yaml` lists `esbuild` under `onlyBuiltDependencies`; if it still fails, run `pnpm approve-builds esbuild` once.

**Route conflict `(app)/X and /X conflict`** — stale SvelteKit cache. Delete `.svelte-kit` and re-run `pnpm dev`.

**Judge sees no participants** — either they aren't assigned (run auto-assign at `/admin/assignments`), or the **event phase doesn't match their section** — the judge queue only shows Section-A judges during `section_a` and Section-B judges during `section_b`. Check the phase at `/admin/event`.

**A submitted scoresheet needs fixing** — the judge raises an edit-request; the super_admin approves it at `/admin/requests` to unlock the sheet. Don't edit the DB by hand.

**Event-day WiFi cut out** — in-flight autosaves retry on reconnect; submitted sheets are safe in Supabase; drafts persist server-side and restore on tab reload.

---

## License & credits

Built by **Mohammad Azri** for **P3 Robotics & Coding** (https://www.p3platform.com/), hosted at the **British International School of Kuala Lumpur** (https://www.britishschool.edu.my/).

Internal project — not licensed for public reuse.
</content>
</invoke>
