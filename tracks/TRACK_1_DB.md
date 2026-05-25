# Track 1 — Database: schema, RLS, triggers, seed

**Goal:** apply [SCHEMA.md](../SCHEMA.md) to Supabase, seed the rubric reference data from [SEED_RUBRICS.md](../SEED_RUBRICS.md), and mirror the schema in Drizzle so other tracks have type-safe DB access.

**Depends on:** Track 0 merged.
**Blocks:** Tracks 2, 3, 4, 5.

**Branch:** `track/1-db`

**Inputs to read first:**

- [../SCHEMA.md](../SCHEMA.md) — the whole file is your spec
- [../SEED_RUBRICS.md](../SEED_RUBRICS.md) — the JSON block at the bottom is the seed source of truth
- [../DEVELOPMENT.md](../DEVELOPMENT.md) § 0 — commit policy

---

## Approach

You'll author **numbered SQL migration files** in `supabase/migrations/` that can be applied in order via either:

- **Supabase Studio SQL editor** (paste each file) — fine for dev.
- **`supabase db push`** via the Supabase CLI — preferred for repeatability.

Each migration is **idempotent where reasonable** (uses `CREATE ... IF NOT EXISTS` / `CREATE OR REPLACE` / `ON CONFLICT DO NOTHING`) so re-running the seed against a partially-set-up DB doesn't blow up.

Then mirror the schema in Drizzle so the SvelteKit app gets compile-time types.

---

## Deliverables — file by file

### `supabase/migrations/001_extensions.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()
```

Commit: `db: enable pgcrypto extension`

### `supabase/migrations/002_enums.sql`

All `CREATE TYPE` statements from [SCHEMA.md](../SCHEMA.md) § Enums. Wrap each in:

```sql
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin','judge','viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

(Repeat the pattern for every enum.)

Commit: `db: create enums for roles, categories, sections, levels, themes, statuses, dq reasons, audit actions`

### `supabase/migrations/003_tables.sql`

Every `CREATE TABLE` from [SCHEMA.md](../SCHEMA.md) § Tables, in dependency order:

1. `profiles` (depends on `auth.users` which Supabase creates)
2. `schools`
3. `participants` (FK → schools)
4. `criteria`
5. `criterion_levels` (FK → criteria)
6. `assignments` (FK → participants, profiles)
7. `scoresheets` (FK → participants, profiles)
8. `scores` (FK → scoresheets, criteria)
9. `disqualifications` (FK → scoresheets, profiles)
10. `event_state` + seed `INSERT INTO event_state (id, event_date) VALUES (1, '2026-07-25') ON CONFLICT DO NOTHING;`
11. `audit_log`

Include all indexes from SCHEMA.md.

Commit: `db: create all application tables with FKs and indexes`

### `supabase/migrations/004_functions.sql`

- `set_updated_at()`
- `check_score_in_band()`
- `current_role_is(target user_role)`
- `is_super_admin()`, `is_viewer()`, `can_read_all()`, `is_event_locked()`
- `audit_row(target_type text)` — `SECURITY DEFINER`
- `handle_new_user()` — `SECURITY DEFINER`

Copy verbatim from SCHEMA.md.

Commit: `db: helper functions for rls, audit triggers, score-band check, auto profile creation`

### `supabase/migrations/005_triggers.sql`

Every `CREATE TRIGGER` from SCHEMA.md:

- `set_updated_at` on every mutable table
- `audit_row(...)` on every audit-relevant table
- `check_score_in_band` on `scores`
- `on_auth_user_created` on `auth.users`

Commit: `db: install updated_at, audit, score-band, and new-user triggers`

### `supabase/migrations/006_rls.sql`

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table from SCHEMA.md
- All policies from SCHEMA.md § Policy SQL plus the full policy set implied by § Policy summary

**Full policy set — write all of these.** SCHEMA.md shows key examples; you implement the whole table. For each table, write:

- `<table>_super_all FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())`
- `<table>_read` policy using `can_read_all()` for viewer + the role-appropriate predicate for judges
- Judge-specific INSERT/UPDATE/DELETE policies for `scoresheets`, `scores`, `disqualifications`
- `audit_log`: SELECT policies only (read-all for super/viewer; self-only for judges). **NO** insert/update/delete policies.
- `criteria`/`criterion_levels`: SELECT-to-`authenticated` only, no write policies (only the migration `INSERT`s seed rows; bypasses RLS at migration time).

Commit: `db: enable rls and install role-based policies on all tables`

### `supabase/migrations/007_views.sql`

`final_rankings` and `judge_queue` from SCHEMA.md § Views.

Views inherit RLS from their underlying tables, so a viewer or super_admin querying `final_rankings` will see all rows; a judge will see only rows for their assigned participants. **Verify this** with the test in Step "Verify RLS" below.

Commit: `db: add final_rankings (tiebreak-aware) and judge_queue views`

### `supabase/seed/rubrics.json`

Copy the JSON block from [SEED_RUBRICS.md](../SEED_RUBRICS.md) § Seed data — JSON, verbatim. Do not edit values — this file IS the data.

### `scripts/seed-rubrics.ts`

Idempotent loader. Run with `pnpm tsx scripts/seed-rubrics.ts`:

```ts
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);
const data = JSON.parse(readFileSync('supabase/seed/rubrics.json', 'utf8'));

for (const cat of data.categories) {
	for (const sec of cat.sections) {
		for (const crit of sec.criteria) {
			const [{ id: criterionId }] = await sql`
        INSERT INTO criteria (category, section, name, max_points, sort_order)
        VALUES (${cat.category}, ${sec.section}, ${crit.name}, ${crit.max_points}, ${crit.sort_order})
        ON CONFLICT (category, section, sort_order)
        DO UPDATE SET name = EXCLUDED.name, max_points = EXCLUDED.max_points
        RETURNING id`;

			for (const lvl of crit.levels) {
				await sql`
          INSERT INTO criterion_levels (criterion_id, level, min_pts, max_pts, descriptor)
          VALUES (${criterionId}, ${lvl.level}, ${lvl.min_pts}, ${lvl.max_pts}, ${lvl.descriptor})
          ON CONFLICT (criterion_id, level)
          DO UPDATE SET min_pts = EXCLUDED.min_pts, max_pts = EXCLUDED.max_pts, descriptor = EXCLUDED.descriptor`;
			}
		}
	}
}

console.log('seed complete');
await sql.end();
```

Commit: `db: rubric seed json + idempotent loader script`

### `src/lib/server/db/schema.ts` — Drizzle mirror

Mirror every table from SCHEMA.md as Drizzle table definitions. Example:

```ts
import {
	pgEnum,
	pgTable,
	text,
	uuid,
	integer,
	boolean,
	timestamp,
	jsonb
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['super_admin', 'judge', 'viewer']);
export const categoryEnum = pgEnum('category', ['A', 'B', 'C']);
// ...

export const profiles = pgTable('profiles', {
	id: uuid('id').primaryKey(),
	email: text('email').notNull().unique(),
	fullName: text('full_name').notNull(),
	role: userRoleEnum('role').notNull().default('judge'),
	categories: categoryEnum('categories').array().notNull().default(['A', 'B', 'C']),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
// ...every other table
```

Export inferred types in `src/lib/types.ts`:

```ts
import type { profiles, participants, scoresheets /* ... */ } from './server/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

export type Profile = InferSelectModel<typeof profiles>;
export type Participant = InferSelectModel<typeof participants>;
export type Scoresheet = InferSelectModel<typeof scoresheets>;
// ...
```

Commit: `db: drizzle schema mirror and shared typescript types`

---

## Verify RLS (do not skip)

Create a test harness `scripts/test-rls.ts` that:

1. Connects as a judge via Supabase JS (anon key + sign-in as a fake judge).
2. Tries to `SELECT` from `participants` — should only see their assignments.
3. Tries to `UPDATE` a `scoresheet` for a participant they're NOT assigned to — should fail.
4. Tries to `INSERT` into `audit_log` directly — should fail.
5. Tries to `UPDATE` `audit_log` row — should fail.

Run it. Commit: `db: rls smoke test confirms judge isolation and audit_log immutability`

---

## Bootstrap Mohammad as super_admin

After all migrations + seed run cleanly against a fresh Supabase project:

```sql
-- Mohammad signs up via /login with aiman0608@gmail.com once.
-- Then in Supabase SQL editor:
UPDATE profiles SET role = 'super_admin' WHERE email = 'aiman0608@gmail.com';
```

Document this in `supabase/README.md`. Commit: `db: document super_admin bootstrap procedure`.

---

## Acceptance criteria

- [ ] All 7 migrations apply cleanly against a fresh Supabase project, in order
- [ ] Re-running any migration is safe (idempotent or guarded)
- [ ] `pnpm tsx scripts/seed-rubrics.ts` populates 10 criteria + 38 levels (= 3 criteria + 4-or-3 levels × 3 cats × 2 sections — count from the JSON to verify)
- [ ] `SELECT COUNT(*) FROM criteria WHERE category = 'A' AND section = 'A'` returns 3
- [ ] `SELECT SUM(max_points) FROM criteria WHERE category = 'A' GROUP BY category` returns 100 (70+30) for each category
- [ ] `scripts/test-rls.ts` passes — judges isolated, audit_log immutable
- [ ] Drizzle schema compiles (`pnpm check`)
- [ ] `final_rankings` view returns expected ranks when given test data with a tie (faster sprint time wins)

## Out of scope

- ❌ No SvelteKit UI work (that's Tracks 2–5).
- ❌ No auto-assign algorithm (that lives in Track 2 as a server endpoint).
- ❌ No CSV import (Track 2).
- ❌ Don't bake actual user data into seed — only reference data (criteria + levels + event_state row).

## Gotchas

- **`SECURITY DEFINER` functions** run with the function-owner's privileges (typically `postgres`), bypassing RLS. Required for `audit_row` (inserts into a no-INSERT-policy table) and `handle_new_user` (inserts into `profiles` from an `auth.users` trigger). Don't add `SECURITY DEFINER` to functions that shouldn't bypass RLS.
- **The `check_score_in_band` trigger** validates points fall within the chosen level's band. If a Track 3 form sends mismatched `level` + `points`, the INSERT fails — that's correct behaviour, the form should client-side-validate first.
- **Cat C Section A `Lists & Extensions`** has a `Developing` band of 9–18 (wider than usual). Verify the seed matches SEED_RUBRICS.md exactly — no "tidying" the numbers.
- **`auth.users` triggers** need `SECURITY DEFINER` because they fire in the auth schema. Without it, `INSERT INTO profiles` fails on RLS.
- The `event_state` row is `id = 1` singleton. Don't create more.
