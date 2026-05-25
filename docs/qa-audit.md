# QA — empty / error / loading state audit

Track 6, Phase 1. One row per user-facing page.

Legend:

- **OK** — has an `<EmptyState>` (or an equivalent inline empty block) and surfaces server errors via `loadError`, `form.error`, or a banner.
- **OK\*** — empty state present but uses inline markup rather than the shared `<EmptyState>` component. Functionally fine, cosmetic gap only.
- **Gap (fixed)** — was missing, fixed in this track.
- **Gap (noted)** — missing, left as a follow-up for the relevant track owner. See `docs/qa-findings.md`.
- **N/A** — page is a redirect, a success confirmation, or a print sheet that should never render with zero rows in normal flow.

Loading states are not separately ticked: SvelteKit page loads block the route until `+page.server.ts` resolves, so there is no client-visible "loading" state for first paint. Components that fetch lazily (audit live tail, autosave indicator) own their own loading state inside the component (`<SaveStatusIndicator>`, `<LiveIndicator>`).

## Public

| Route | Empty | Error | Notes |
| --- | --- | --- | --- |
| `/` | N/A | N/A | Server redirect only — never renders. |
| `/login` | N/A | `form.error` + `form.info` banners | `auth.spec.ts` covers wrong-password + magic-link variants. |
| `/logout` | N/A | N/A | Server-only side-effect, redirects. |
| `/auth/callback` | N/A | N/A | OAuth/magic-link landing — redirects on success, throws on failure. |
| `+error.svelte` (root) | N/A | Always the error state | Top-level boundary added in `polish:` commit. Distinguishes 401/403/404/5xx with friendly copy, never exposes stack traces, always offers a Home / Sign in CTA. |

## Admin (super_admin)

| Route | Empty | Error | Notes |
| --- | --- | --- | --- |
| `/admin` | OK\* (inline "No active judges with assignments yet." / "No activity yet.") | LiveIndicator dot turns red on realtime disconnect | Dashboard. Three cards each handle their own zero-row case. |
| `/admin/users` | OK\* (inline `colspan=6` row) | `form.error` banner | Includes "No users yet. Click New user to add your first judge." — covers first-install case. |
| `/admin/users/print` | OK\* (`No active judges or viewers yet.` inside the list) | `form.error` banner | Auto-prints after generation; gracefully degrades if `window.print` is blocked (button still visible). |
| `/admin/schools` | OK\* (inline "No schools yet…") | `form.error` banner | Both CSV-import and manual-create CTAs surfaced in the empty message. |
| `/admin/schools/import` | N/A | JSON 4xx body | Server endpoint, called by the CSV upload widget. |
| `/admin/participants` | OK (`<EmptyState>`) | CSV preview error block + `form.error` banner | Includes "No participants match." inside table when filter trims to zero. |
| `/admin/participants/import` | N/A | JSON 4xx body | Server endpoint. |
| `/admin/assignments` | OK (`<EmptyState>` — per-category "No judges" + "No participants") | `form.error` banner | Two separate `<EmptyState>`s so the operator knows which side is empty. |
| `/admin/assignments/auto` | N/A | JSON 4xx body | Server endpoint (preview + commit). |
| `/admin/event` | N/A | Inline form-error banner + `form.message` banner | Singleton config form — always has one row by construction. |
| `/admin/audit` | OK (`AuditTable` colspan-5 message) | `loadError` banner inside `AuditPage` | Realtime tail handles its own reconnect state. |
| `/admin/audit/export` | N/A | JSON 4xx body | Streaming CSV endpoint. |
| `/admin/results` | OK (`<EmptyState>` inside `LeaderboardPage`) | Banner if rankings view fails to load | "No participants match these filters." surfaced. |
| `/admin/results/print` | OK\* (inline "No qualified rows yet.") | Inherits route error boundary | Printable A4 leaderboard. |
| `/admin/results/export` | N/A | JSON 4xx body | Streaming CSV. |
| `/admin/scoresheets/[id]` | OK (renders nothing when `data.detail` is null, surfaces `loadError`) | `loadError` banner | **Gap (noted):** when both `detail` and `loadError` are null the page shows only the back button — defensive case that shouldn't happen in practice but logged for `qa-findings.md`. |

## Judge

| Route | Empty | Error | Notes |
| --- | --- | --- | --- |
| `/judge` | OK\* (inline "Your queue is empty.") | `data.loadError` banner | Filter-zero state also covered ("Nothing in this filter."). |
| `/judge/score/[participantId]` | N/A | `saveError` (autosave) + `formError` (submit) + `form.saveError` banner | Scoresheet form. RLS-locked / event-locked failures map to friendly copy. |
| `/judge/done/[scoresheetId]` | N/A | Route error boundary | Post-submit confirmation — guaranteed populated when reached. |
| `/judge/audit` | OK (shared `AuditTable`) | `loadError` banner | Hides actor filter (RLS pins to self). |

## Viewer

| Route | Empty | Error | Notes |
| --- | --- | --- | --- |
| `/viewer` | N/A | N/A | Placeholder landing — no data. Track 4 / 5 placeholder; results + audit reachable via header / direct URL. |
| `/viewer/results` | OK (shared `LeaderboardPage`) | Banner inside `LeaderboardPage` | No override / unlock buttons — `data.role !== 'super_admin'` branch handles it. |
| `/viewer/results/export` | N/A | JSON 4xx body | Streaming CSV. |
| `/viewer/audit` | OK (shared `AuditTable`) | `loadError` banner | No "raise DQ" or "override" affordances anywhere — clean read-only. |
| `/viewer/audit/export` | N/A | JSON 4xx body | Streaming CSV. |
| `/viewer/scoresheets/[id]` | OK (shared `ScoresheetDetailPage`) | `loadError` banner | Same component as admin variant; role gate hides override + unlock. |
| `/viewer/scoresheets/[id]/export` | N/A | JSON 4xx body | Streaming CSV. |

## Summary

- 28 routes audited (incl. the top-level `+error.svelte` boundary).
- 23 routes have an empty or error state (or are correctly N/A).
- 4 routes use inline empty markup instead of the shared `<EmptyState>` component (admin dashboard, admin/users, admin/users/print, admin/schools, judge queue). This is a cosmetic consistency gap — functionally equivalent and not worth a refactor before event day. Logged in `docs/qa-findings.md` for post-event polish.
- 1 route (`/admin/scoresheets/[id]`) has a defensive blank-state hole when both `data.detail` and `data.loadError` are null. Server load currently guarantees one or the other; logged in `qa-findings.md`.
- 0 routes show a raw stack trace or `undefined` in normal failure modes.
- All scoring + autosave error paths surface through `<SaveStatusIndicator>` and the inline `formError` banner per Track 3's spec.

## Tablet / a11y / contrast

These checks need a real browser and were not run in this sandboxed pass. The dry-run document (`docs/qa-dry-run.md`) walks Mohammad through manual verification on iPad-mini (768×1024) plus axe DevTools and Lighthouse before event day.
