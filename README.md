# P3 Judging — Future Coders Challenge 2026

Judges' marking website for the **P3 Interschool Future Coders Challenge 2026** at the British International School of Kuala Lumpur (BSKL).

A digital scoring app that lets judges grade student Scratch projects across 3 categories using the official P3 rubric. Auto-assignment, live leaderboard, tiebreaker by sprint completion time, full audit log, super-admin override flow. Hosted on a Raspberry Pi behind a Cloudflare Zero Trust Tunnel.

**Event:** Saturday, July 25, 2026
**Tech lead:** Mohammad Azri, P3 Robotics & Coding

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | SvelteKit 2 + TypeScript + Svelte 5 |
| Styling | TailwindCSS v4 (CSS-first tokens) + JetBrains Mono / Inter / Space Grotesk |
| DB | Supabase Postgres (free tier, `ap-southeast-1`) |
| Auth | Supabase Auth (email/password + magic link) |
| Access control | Postgres Row Level Security (RLS) |
| ORM | Drizzle |
| Hosting | Raspberry Pi 4/5 + Cloudflare Zero Trust Tunnel (`cloudflared`) |
| Tests | Playwright (e2e), Vitest (unit) |

---

## Prerequisites

- **Node 20+** (Node 25 confirmed working on Windows)
- **pnpm 11+** — `npm install -g pnpm`
- **git**
- A **Supabase project** (free tier) with the database in `ap-southeast-1` (Singapore)

---

## Quick start

### 1. Clone

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

Open `.env` and fill in the values from your Supabase dashboard. Find them at:

- **Settings → API Keys** → Project URL, Publishable key, Secret key
- **Database** (left sidebar) → Connection string → URI → **Session pooler** mode

```bash
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# Super admin bootstrap (used only by scripts/seed-superadmin.ts)
SUPER_ADMIN_EMAIL=your@email.com
SUPER_ADMIN_PASSWORD=YourPassword
SUPER_ADMIN_NAME=Your Name
```

> ⚠ URL-encode special characters in your DB password. `#` becomes `%23`, `@` becomes `%40`, etc. Otherwise psql truncates at the special character.

### 3. Apply DB migrations and seed

```bash
pnpm tsx scripts/apply-migrations.ts   # creates tables, RLS, triggers, views (idempotent)
pnpm tsx scripts/seed-rubrics.ts       # seeds 20 criteria + 76 levels (idempotent)
pnpm tsx scripts/seed-superadmin.ts    # creates the super_admin account from .env (idempotent)
```

All three are safe to re-run. `seed-superadmin.ts` reads `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_NAME` from `.env` — if the account already exists it resets the password and re-promotes the profile.

Optionally verify RLS isolation:
```bash
pnpm tsx scripts/test-rls.ts
```

### 4. Run the dev server

```bash
pnpm dev
```

Open http://localhost:5173 and sign in with the super_admin credentials you set in `.env`. You're now the super_admin. Create judge + viewer accounts from `/admin/users`.

### 5. Dev server (already covered in step 4 above)

---

## Daily workflow

```bash
pnpm dev                          # dev server with HMR
pnpm build                        # production build for the Pi
pnpm preview                      # preview the production build locally
pnpm check                        # svelte-check (type errors)
pnpm lint                         # prettier + eslint
pnpm format                       # auto-fix formatting
pnpm test:unit                    # vitest unit tests
pnpm test:e2e                     # playwright e2e (needs .env.test)
```

---

## Roles & UX

| Role | Sees |
|---|---|
| `super_admin` | Everything. Imports schools/participants, creates judges, auto-assigns, overrides scores (with required reason), locks event, exports CSV. |
| `judge` | Only assigned participants. Fills scoresheet with autosave, captures Live Sprint time, raises DQ flag, submits. Cannot see other judges' scores. |
| `viewer` | Same read-only view as super_admin (leaderboard, audit log) but cannot edit. For principals, P3 management, sponsors. |

---

## Event flow on the day

1. **Pre-event:** super_admin imports schools + participants (CSV), creates 4 judge accounts, prints login slips, runs auto-assign (shuffle + round-robin + school-spread cap).
2. **Sprint (45 min):** each judge scores their assigned participants on `/judge/score/[id]` — autosave, sprint time capture, submit.
3. **Live leaderboard** at `/admin/results` updates as scoresheets submit. Ties auto-broken by faster Live Sprint time.
4. **Super_admin overrides** any disputed score with required reason (audit-logged with before/after diff).
5. **End:** super_admin locks event (no more edits), exports results CSV, prints podium per category.

---

## Project structure

```
judging-site/
├── README.md                  ← you are here
├── DEVELOPMENT.md             ← multi-agent dev plan, hard rules
├── SCHEMA.md                  ← full DB schema + RLS + triggers (single source of truth)
├── SEED_RUBRICS.md            ← all 3 categories' rubrics + JSON seed
├── DESIGN.md                  ← design tokens, components, screen mocks
├── tracks/                    ← per-track build specs (Track 0-7)
├── docs/                      ← qa-audit, qa-dry-run, qa-findings
│
├── src/
│   ├── app.css                ← Tailwind v4 @theme tokens
│   ├── app.d.ts               ← App.Locals types
│   ├── hooks.server.ts        ← per-request Supabase + session
│   ├── lib/
│   │   ├── components/        ← shared UI (AppShell, DataTable, RolePill, ...)
│   │   ├── results/           ← leaderboard query, scoresheet view, CSV
│   │   ├── audit/             ← audit log query, types, CSV
│   │   ├── stores/            ← global Svelte stores (Toast)
│   │   ├── utils/             ← csv parsing, time format helpers
│   │   ├── server/
│   │   │   ├── db/schema.ts   ← Drizzle schema mirror
│   │   │   ├── supabase.ts    ← server-side admin client
│   │   │   └── auto-assign.ts ← shuffle + round-robin + school-spread
│   │   ├── types.ts           ← shared TS types
│   │   └── supabase.ts        ← browser client
│   └── routes/
│       ├── login/             ← email + password + magic link
│       ├── auth/              ← Supabase OAuth callback
│       ├── admin/             ← super_admin (dashboard, users, schools, participants,
│       │                        assignments, event, audit, results, scoresheets/[id])
│       ├── judge/             ← judge (queue, score/[id], done/[id], audit)
│       └── viewer/            ← viewer (audit, results, scoresheets/[id])
│
├── supabase/
│   ├── migrations/            ← 001_extensions.sql … 007_views.sql
│   └── seed/rubrics.json      ← the 20-criterion seed
│
├── scripts/
│   ├── apply-migrations.ts    ← runs all .sql in supabase/migrations/ in order
│   ├── seed-rubrics.ts        ← imports rubrics.json
│   ├── seed-fake-event.ts     ← 5 schools + 45 fake students + 4 judges (dry-run)
│   ├── test-rls.ts            ← RLS smoke test
│   ├── install-pi.sh          ← first-time Pi install
│   ├── update.sh              ← pull + build + restart
│   ├── backup-supabase.sh     ← pg_dump rotation
│   └── README.md              ← operator runbook
│
├── systemd/p3-judging.service ← systemd unit for the Pi
├── cloudflared/               ← cloudflared tunnel config
├── e2e/                       ← Playwright smoke specs (9 + fixtures + README)
└── static/brand/              ← P3 + BSKL logos (replace placeholders before deploy)
```

---

## Documentation index

| File | What |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Overall plan, hard rules (commit policy, no AI attribution), track index |
| [SCHEMA.md](SCHEMA.md) | Full Postgres schema, RLS policies, triggers, views — source of truth |
| [SEED_RUBRICS.md](SEED_RUBRICS.md) | All 3 categories' rubrics (rebalanced to 70/30), JSON seed at the bottom |
| [DESIGN.md](DESIGN.md) | Premium Dark design system: tokens, components, screen mocks, brand rules |
| [tracks/TRACK_0_SETUP.md](tracks/TRACK_0_SETUP.md) → [TRACK_7_DEPLOY.md](tracks/TRACK_7_DEPLOY.md) | Per-track build specs |
| [docs/qa-dry-run.md](docs/qa-dry-run.md) | 15-step manual sanity check to run before event day |
| [docs/qa-findings.md](docs/qa-findings.md) | Known minor issues + which track owner should address |
| [scripts/README.md](scripts/README.md) | Pi operator runbook (install, update, backup, logs, tunnel) |
| [e2e/README.md](e2e/README.md) | How to run the Playwright suite, what each spec covers |
| [static/brand/TODO_BRAND_ASSETS.md](static/brand/TODO_BRAND_ASSETS.md) | Replace placeholder logos with real P3 + BSKL assets |

---

## Deploy to Raspberry Pi

Production runs on a **Raspberry Pi 4 (4GB+) or Pi 5** with **Cloudflare Zero Trust Tunnel** exposing the app at `https://p3.sentrizk.me`. No port forwarding, free TLS, optional email-allowlist via Cloudflare Access.

```
[Judges' browsers] ──HTTPS──> [Cloudflare Edge] ──tunnel──> [Pi: node build/index.js :3000] ──> [Supabase Postgres]
```

### Fresh Pi setup (step by step)

```bash
# 1. Install system dependencies
sudo apt-get update
sudo apt-get install -y git postgresql-client

# 2. Install Node 20 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# 3. Clone the repo
git clone https://github.com/mohammadazri/BSKL_Scratch_Competition.git
cd BSKL_Scratch_Competition

# 4. Create .env (copy example and fill in your values)
cp .env.example .env
nano .env

# 5. Install deps + build
pnpm install --frozen-lockfile
pnpm build

# 6. Apply migrations + seed
set -a; source .env; set +a
pnpm tsx scripts/apply-migrations.ts
pnpm tsx scripts/seed-rubrics.ts
pnpm tsx scripts/seed-superadmin.ts

# 7. Start the app
node build/index.js
```

The app listens on `HOST`/`PORT` from `.env` (default `127.0.0.1:3000`).

For production with auto-restart on reboot, use the systemd unit in `systemd/p3-judging.service`. Full operator runbook: [scripts/README.md](scripts/README.md).

To deploy an update after a `git push`:

```bash
cd BSKL_Scratch_Competition
git pull
pnpm install --frozen-lockfile
pnpm build
sudo systemctl restart p3-judging   # or: kill the node process and re-run node build/index.js
```

---

## Pre-event day checklist

- [ ] Real **P3 Robotics & Coding** + **BSKL** logos dropped into `static/brand/` (replace the placeholders — see [static/brand/TODO_BRAND_ASSETS.md](static/brand/TODO_BRAND_ASSETS.md))
- [ ] **Supabase secret key + DB password rotated** (Settings → API Keys + Database → Reset password) — `.env` updated everywhere
- [ ] `pnpm tsx scripts/seed-fake-event.ts` runs cleanly against a **separate staging Supabase project** (not production)
- [ ] [docs/qa-dry-run.md](docs/qa-dry-run.md) 15-step walkthrough completed end-to-end
- [ ] All 9 Playwright specs in `e2e/` pass green against staging
- [ ] Pi installed, cloudflared tunnel up, accessible at the public URL
- [ ] `scripts/backup-supabase.sh` cron enabled on the Pi for event day
- [ ] 4 judge accounts created + login slips printed
- [ ] All viewers (principals, P3 management, sponsors) invited

---

## Troubleshooting

**Nuclear reset — wipe the DB and start from scratch**

Run in the Supabase SQL Editor:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
DELETE FROM auth.users;
```
Then re-run the three seed commands from step 6 above.

---

**`tenant/user postgres.X not found` when applying migrations** — the `DATABASE_URL` region or cluster digit is wrong. Copy the exact URI from Supabase Dashboard → Database → Connection string → Session pooler. The format is `aws-<N>-<region>.pooler.supabase.com`, e.g. `aws-1-ap-southeast-1.pooler.supabase.com`.

**`getaddrinfo ENOTFOUND db.X.supabase.co`** — direct DB connection isn't available on free tier (IPv4 deprecation). Use the pooler URL instead (see above).

**`ERR_PNPM_IGNORED_BUILDS: esbuild`** — `pnpm-workspace.yaml` should list `esbuild` under `onlyBuiltDependencies`. If still failing, run `pnpm approve-builds esbuild` once.

**Route conflict `(app)/X and /X conflict`** — old SvelteKit cache. Run `rm -rf .svelte-kit` and re-run `pnpm dev`.

**Judge sees no participants** — their account isn't assigned. Super_admin runs auto-assign at `/admin/assignments` or manually swaps from the matrix.

**Event-day WiFi cut out** — judges' in-flight autosaves retry on reconnect. Submitted scoresheets are safe in Supabase. Drafts persist server-side and restore on tab reload.

---

## License & credits

Built by **Mohammad Azri** for **P3 Robotics & Coding** (https://www.p3platform.com/), hosted at the **British International School of Kuala Lumpur** (https://www.britishschool.edu.my/).

Internal project — not licensed for public reuse.
