# Track 3 — Judge scoring form ⭐

**Goal:** the page where a judge scores one student. The main UX of the entire app. If this is sluggish, error-prone, or unclear, the event fails.

**Depends on:** Tracks 0 and 1 merged.

**Branch:** `track/3-scoring`

**Inputs to read first:**

- [../DEVELOPMENT.md](../DEVELOPMENT.md) — commit policy
- [../DESIGN.md](../DESIGN.md) — § 4 A is the spec for this screen
- [../SCHEMA.md](../SCHEMA.md) — `scoresheets`, `scores`, `criterion_levels`, `disqualifications`, `judge_queue` view
- [../SEED_RUBRICS.md](../SEED_RUBRICS.md) — the rubric content judges score against

---

## Routes you own

```
/judge                                queue — list of assigned participants
/judge/score/[participantId]          THE form (Section A + B)
/judge/done/[scoresheetId]            submission summary screen
```

All guarded — `+layout.server.ts` checks `user.role === 'judge'` OR super_admin. (Super_admin can score too if assigned.)

---

## `/judge` — queue

Use the `judge_queue` view (defined in SCHEMA.md). Renders a `<DataTable>`:

| Status        | Participant | Category | School | Theme          | Progress | Action        |
| ------------- | ----------- | -------- | ------ | -------------- | -------- | ------------- |
| ○ draft       | Aisha Tan   | B        | BSKL   | Eco-Warriors   | 7 / 10   | Continue →    |
| — not started | Ravi Singh  | B        | ISKL   | Smart Cities   | 0 / 10   | Start →       |
| ● submitted   | Tom Lee     | A        | MKIS   | Space Pioneers | 6 / 6    | View          |
| ⚐ finalised   | Liam Chen   | C        | Alice  | Eco-Warriors   | 7 / 7    | View (locked) |

- Filter chips at top: All / Not started / Draft / Submitted / Finalised
- Sort by status by default (not-started first, then draft, then submitted)
- Click row → `/judge/score/[participantId]`
- Empty state when nothing assigned: "Your queue is empty. Check with the event admin."

---

## `/judge/score/[participantId]` — the form (the big one)

### Layout (per [DESIGN.md](../DESIGN.md) § 4 A)

Two-column on desktop ≥1024px; single-column with sticky bottom bar on mobile/tablet portrait.

**Left column (60%, scrollable):** stack of criterion cards, grouped by Section A → Section B with a `▌SECTION` header between groups.

**Right column (40%, sticky desktop / bottom-sheet mobile):**

- Live total (mono, large)
- Progress bar (X / N criteria scored)
- Sprint time picker (mm:ss, max 45:00)
- "Save & exit" + "Submit final"
- DQ flag button

### Criterion card

```svelte
<Card>
  <h3>{criterion.name}  <span class="text-text-2">/ {criterion.max_points}</span></h3>

  <RadioLevel
    levels={criterion.levels}   <!-- 3 or 4 entries with {level, min_pts, max_pts, descriptor} -->
    bind:selected={chosenLevel}
    on:change={onLevelChange}
  />

  <NumberStepper
    bind:value={points}
    min={selectedLevel?.min_pts ?? 0}
    max={selectedLevel?.max_pts ?? criterion.max_points}
    disabled={!chosenLevel}
  />

  <button class="text-text-2 text-xs" on:click={() => commentOpen = !commentOpen}>
    ✎ {comment ? 'edit note' : 'add note'}
  </button>
  {#if commentOpen}<Textarea bind:value={comment} rows="2" maxlength="500" />{/if}
</Card>
```

**Critical UX behaviours:**

1. **Picking a level auto-fills points** with `Math.round((min_pts + max_pts) / 2)`. Judge can adjust ±.
2. **Manually changing points** outside current band auto-switches the selected level (find the level whose band contains the value). If no level matches (shouldn't happen with contiguous bands), keep last level and clamp.
3. **Stepper buttons** ±1; long-press accelerates (not required for v1).
4. **Touch targets ≥ 44px.** The radio circles and stepper buttons must be big enough for tablet thumbs.
5. **Card collapses** to a one-line summary (`Theme & Visual Design — Excellent · 15 / 16 ✓`) once scored. Click to expand again.
6. **Order:** Section A criteria first (in `sort_order`), then Section B. Sections separated with a visual rule + label.

### Live total + progress (right column)

- `liveTotal = $: scores.reduce((sum, s) => sum + (s.points ?? 0), 0)` — Svelte reactivity.
- Animate count-up over 200ms when value changes (respect `prefers-reduced-motion`).
- Progress: `scoredCount = scores.filter(s => s.points !== null).length` over total criteria for this category.

### Sprint time picker

A `<TimeInput>` component — two numeric inputs (minutes, seconds) joined visually as `MM : SS`. Max 45:00. Stored as `live_sprint_time_seconds` integer.

Required to submit (unless DQ flag raised). Until entered, the Submit button shows "Sprint time required" tooltip.

### DQ flag

Sidebar button → opens `<DqModal>`:

- Reason dropdown (4 options from `dq_reason` enum + "Other")
- Notes textarea (required)
- Confirm
- On confirm: insert `disqualifications` row pointing at this scoresheet; show a banner on the form "⚠ DQ raised: <reason>"
- DQ does NOT auto-set `participants.qualified = false`. That's super_admin's call in Track 2. The flag is the judge's evidence.

### Autosave

- Trigger on: criterion change (level, points, comment), blur of any input, time picker change.
- Debounce 1s — coalesces rapid clicks.
- Also a hard interval: every 10s if any change is pending.
- Indicator on right column: `◐ saving…` → `◐ saved 3s ago` → `⚠ save failed — retrying` (with retry button).
- Server-side: form action `?/save` upserts the changed `scores` rows + updates `scoresheets.live_sprint_time_seconds` if changed.
- Uses SvelteKit form actions with progressive enhancement — works without JS (degrades to per-criterion form submit).

### Submit flow

1. Click "SUBMIT FINAL" → confirmation modal:

   ```
   Submit Aisha Tan's scoresheet?

   Once submitted you cannot edit. Only the super admin can unlock it.
   Final total: 84 / 100      Sprint time: 41:27

   [ Cancel ]    [ Submit ▸ ]
   ```

2. On confirm: `?/submit` action — validates all criteria scored, validates sprint time entered (or DQ raised), updates `status = 'submitted'` and `submitted_at = now()`.
3. Redirect to `/judge/done/[scoresheetId]`.

### `/judge/done/[scoresheetId]`

Summary card:

- Big "✓ Submitted" with timestamp
- Recap: participant, total, time
- Per-criterion line list (level + points)
- Buttons: `Back to queue`, `Score the next one ›`

---

## Server actions (`+page.server.ts` for the scoring page)

```ts
export const actions = {
	save: async ({ request, locals, params }) => {
		const user = locals.user;
		if (user.role !== 'judge' && user.role !== 'super_admin') throw error(403);

		// Idempotent upsert: get or create scoresheet, then upsert each score row
		const { sheet } = await getOrCreateScoresheet(locals.supabase, params.participantId, user.id);
		const formData = await request.formData();
		const payload = parseScorePayload(formData); // { criterionId, level, points, comment }[]

		for (const s of payload) {
			await locals.supabase.from('scores').upsert(
				{
					scoresheet_id: sheet.id,
					criterion_id: s.criterionId,
					level: s.level,
					points: s.points,
					comment: s.comment
				},
				{ onConflict: 'scoresheet_id,criterion_id' }
			);
		}

		const sprintTime = formData.get('live_sprint_time_seconds');
		if (sprintTime !== null) {
			await locals.supabase
				.from('scoresheets')
				.update({
					live_sprint_time_seconds: Number(sprintTime)
				})
				.eq('id', sheet.id);
		}

		return { saved: true, at: new Date().toISOString() };
	},

	submit: async ({ locals, params }) => {
		// Validate all criteria scored, sprint time set (or DQ raised), then UPDATE status='submitted'
		// RLS prevents this if event is locked.
	},

	flagDq: async ({ request, locals }) => {
		// INSERT INTO disqualifications
	}
};
```

---

## Components to build

| Component               | Notes                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| `<RadioLevel>`          | 3 or 4 radio rows; each shows level name + band + descriptor in small text below |
| `<NumberStepper>`       | `-` button, big numeric display, `+` button; respects min/max; touch-friendly    |
| `<TimeInput>`           | `MM : SS` two-input combo; max param; emits integer seconds                      |
| `<CriterionCard>`       | Wraps the above + comment toggle + collapse-when-scored                          |
| `<LiveTotalCard>`       | Big mono number, progress bar, count-up animation                                |
| `<SaveStatusIndicator>` | "saving / saved / failed" with timestamp                                         |
| `<DqModal>`             | Reason + notes + confirm                                                         |
| `<SubmitConfirmModal>`  | Pre-submit recap and confirm                                                     |

---

## Commit checkpoints

1. `judge: queue page using judge_queue view`
2. `judge: scoring page shell with section/criteria layout from db`
3. `judge: radio-level component with auto-fill points behaviour`
4. `judge: number stepper component with band clamping`
5. `judge: time input (mm:ss) component`
6. `judge: live total and progress sidebar`
7. `judge: autosave via form action with debounce + status indicator`
8. `judge: dq flag modal and persistence`
9. `judge: submit flow with confirmation and post-submit redirect`
10. `judge: done page with per-criterion recap`
11. `judge: mobile/tablet sticky-bottom layout for sidebar`

---

## Acceptance criteria

- [ ] A judge can complete and submit a Cat A scoresheet in under 5 minutes (6 criteria + time + submit)
- [ ] Picking "Excellent" auto-fills points to mid-band; judge can adjust
- [ ] Typing a value outside the chosen level's band re-selects the matching level (or rejects if no level matches)
- [ ] Autosave indicator shows "saved Ns ago" within 1s of any change
- [ ] Closing the tab and reopening restores the draft exactly (server-side state)
- [ ] Submit button disabled until all criteria scored AND sprint time entered (or DQ flag raised)
- [ ] After submit, page is read-only and shows the "done" summary
- [ ] If super_admin locks the event mid-scoring, the next save returns an RLS error → UI shows "Event locked"
- [ ] Tablet portrait (768×1024): all touch targets ≥ 44px, sidebar collapses to bottom sheet
- [ ] No JS errors in console during a full scoresheet
- [ ] Audit log shows `score_create`/`score_update` rows for every change (Track 4 verifies)

## Out of scope

- ❌ Override flow (Track 5 — super_admin only)
- ❌ Audit log viewer (Track 4)
- ❌ Leaderboard / results (Track 5)

## Gotchas

- **The `check_score_in_band` trigger** will REJECT inserts/updates where points fall outside the chosen level's band. Your client-side clamp must match — never let invalid data reach the server.
- **Cat A Section B "Sprite Added Correctly"** has only 3 levels (no Developing). `<RadioLevel>` must handle 3 OR 4 levels gracefully.
- **`live_sprint_time_seconds` upper bound is 2700 (45:00).** Enforce in UI; DB CHECK constraint catches overruns.
- **Realtime collision:** if super_admin overrides a score while judge has the form open, the judge sees stale data. Subscribe to scoresheet changes on the client and toast "Super admin updated this scoresheet — refreshing" + refetch.
- **Idempotent upserts**: keep the `scores` UPSERT `ON CONFLICT (scoresheet_id, criterion_id)` so retried autosaves don't duplicate rows.
- **The page MUST work without JS** for the most basic flow (pick level + enter points + click save) — SvelteKit form actions give you this for free. Progressive enhancement adds the autosave, count-up, etc.
