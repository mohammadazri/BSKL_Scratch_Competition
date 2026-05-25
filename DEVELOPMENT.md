# P3 Future Coders Challenge 2026 — Judges' Marking Website

**Tech lead:** Mohammad Azri
**Event:** Saturday, 25 July 2026 — British International School of Kuala Lumpur (BSKL)
**Doc purpose:** the single source of truth for multiple AI agents working in parallel on this website.

---

## 0. Hard rules — read before touching anything

### 0.1 Git commit policy — NO AI ATTRIBUTION

Every commit on this repo MUST follow these rules:

- **DO NOT** add a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
- **DO NOT** add a `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line.
- **DO NOT** mention Claude, Anthropic, AI, LLM, or any tooling in the commit body.
- Write commits in plain natural language as if Mohammad wrote them himself.
- Use the local `git config user.name` / `user.email` — do not override identity.

The default Claude Code commit template adds an AI attribution trailer. **Ignore it.** Strip the trailer before running `git commit`.

Correct commit format:

```bash
git commit -m "add judge auto-assign endpoint with school-spread constraint"
```

Wrong (do not do this):

```bash
git commit -m "$(cat <<'EOF'
add judge auto-assign endpoint

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 0.2 Commit often

- One feature / one fix / one schema change = one commit.
- Push after every commit so other agents see your work.
- Small commits make merge conflicts cheap and history readable.
- Don't lump a day's work into one giant commit.

### 0.3 Don't break the contract files

These files define interfaces other agents depend on. If you need to change them, **announce in the commit message** (`schema: add column X for Y`) and update any downstream code in the same commit:

- `SCHEMA.md` — DB structure & RLS
- `SEED_RUBRICS.md` — rubric reference data
- `src/lib/server/db/schema.ts` — Drizzle schema (once Track 1 lands)
- `src/lib/types.ts` — shared TS types

### 0.4 No Claude/AI mentions anywhere user-visible

In the app UI, in error messages, in the README, in `package.json` description — nothing. It's Mohammad's project.

---

## 1. What we're building

A web app that lets **judges** score student Scratch projects during the P3 Future Coders Challenge 2026.

**Three user roles:**
- **`super_admin`** — Mohammad. Full control: create users, assign roles, import participants, run auto-assignment, override scores (audit-logged), view audit log, export results. Can also be assigned scoring like any judge.
- **`judge`** — 4 accounts. Sees only their assigned participants. Fills rubric scoresheets, saves drafts, submits. Cannot see other judges' scores or drafts.
- **`viewer`** — Read-only observers (principals, P3 management, sponsors, BSKL admin). Sees **everything** super_admin sees — participants, scores, leaderboard, audit log — but cannot edit, override, submit, or delete anything. Useful for live transparency at the venue without exposing edit power.

**The event flow:**
1. Pre-event: super_admin imports schools + participants (up to 45 per category × 3 categories = 135 total), creates 4 judge accounts + any viewer accounts, clicks "auto-assign" — each judge gets ~11 participants per category.
2. Event day (45-min sprint): students complete Phase 2 Mystery Objective. Each judge scores their assigned participants on a digital rubric. Time-to-complete captured for tiebreaker.
3. As scoresheets are submitted, the leaderboard updates live. Ties auto-broken by sprint completion time. Viewers watch the leaderboard / audit log on the venue screens.
4. Super_admin can override any score (reason required, audit-logged), export final standings to CSV.
5. Every action is in the audit log — append-only, exportable, real-time tailable.

---

## 2. Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | **SvelteKit** + TypeScript | Form-actions with progressive enhancement = scoring works on flaky venue WiFi; small JS bundle for tablets |
| Styling | **TailwindCSS** | Tablet/mobile-responsive without a designer |
| DB | **Supabase Postgres** (free tier, region `ap-southeast-1` Singapore) | Managed, ~30ms from KL, RLS replaces app-layer auth, realtime channels for live scoreboard |
| Auth | **Supabase Auth** (magic-link + password) | No code to write; magic-link emailed to judge, fallback password printed on paper |
| ORM | **Drizzle** | Type-safe, lightweight, fast migrations |
| Audit | **Postgres triggers** → append-only `audit_log` table | Impossible to bypass from app code |
| Hosting | **Raspberry Pi** + **Cloudflare Tunnel (`cloudflared`)** | Public HTTPS URL, no port forwarding, free TLS |
| Optional security | **Cloudflare Access** | Email-allowlist before login page even loads |

---

## 3. Repo structure

```
judging-site/
├── DEVELOPMENT.md          ← you are here
├── SCHEMA.md               ← shared reference (full DB schema + RLS + triggers)
├── SEED_RUBRICS.md         ← shared reference (all 3 categories' rubric seed data)
├── tracks/
│   ├── TRACK_0_SETUP.md    ← BLOCKS ALL OTHERS — scaffold the project
│   ├── TRACK_1_DB.md       ← schema, RLS, triggers, seed
│   ├── TRACK_2_ADMIN.md    ← super-admin UI (users, participants, assignments)
│   ├── TRACK_3_SCORING.md  ← judge scoring form  ⭐ main UX
│   ├── TRACK_4_AUDIT.md    ← audit log UI + export
│   ├── TRACK_5_RESULTS.md  ← leaderboard, overrides, CSV export
│   ├── TRACK_6_QA.md       ← polish, mobile, dry-run with fake data
│   └── TRACK_7_DEPLOY.md   ← Pi + cloudflared deploy scripts
├── src/                    ← SvelteKit source (created by Track 0)
├── supabase/               ← migrations & seed SQL (Track 1)
├── scripts/                ← install-pi.sh, update.sh, etc. (Track 7)
├── e2e/                    ← Playwright smoke tests (Track 6)
└── .env.example            ← documented env vars (no secrets committed)
```

---

## 4. Local development setup

```bash
# Prereqs: Node 20 LTS, pnpm (or npm), git
cd judging-site
pnpm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase dashboard
pnpm dev
# → http://localhost:5173
```

To get Supabase credentials:
1. Sign in at https://supabase.com → New project → name `p3-judging-2026`, region `Southeast Asia (Singapore)`, free tier.
2. Settings → API → copy `URL` and `anon` key into `.env`.
3. Settings → API → copy `service_role` key into `.env` as `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose to client).
4. SQL Editor → paste the migration from Track 1.

**Don't commit `.env`.** `.env.example` documents the variable names with placeholder values.

---

## 5. Branch & merge strategy

To keep multiple agents from stepping on each other:

- `main` — always deployable; only Track 0 commits land here directly during scaffolding.
- `track/<n>-<short-name>` — one branch per track (e.g. `track/3-scoring-form`).
- Each track commits to its own branch and pushes often.
- When a track's acceptance criteria are met, open a PR to `main`. Squash-merge is fine; if you keep all commits, ensure none have AI attribution.
- **Resolve schema conflicts in `SCHEMA.md` first** — if two tracks need a column change, update `SCHEMA.md` in a tiny coordination commit, then both tracks rebase.

---

## 6. Track assignments

| Track | Goal | Depends on | Doc |
|---|---|---|---|
| 0 | Scaffold project (SvelteKit, Tailwind, Drizzle, Supabase client, Lucia → skipped) | — | [tracks/TRACK_0_SETUP.md](tracks/TRACK_0_SETUP.md) |
| 1 | Apply schema, RLS, triggers, seed rubrics | 0 | [tracks/TRACK_1_DB.md](tracks/TRACK_1_DB.md) |
| 2 | Super-admin UI (users, schools, participants, assignments) | 0, 1 | [tracks/TRACK_2_ADMIN.md](tracks/TRACK_2_ADMIN.md) |
| 3 | Judge scoring form ⭐ | 0, 1 | [tracks/TRACK_3_SCORING.md](tracks/TRACK_3_SCORING.md) |
| 4 | Audit log UI + export | 0, 1 | [tracks/TRACK_4_AUDIT.md](tracks/TRACK_4_AUDIT.md) |
| 5 | Results, overrides, CSV export | 0, 1, 3 | [tracks/TRACK_5_RESULTS.md](tracks/TRACK_5_RESULTS.md) |
| 6 | Polish, mobile QA, dry-run | 0, 2, 3, 4, 5 | [tracks/TRACK_6_QA.md](tracks/TRACK_6_QA.md) |
| 7 | Pi + cloudflared deploy | 0 | [tracks/TRACK_7_DEPLOY.md](tracks/TRACK_7_DEPLOY.md) |

**Parallel opportunities:** once Track 0 + 1 land, Tracks 2, 3, 4, 7 can run simultaneously. Track 5 needs Track 3's submit logic. Track 6 closes everything out.

---

## 7. Source-of-truth notes

- The existing PDF rubrics in `../Rubrics - Internal Only/` are **NOT** being regenerated. The website is the source of truth for max points (post-70/30 rebalance). Judges score only via the website on event day — no paper score sheets at the venue.
- Rubric structure (criteria, levels, descriptors, max points) is **seeded once**, never user-edited. If a band number needs to change, it's a code change + migration, not a runtime edit.

---

## 8. Deployment overview (full details in Track 7)

Production runs on a Raspberry Pi 5 (Pi 4 also fine, 4GB+ RAM) at Mohammad's location:

```
[Judges' browsers]
       │ HTTPS
       ▼
[Cloudflare Edge — judging.<your-domain>]
       │ Cloudflare Tunnel (cloudflared on Pi)
       ▼
[Pi: node build/index.js on :3000 under systemd]
       │ HTTPS over internet
       ▼
[Supabase Postgres in ap-southeast-1]
```

Deploy = `git push` on Pi, then `./scripts/update.sh` (pulls, installs, builds, restarts systemd unit). No downtime needed for typical updates.

---

## 9. Definition of done for the whole project

We ship when:

- [ ] Super_admin can: import schools/participants from CSV, create 4 judges, auto-assign, override scores, lock event, export results, view audit log.
- [ ] Each judge can: log in, see their queue, score a participant (Section A + B), enter Live Sprint time, save draft, submit, see "done" confirmation.
- [ ] Results page auto-ranks per category, breaks ties by sprint time, exports CSV.
- [ ] Audit log captures every score change with before/after, every override with reason, every assignment change.
- [ ] The whole thing runs on the Pi via cloudflared at the public HTTPS URL.
- [ ] A full dry-run (Track 6) with 15 fake students × 4 fake judges completes without errors.
- [ ] All commits in git history are plain — no AI attribution anywhere.
