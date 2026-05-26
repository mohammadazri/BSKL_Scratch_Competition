# Supabase — bootstrap & migrations

This folder holds the database schema for the P3 Judging app.

- `migrations/` — numbered SQL files (`001_…sql` → `007_…sql`). Apply in order.
- `seed/rubrics.json` — source of truth for rubric criteria + level bands. Loaded by `scripts/seed-rubrics.ts`.

Track 1 owns everything in here. See `tracks/TRACK_1_DB.md` and `SCHEMA.md` at the project root for the design rationale.

---

## One-time project setup

1. Create a Supabase project (Settings → API gives you the keys).
2. Fill `.env` from `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`).

That's it — no extra extensions or config needed. `pgcrypto` is enabled by `001_extensions.sql`.

---

## Applying the migrations

There are two paths. Pick whichever works in your environment.

### Path A — Supabase Studio SQL editor (manual, always works)

Use this if the Supabase CLI / `psql` / `drizzle-kit push` aren't available in your shell, or if you want a visual confirmation of each step.

1. Open your project in https://supabase.com → SQL Editor.
2. Open each file under `supabase/migrations/` **in numeric order**:
   - `001_extensions.sql`
   - `002_enums.sql`
   - `003_tables.sql`
   - `004_functions.sql`
   - `005_triggers.sql`
   - `006_rls.sql`
   - `007_views.sql`
3. For each file: paste the entire contents into a new query, click **Run**, confirm no errors.
4. After all seven succeed, run the seed loader from your machine:

   ```sh
   pnpm tsx scripts/seed-rubrics.ts
   ```

   This populates `criteria` (20 rows: 3 in Cat A Sec A, 3 in Cat A Sec B, 4 in Cat B Sec A, 3 in Cat B Sec B, 4 in Cat C Sec A, 3 in Cat C Sec B) and `criterion_levels` (76 rows) from `supabase/seed/rubrics.json`. The script is idempotent — running it twice produces the same end state.

Every migration is idempotent (guarded with `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP … IF EXISTS`), so re-applying is safe if you need to recover from a partial run.

### Path B — Supabase CLI / direct `psql` (one-shot)

If you have the Supabase CLI installed and linked to the project:

```sh
# from project root
supabase db push
```

Or apply each file directly via `psql` using `DATABASE_URL`:

```sh
for f in supabase/migrations/0??_*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
pnpm tsx scripts/seed-rubrics.ts
```

> `pnpm drizzle-kit push` is **not** the recommended path here because the schema relies on hand-written SQL (RLS policies, triggers, views, `SECURITY DEFINER` functions) that Drizzle's generator does not emit. The Drizzle schema in `src/lib/server/db/schema.ts` exists for compile-time types, not for driving migrations.

---

## Bootstrap the first super_admin

After migrations + seed succeed, run the bootstrap script:

```sh
pnpm tsx scripts/seed-superadmin.ts
```

This reads `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_NAME` from `.env`,
creates the auth user via the Supabase Admin API, and promotes the profile to `super_admin`.
It is **idempotent** — safe to re-run if you need to reset the password.

From this point on, all further user / role management happens via the super-admin UI (`/admin/users`).

---

## Verifying the install

After seeding, these sanity queries should all return the expected counts (per `tracks/TRACK_1_DB.md` § Acceptance criteria):

```sql
-- 20 criteria total
SELECT COUNT(*) FROM criteria;             -- 20

-- 76 levels total
SELECT COUNT(*) FROM criterion_levels;     -- 76

-- 3 criteria in Cat A Section A
SELECT COUNT(*) FROM criteria
 WHERE category = 'A' AND section = 'A';   -- 3

-- Per-category grand totals must be 100 (70 + 30)
SELECT category, SUM(max_points)
  FROM criteria GROUP BY category;
-- A | 100
-- B | 100
-- C | 100
```

Then run the RLS smoke test:

```sh
pnpm tsx scripts/test-rls.ts
```

It provisions two throwaway judges, asserts judge-to-judge isolation, and confirms `audit_log` is immutable to authenticated roles. Cleans up after itself.
