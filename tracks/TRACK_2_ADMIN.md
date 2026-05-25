# Track 2 — Super-admin UI

**Goal:** the pages Mohammad uses to set up and run the event — manage users, schools, participants, assignments, and the event-locked state.

**Depends on:** Tracks 0 and 1 merged.

**Branch:** `track/2-admin`

**Inputs to read first:**

- [../DEVELOPMENT.md](../DEVELOPMENT.md) — commit policy, 3 roles
- [../DESIGN.md](../DESIGN.md) — every UI choice cites this
- [../SCHEMA.md](../SCHEMA.md) — tables you'll be CRUD-ing

---

## Routes you own

```
/login                                    public — login form
/admin                                    dashboard (KPIs + recent activity)
/admin/users                              list, create, deactivate, role change
/admin/schools                            CRUD + CSV import
/admin/participants                       CRUD + CSV import + DQ toggle
/admin/assignments                        matrix view + auto-assign + manual swap
/admin/event                              event_state — date, sprint minutes, lock toggle
```

Everything inside `/admin/*` is guarded — `+layout.server.ts` checks `user.role === 'super_admin'`, else 403 redirect to `/`.

`/login` is shared with all roles; build it here.

---

## Pages — detail

### `/login` — Supabase Auth shell

```
┌──────────────────────────────────────────┐
│           [P3 logo] · [BSKL logo]        │
│                                          │
│        P3 JUDGING                        │
│        Future Coders Challenge 2026     │
│                                          │
│        Email      [ _________________ ]  │
│        Password   [ _________________ ]  │
│                                          │
│        [ Sign in ]                       │
│                                          │
│        or  · email me a magic link       │
└──────────────────────────────────────────┘
```

- Supports both email+password and magic link (Supabase Auth does both natively).
- After login, redirect by role: super_admin → `/admin`, judge → `/judge`, viewer → `/viewer`.
- Form action calls `supabase.auth.signInWithPassword` or `supabase.auth.signInWithOtp`.
- Per [DESIGN.md](../DESIGN.md) § 4 — centered card, no marketing copy.

### `/admin` — dashboard

Mock in [DESIGN.md](../DESIGN.md) § 4 B. Three sections:

1. **Event Progress card** — per category, "X / 45 scored" with horizontal progress bar.
2. **Judge Load card** — for each judge, dotted progress + "X / Y participants".
3. **Recent Activity card** — last 20 audit_log entries (real-time tailed via Supabase channel).
4. **Action buttons** — `Auto-assign`, `Lock event`, `Export CSV`, `Audit log`.

Use SvelteKit's `+page.server.ts` for the initial load; subscribe to Supabase realtime on the client for the activity feed.

### `/admin/users`

Table columns: Avatar (initials), Name, Email, Role pill, Categories (chips), Active, Last seen, Actions.

Actions per row:

- Edit (modal — name, role, categories array)
- Deactivate / Reactivate
- Reset password (calls `supabaseAdmin.auth.admin.updateUserById` to set a new temp password)

Create new user button → modal: email, full name, role (super_admin/judge/viewer), categories (only relevant if role=judge). Calls `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })` server-side, then triggers the `handle_new_user` trigger → `profiles` row appears, then UPDATE `profiles` with full_name + role + categories.

**Print-on-paper PIN sheet:** add a "Print login slips" button that generates a printable A4 sheet listing every active user's email + temp password in a card format. Mohammad hands these out at the venue.

### `/admin/schools`

DataTable: name, short code, participant count, actions (edit, delete-if-empty).

CSV import: upload a single-column CSV (one school name per line, optional `short_code` second column). Server action parses + bulk-inserts.

### `/admin/participants`

DataTable: name, school, category pill, theme, judge (resolved from `assignments`), DQ flag, actions.

Add participant modal: name, school (select from existing), category, theme (optional).

**CSV import** (the most-used path):

- Headers: `full_name,school_name,category,theme`
- Server action: for each row, find-or-create school by name, insert participant.
- Show summary preview before commit ("12 new schools will be created, 87 participants will be added — proceed?").
- Reject malformed rows with line numbers; do not partial-commit.

DQ toggle: clicking the DQ chip opens a modal — pick a `dq_reason`, type notes, confirm. Sets `participants.qualified = false` AND inserts `disqualifications` row (even though scoresheet doesn't exist yet, allow a `scoresheet_id IS NULL` participant-level DQ; **OR** require all DQs to be tied to a scoresheet and instead deny via `participants.qualified`. **Decide and document.** Recommended: keep `disqualifications.scoresheet_id` NOT NULL and use `participants.qualified` for participant-level DQ. Update SCHEMA.md if you change anything.)

### `/admin/assignments` — the matrix

Compact grid:

```
                Sarah   Ravi   Mei Lin  Kumar
Aisha Tan       ●                                ← assigned to Sarah
Tom Lee                 ●                        ← assigned to Ravi
Liam Chen                       ●
...
```

- Each row = one participant; each column = one active judge.
- Dot in the cell means "assigned." Click an empty cell to reassign.
- Drag-and-drop also supported (`@neodrag/svelte` is fine, or roll your own pointer events).
- Top of page: tabs to switch Cat A / B / C.
- **Auto-assign button** for the active category → opens preview modal:

```
Auto-assign — Category B
─────────────────────────────────
Algorithm: shuffle → round-robin → school-spread constraint
Eligible judges: Sarah, Ravi, Mei Lin, Kumar (all qualified for B)

Preview:
   Sarah     11 participants  (max 3 from any one school)
   Ravi      11 participants
   Mei Lin   11 participants
   Kumar     12 participants

[ Show details ]    [ Cancel ]    [ Apply ▸ ]
```

Apply only commits to DB on the second click. Audit row written.

### `/admin/event`

Single-card page:

- Event name, date (read-only after first save), sprint minutes (default 45)
- **Lock event** toggle: when ON, all scoresheets become read-only across the app (enforced by RLS via `is_event_locked()`). Used at end-of-event to freeze results.
- Show locked-by + locked-at when locked.

---

## Components to build (in `src/lib/components/`)

| Component             | Notes                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `<DataTable>`         | Generic — columns config, rows, sortable, sticky header, row-click handler, empty-state slot |
| `<CsvUpload>`         | File picker + preview table + commit button; calls a parser callback                         |
| `<UserAvatar>`        | Initials in coloured circle; role pill below for table cells                                 |
| `<RolePill>`          | Colour by role: super_admin → magenta, judge → cyan, viewer → text-2                         |
| `<CategoryChip>`      | Small "A" / "B" / "C" chip, colour-coded                                                     |
| `<AssignmentMatrix>`  | Grid view; props: judges[], participants[], assignments map                                  |
| `<AutoAssignPreview>` | Modal — shows the planned assignment before commit                                           |
| `<DqModal>`           | Reason picker + notes                                                                        |
| `<ConfirmModal>`      | Re-used; danger variant for irreversible actions                                             |
| `<PrintableSlips>`    | A4-sized print stylesheet for login PIN slips                                                |

---

## Server endpoints (in `src/routes/admin/.../+server.ts` or as form actions)

| Endpoint                             | Method | Purpose                                                       |
| ------------------------------------ | ------ | ------------------------------------------------------------- |
| `/admin/users` form action `create`  | POST   | create user via `supabaseAdmin.auth.admin.createUser`         |
| `/admin/users` form action `setRole` | POST   | update profile.role                                           |
| `/admin/schools/import`              | POST   | parse CSV → bulk insert schools                               |
| `/admin/participants/import`         | POST   | parse CSV → bulk insert participants + find-or-create schools |
| `/admin/assignments/auto`            | POST   | run auto-assign algorithm (see below), return preview         |
| `/admin/assignments/auto/commit`     | POST   | apply the preview                                             |
| `/admin/assignments/swap`            | POST   | swap one participant's judge                                  |
| `/admin/event/lock`                  | POST   | toggle locked flag                                            |

---

## Auto-assign algorithm (in `src/lib/server/auto-assign.ts`)

```ts
import { shuffle } from '$lib/utils/random';

export function autoAssign(args: {
	participants: { id: string; school_id: string }[];
	judges: { id: string }[];
	maxPerSchoolPerJudge?: number; // default 3
}) {
	const { participants, judges, maxPerSchoolPerJudge = 3 } = args;
	if (judges.length === 0) throw new Error('no eligible judges');

	const shuffled = shuffle(participants);
	const buckets = new Map<string, { id: string; school_id: string }[]>();
	judges.forEach((j) => buckets.set(j.id, []));

	// Round-robin pointer
	let i = 0;
	outer: for (const p of shuffled) {
		// Try each judge starting from current pointer, skip if school-cap hit
		for (let tries = 0; tries < judges.length; tries++) {
			const judge = judges[(i + tries) % judges.length];
			const bucket = buckets.get(judge.id)!;
			const fromSameSchool = bucket.filter((x) => x.school_id === p.school_id).length;
			if (fromSameSchool < maxPerSchoolPerJudge) {
				bucket.push(p);
				i = (i + tries + 1) % judges.length;
				continue outer;
			}
		}
		// No judge under the cap — assign to least-loaded judge anyway (school-spread is best-effort)
		const least = [...buckets.entries()].sort((a, b) => a[1].length - b[1].length)[0];
		least[1].push(p);
	}

	return [...buckets.entries()].map(([judgeId, parts]) => ({
		judge_id: judgeId,
		participant_ids: parts.map((p) => p.id)
	}));
}
```

`shuffle` uses `crypto.getRandomValues` so the shuffle is non-predictable (no `Math.random` seed games).

---

## Commit checkpoints

1. `admin: login page wired to supabase auth (password + magic link)`
2. `admin: role-guarded layout for /admin routes`
3. `admin: users list, create modal, role + categories edit, deactivate`
4. `admin: printable login slips for venue handout`
5. `admin: schools crud with csv import preview`
6. `admin: participants crud with csv import and dq flow`
7. `admin: assignments matrix with manual swap`
8. `admin: auto-assign algorithm with shuffle + round-robin + school-spread cap`
9. `admin: auto-assign preview modal and commit endpoint`
10. `admin: event lock toggle`
11. `admin: dashboard with progress, judge load, realtime activity feed`

(One commit per checkpoint. Push after each.)

---

## Acceptance criteria

- [ ] Mohammad can sign in, land on `/admin`
- [ ] He can create the 4 judges with email + temp password, print slips
- [ ] He can create at least 1 viewer account
- [ ] He can bulk-import schools (CSV) — duplicates rejected
- [ ] He can bulk-import 45 participants per category (135 total) via CSV
- [ ] Clicking auto-assign for Cat B shows a balanced preview, then commits
- [ ] No judge gets more than 3 participants from any single school in the preview (when feasible)
- [ ] Manual swap on the matrix works and is audit-logged
- [ ] DQ toggle works; the participant disappears from leaderboard (Track 5 verifies)
- [ ] Locking the event makes all judges' forms read-only (Track 3 verifies)
- [ ] Every action that mutates state appears in the audit log within 1 second (Track 4 verifies)
- [ ] Pages match [DESIGN.md](../DESIGN.md) — tokens, fonts, spacing, status pills

## Out of scope

- ❌ Judge scoring form (Track 3)
- ❌ Audit log UI (Track 4)
- ❌ Results/leaderboard/override (Track 5)

## Gotchas

- **`supabaseAdmin.auth.admin.createUser`** requires `email_confirm: true` to skip Supabase's confirmation flow (judges/viewers don't go through email verification — they get printed creds).
- **CSV parsing:** use `papaparse` — it handles quoted fields, BOM, mixed line endings. Set `skipEmptyLines: true`.
- **Realtime activity feed:** Supabase channels can lag a second; show "● live" indicator when connected, "○ reconnecting" on disconnect.
- **Matrix performance:** at 135 participants × 4 judges = 540 cells, a naive Svelte render is fine. Avoid rendering 13,500 cells (whole-event single matrix) — keep per-category tabs.
- **Login slips printing:** use `@media print` styles; hide the sidebar/header. One judge per A4 card section, 4 per page.
- **Magic link flow at the venue:** if WiFi is dodgy or judges' emails are slow to arrive, password fallback is critical. Don't hide it.
