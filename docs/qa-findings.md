# QA findings — gaps for other track owners

Track 6 sweep. These are real (or potential) gaps I noticed while walking
every page but didn't fix here, either because the fix belongs to a different
track or because it's strictly cosmetic and shouldn't block event day.

Track 6 itself did NOT:
- change DB schema
- change design tokens or rubric reference data
- build new features
- deploy anything

Anything that needed those, lives here.

---

## P1 — should fix before event day

(None blocking. The 6 cosmetic `svelte-check` warnings were resolved in this
track.)

---

## P2 — fix when convenient

### F-1 — `/admin/scoresheets/[id]` has a defensive blank-state hole
**Track:** 5 (Results / scoresheet detail)

`src/lib/components/results/ScoresheetDetailPage.svelte` renders the back
button + a `loadError` banner, and then only renders the body inside
`{#if data.detail}`. If the server load returns both `detail: null` AND
`loadError: null` (which it shouldn't, but the type allows it), the page
shows only the back button — silent dead end.

**Suggested fix:** add an `{:else}` branch under the `{#if data.detail}`
that renders a small `<EmptyState>` with "Scoresheet not found." and a link
back to results. Five-line change.

### F-2 — Inline empty markup instead of shared `<EmptyState>` component
**Track:** 0 (Setup / design system consistency) or 2 (Admin)

Five pages use inline `<div class="rounded-lg border p-10 text-center">…`
markup instead of the shared `<EmptyState>` component:

- `/admin` (dashboard — judge load card, recent activity card)
- `/admin/users` (table colspan empty row)
- `/admin/users/print` (user-list empty inline message)
- `/admin/schools` (table colspan empty row)
- `/judge` (queue empty + filter-zero state)

Functionally fine, visually consistent in isolation, but inconsistent with
the `<EmptyState>` look-and-feel used on `/admin/participants`,
`/admin/assignments`, `/admin/results`. Worth normalising post-event.

### F-3 — `playwright.config.ts` had no `testDir`, no auth setup, no env
**Track:** 0 (Setup)

The committed `playwright.config.ts` was a 6-line stub. Track 6 rewrote it
to set `testDir`, accept `*.spec.ts`, wire `dotenv`, add retries / trace /
screenshot, and parameterise the base URL + port. If Track 0 ever
revisits CI setup, the new config is a reasonable starting point.

### F-4 — Two brand asset paths referenced but no static fallback present
**Track:** 0 (Setup / brand assets)

`/login` and `BrandHeader.svelte` reference `/brand/p3-logo.svg` and
`/brand/bskl-logo.svg`. `TODO_BRAND_ASSETS.md` already flags that real assets
need to be dropped in; `auth.spec.ts` asserts both resolve to 200 so a
regression here would be caught. Just noting it so it doesn't slip.

---

## P3 — informational / out of scope

### F-5 — `viewer/+page.svelte` is still a placeholder
**Track:** 4 (Audit) and 5 (Results)

The viewer landing page reads
> Read-only leaderboard and audit log land with Tracks 4 & 5.

…even though Tracks 4 + 5 ARE merged. The actual results + audit pages
work; only the landing card is stale. Could be a minor link card / nav
hub instead.

### F-6 — `/viewer/*` has no shared `+layout.svelte`
**Track:** 4 or 5

Comments inside `viewer/results/+page.svelte` and others note "the viewer
route group has no AppShell wrapper yet" and inline a `<BrandHeader>` per
page. A shared `src/routes/viewer/+layout.svelte` with `<BrandHeader>` +
a max-width container would deduplicate.

### F-7 — Per-spec parallelism disabled
**Track:** 6 (this one)

`playwright.config.ts` sets `fullyParallel: false` because several specs
share mutable global state (event lock, leaderboard seed, override audit).
A future cleanup could:
- isolate each spec to its own seeded sub-event, OR
- introduce a `serial.describe` group only for the state-touching specs.

Not worth doing pre-event.

### F-8 — Magic-link login path is UI-asserted only
**Track:** 6 (this one)

`auth.spec.ts` verifies the magic-link form renders + the button toggles
correctly, but does NOT exercise the email round-trip (would need an inbox
fixture: Mailpit, Mailosaur, or Supabase's Inbucket in self-host). The
password path is fully exercised, so the auth boundary is covered; just
flagging the asymmetry.

### F-9 — `seed-fake-event.ts` always upserts judges with category=[A,B,C]
**Track:** 6 (this one)

Production may want per-judge category specialisation (e.g. Judge 1 only
does Cat A). For dry-run we want maximum assignment flexibility, so the
seed deliberately gives every judge every category. If that ever bites
during a manual dry-run, set `SEED_JUDGE_CATEGORIES=A,B` in env and patch
the seed (5-minute change).

---

## How to use this list

Each item has a `Track:` line — that's the track owner who should pick it
up. Open one GitHub issue per item linking back to this file:

```
gh issue create \
  --title "F-1 — admin/scoresheets/[id] blank-state hole" \
  --body "See docs/qa-findings.md#f-1" \
  --label "track-5,qa"
```

Don't try to clear all of P2 + P3 in one pass — none of them block event day.
