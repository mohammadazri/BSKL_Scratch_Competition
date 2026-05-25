# Track 4 — Audit log UI + export

**Goal:** make the `audit_log` table visible, filterable, exportable, and live-tailable. Bias-prevention is a core feature, not a sidecar.

**Depends on:** Tracks 0 and 1 merged.

**Branch:** `track/4-audit`

**Inputs to read first:**

- [../DEVELOPMENT.md](../DEVELOPMENT.md) — commit policy, why audit matters
- [../DESIGN.md](../DESIGN.md) § 4 D — audit log mockup
- [../SCHEMA.md](../SCHEMA.md) § `audit_log` — full schema + RLS

---

## Routes you own

```
/admin/audit                          super_admin view (everything)
/viewer/audit                         viewer view (everything, read-only — same data, but no actions)
/judge/audit                          (optional) judge sees only their own actions — useful for reviewing what they did
```

All three routes render the same `<AuditTable>` component with role-appropriate filters/actions.

---

## Page layout (per [DESIGN.md](../DESIGN.md) § 4 D)

```
┌──────────────────────────────────────────────────────────────┐
│  Audit log                          ◐ live    Export CSV ▸   │
├──────────────────────────────────────────────────────────────┤
│  Actor ▾  Action ▾  Target ▾  Date range ▾        Search 🔍  │
├──────────────────────────────────────────────────────────────┤
│  TIME       ACTOR     ACTION              TARGET            ›│
│  ───────    ──────    ──────              ──────             │
│  14:32:08   Sarah     scoresheet_submit   Aisha Tan          │
│  14:28:55   System    assignment_auto_run Cat C (45 moves)   │
│  14:25:13   You ⚠     score_override      Mei Wu / Theme     │
│  ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

- Top-right: `◐ live` indicator when realtime subscription is connected, `○ paused` when not.
- Filters as dropdown menus; multiple values allowed (`Sarah, Ravi`).
- Date range picker — defaults to "today."
- Search filters by target name / id / reason.

Each row expands on click to show:

```
TIME       ACTOR     ACTION              TARGET           ▼
14:25:13   You ⚠     score_override      Mei Wu / Theme

  Reason:  "Tutorial spotted in browser history — partial credit only"

  Before:                          After:
  {                                {
    "level": "Proficient",           "level": "Developing",
    "points": 11                     "points": 7
  }                                }
```

- Use a JSON diff view (or just two `<pre>` blocks side-by-side with adjacent line highlighting).
- Override rows have `--accent-soft` background tint by default (not just on expand).
- DQ-related rows get a small ⚠ icon.

---

## Components to build

| Component         | Notes                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| `<AuditTable>`    | Virtualized rows (use `@tanstack/svelte-virtual` if list exceeds 1000) |
| `<AuditRow>`      | Collapsed-by-default; expand to show diff                              |
| `<JsonDiff>`      | Side-by-side or unified diff of before_json / after_json               |
| `<FilterBar>`     | Filter dropdowns + date range + search                                 |
| `<LiveIndicator>` | Pulsing dot + "live" / "reconnecting" status text                      |

---

## Server-side (`+page.server.ts`)

```ts
export const load = async ({ locals, url }) => {
	const params = parseFilters(url.searchParams);

	let query = locals.supabase
		.from('audit_log')
		.select('*, actor:profiles!actor_id(full_name, role)')
		.order('at', { ascending: false })
		.limit(200);

	if (params.actorIds.length) query = query.in('actor_id', params.actorIds);
	if (params.actions.length) query = query.in('action', params.actions);
	if (params.fromDate) query = query.gte('at', params.fromDate);
	if (params.toDate) query = query.lte('at', params.toDate);
	if (params.search) query = query.or(`reason.ilike.%${params.search}%`);

	const { data, error } = await query;
	if (error) throw error;
	return { rows: data };
};

export const actions = {
	exportCsv: async ({ locals, url }) => {
		// Same query but no limit; stream as CSV
		const rows = await fetchAllMatchingAudit(locals.supabase, parseFilters(url.searchParams));
		return new Response(toCsv(rows), {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`
			}
		});
	}
};
```

RLS handles role-based row filtering automatically — judges see only `actor_id = auth.uid()`, super_admin + viewer see all. No app-side filtering needed.

---

## Realtime tail (client-side)

```ts
// src/routes/(app)/admin/audit/+page.svelte
import { onMount } from 'svelte';
import { supabase } from '$lib/supabase';

let rows = $state(data.rows);
let live = $state(false);

onMount(() => {
	const channel = supabase
		.channel('audit_log_tail')
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'audit_log' },
			({ new: row }) => {
				// Prepend if it matches current filters (or reload from server for correctness)
				rows = [row, ...rows].slice(0, 200);
			}
		)
		.subscribe((status) => {
			live = status === 'SUBSCRIBED';
		});

	return () => {
		supabase.removeChannel(channel);
	};
});
```

Filter-aware: if active filters would exclude an incoming row, don't prepend it (or do, with a small "out of filter" badge — debate this in PR review).

---

## CSV export columns

```
at, actor_email, actor_role, action, target_type, target_id, reason, before_json, after_json, actor_ip, actor_user_agent
```

- `before_json` / `after_json` as JSON strings (CSV escaped).
- One row per audit_log entry.
- Filename: `audit-YYYY-MM-DD-HHMM.csv`.

---

## Commit checkpoints

1. `audit: read-only table with role-aware rls`
2. `audit: filters (actor, action, target, date range, search)`
3. `audit: expandable rows with before/after json diff`
4. `audit: realtime tail via supabase channel with live indicator`
5. `audit: csv export streaming all matching rows`
6. `audit: viewer route variant (no edit affordances)`

---

## Acceptance criteria

- [ ] Within 1 second of a scoresheet submit (from Track 3), a row appears in the audit log
- [ ] Filters combine correctly (e.g. actor=Sarah AND action=score_override)
- [ ] Date range "today" defaults to local timezone start-of-day
- [ ] Override rows are visually distinct
- [ ] Clicking a row shows full before/after JSON diff
- [ ] CSV export of an unfiltered query at 1000+ rows completes in under 2s
- [ ] Judge user only sees their own actions (RLS enforced)
- [ ] Viewer sees everything but no edit buttons
- [ ] `◐ live` indicator turns red `○` when realtime disconnects
- [ ] Page works without JS (initial server load + manual filter via URL params); realtime degrades silently

## Out of scope

- ❌ Mutation (the entire table is read-only by design)
- ❌ Audit-log retention/cleanup (it's append-only; super_admin can purge via SQL editor post-event if ever needed)

## Gotchas

- **Audit log can fill fast.** A single scoresheet has ~20+ events (each score = create or update). 135 scoresheets × 20 = 2700+ rows on a busy event day. Use the `at DESC` index + LIMIT 200 by default; only widen when user filters.
- **JSON diff display:** the `before_json` and `after_json` are full row snapshots — they include `id`, `created_at`, `updated_at` which always differ. Hide these from the diff display (don't delete from the data, just don't render).
- **Realtime + RLS:** Supabase realtime respects RLS — judges will only get push notifications for THEIR own actions. Super_admin + viewer get everything. Good.
- **Actor display:** `actor_id` is FK to `profiles`; join in the select query (`actor:profiles!actor_id(full_name)`). System actions (where `actor_id IS NULL`) display as `System`.
- **`actor_ip` and `actor_user_agent`** — these need to be captured at INSERT time. The `audit_row` trigger uses `auth.uid()` but doesn't know the IP. Mohammad's call: skip them (acceptable — `actor_id` + timestamps are usually sufficient), OR add a SvelteKit hook that writes them to `app.client_ip` per-request session variable that the trigger reads. **Default: skip; revisit if a dispute ever needs them.**
