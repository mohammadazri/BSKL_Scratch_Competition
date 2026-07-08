<!--
	/judge/score/[participantId] — the scoring form.

	Two-column on desktop (criteria left, sidebar right); single-column with a
	sticky bottom bar on mobile / tablet portrait.

	The page is a single <form> that:
	  - Posts to `?/save` for autosaves (debounced 1s + every 10s if pending).
	  - Posts to `?/submit` for the final submission (after a confirmation).
	  - Posts to `?/flagDq` for DQ flag.

	Without JS the form still submits each save manually via the visible
	"Save & exit" button; with JS we intercept and call `enhance` so the user
	never sees a full reload during normal editing.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { applyAction, deserialize, enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	// BrandHeader now provided by /judge/+layout.svelte's AppShell.
	import CriterionCard from '$lib/components/CriterionCard.svelte';
	import LiveTotalCard from '$lib/components/LiveTotalCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import SaveStatusIndicator from '$lib/components/SaveStatusIndicator.svelte';
	import type { SaveState } from '$lib/components/SaveStatusIndicator.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import TimeInput from '$lib/components/TimeInput.svelte';
	import { subscribeTable } from '$lib/realtime';
	import { toasts } from '$lib/stores/toast';
	import type { PerfLevel } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}
	let { data, form }: Props = $props();

	// ── Local state per criterion ─────────────────────────────────────────────
	type LocalScore = {
		level: PerfLevel | null;
		points: number | null;
		comment: string | null;
		checkpointIds: string[];
	};

	function buildInitial(): Record<string, LocalScore> {
		const out: Record<string, LocalScore> = {};
		for (const c of data.criteria) {
			const existing = data.scores.find((s) => s.criterionId === c.id);
			out[c.id] = existing
				? {
						level: existing.level,
						points: existing.points,
						comment: existing.comment,
						checkpointIds: existing.checkpointIds ?? []
					}
				: { level: null, points: null, comment: null, checkpointIds: [] };
		}
		return out;
	}

	let scoreState: Record<string, LocalScore> = $state(untrack(() => buildInitial()));
	let sprintSeconds = $state<number | null>(
		untrack(() => data.scoresheet?.liveSprintTimeSeconds ?? null)
	);

	// ── Live total + progress derivations ─────────────────────────────────────
	// During Section A, the LiveTotalCard tracks Section A only — showing
	// "10 / 100 · 4 of 14 scored" while Section B is locked is demoralising
	// when the judge has actually finished what they CAN score. During
	// Section B the goal is to complete the full sheet so we show the grand
	// total. allScored (used by canSubmit) always reflects the full sheet
	// because submission only happens once both sections are done.
	let scopedCriteria = $derived(
		data.phase === 'section_a' ? data.criteria.filter((c) => c.section === 'A') : data.criteria
	);
	let total = $derived(
		scopedCriteria.reduce((sum, c) => sum + (scoreState[c.id]?.points ?? 0), 0)
	);
	let maxTotal = $derived(scopedCriteria.reduce((sum, c) => sum + c.maxPoints, 0));
	let scoredCount = $derived(
		scopedCriteria.filter(
			(c) => scoreState[c.id]?.level !== null && scoreState[c.id]?.points !== null
		).length
	);
	let totalCriteria = $derived(scopedCriteria.length);
	let allScored = $derived(
		data.criteria.length > 0 &&
			data.criteria.every(
				(c) => scoreState[c.id]?.level !== null && scoreState[c.id]?.points !== null
			)
	);
	let dqRaised = $derived(data.dq !== null);
	// Section grouping + per-judge soft-lock. Declared here — before the submit-
	// eligibility deriveds below that read them — so references resolve in
	// declaration order.
	let sectionA = $derived(data.criteria.filter((c) => c.section === 'A'));
	let sectionB = $derived(data.criteria.filter((c) => c.section === 'B'));
	let sectionASubmittedByJudge = $derived(!!data.scoresheet?.sectionASubmittedAt);
	// Submit eligibility, branching on the active phase.
	//   Section A: enabled when all Section A criteria are scored AND the
	//              judge hasn't already submitted Section A for this sheet.
	//   Section B: enabled when ALL criteria are scored AND (sprint time set
	//              OR a DQ flag is raised).
	let sectionAAllScored = $derived(
		sectionA.length > 0 &&
			sectionA.every(
				(c) => scoreState[c.id]?.level !== null && scoreState[c.id]?.points !== null
			)
	);
	let canSubmit = $derived(
		!data.readOnly &&
			((data.phase === 'section_a' && sectionAAllScored && !sectionASubmittedByJudge) ||
				(data.phase === 'section_b' && allScored && (sprintSeconds !== null || dqRaised)))
	);
	let submitLabel = $derived(
		data.phase === 'section_a' ? 'Submit Section A ›' : 'Submit final ›'
	);

	// ── Autosave state machine ────────────────────────────────────────────────
	let saveState: SaveState = $state(untrack(() => (data.scoresheet ? 'saved' : 'idle')));
	let savedAt = $state<number | null>(untrack(() => (data.scoresheet ? Date.now() : null)));
	let saveError = $state<string | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let intervalTimer: ReturnType<typeof setInterval> | null = null;
	let pendingDirty = $state(false);

	const DEBOUNCE_MS = 1000;
	const HARD_INTERVAL_MS = 10_000;

	function markDirty() {
		if (data.readOnly) return;
		pendingDirty = true;
		saveState = 'pending';
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			triggerSave();
		}, DEBOUNCE_MS);
	}

	let scoringForm = $state<HTMLFormElement | null>(null);

	async function triggerSave() {
		if (!scoringForm || data.readOnly) return;
		if (saveState === 'saving') return;
		if (!pendingDirty && saveState === 'saved') return;
		saveState = 'saving';
		saveError = null;
		const fd = new FormData(scoringForm);
		try {
			const res = await fetch('?/save', { method: 'POST', body: fd });
			if (!res.ok && res.status !== 200) {
				const text = await res.text();
				throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
			}
			// SvelteKit form-action responses come back as either application/json
			// (success/fail payload) or text/html. We trust the HTTP status.
			saveState = 'saved';
			savedAt = Date.now();
			pendingDirty = false;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			saveError = msg.includes('row-level') || msg.includes('locked')
				? 'Event locked or scoresheet read-only.'
				: msg;
			saveState = 'failed';
		}
	}

	// Live realtime watch: when the admin approves OR denies a judge-raised
	// request on this scoresheet, refresh so locks / DQ status are correct
	// without the judge having to refresh manually.
	onMount(() => {
		const sheetId = data.scoresheet?.id;
		if (!sheetId) return;

		const editUnsub = subscribeTable<{
			id: string;
			status: string;
			resolved_note: string | null;
		}>('edit_requests', {
			filter: `scoresheet_id=eq.${sheetId}`,
			onUpdate: (row) => {
				if (row.status === 'approved') {
					toasts.success(
						'Admin approved your edit request — the scoresheet is unlocked.',
						'Edit access granted'
					);
					invalidateAll();
				} else if (row.status === 'denied') {
					toasts.error(
						row.resolved_note
							? `Reason: ${row.resolved_note}`
							: 'Your edit request was denied.',
						'Edit access denied'
					);
					invalidateAll();
				}
			}
		});

		const dqUnsub = subscribeTable<{
			id: string;
			status: string;
			resolution_note: string | null;
		}>('disqualifications', {
			filter: `scoresheet_id=eq.${sheetId}`,
			onUpdate: (row) => {
				if (row.status === 'approved') {
					toasts.success(
						'Admin approved the disqualification.',
						'Disqualification confirmed'
					);
					invalidateAll();
				} else if (row.status === 'denied') {
					toasts.info(
						row.resolution_note
							? `Reason: ${row.resolution_note}`
							: 'Admin rejected the disqualification — participant stays qualified.',
						'Disqualification rejected'
					);
					invalidateAll();
				}
			}
		});

		return () => {
			editUnsub();
			dqUnsub();
		};
	});

	$effect(() => {
		// Hard interval as a safety net while there are unsaved changes.
		intervalTimer = setInterval(() => {
			if (pendingDirty && saveState !== 'saving') triggerSave();
		}, HARD_INTERVAL_MS);
		return () => {
			if (intervalTimer) clearInterval(intervalTimer);
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	// Warn before leaving with unsaved changes.
	$effect(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			if (pendingDirty || saveState === 'saving') {
				e.preventDefault();
				e.returnValue = '';
			}
		}
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

	function onCriterionChange(id: string) {
		return (next: LocalScore) => {
			const prev = scoreState[id];
			const wasScored = prev?.level !== null && prev?.points !== null;
			scoreState[id] = { ...next };
			markDirty();

			// Auto-advance only in LEGACY (level) mode — picking a level is a
			// decisive "I'm done with this card" signal. In CHECKPOINT mode the
			// judge usually wants to tick several boxes on the same card; auto-
			// advancing on the first tick would yank the card away mid-flow.
			const criterion = data.criteria.find((c) => c.id === id);
			const isCheckpointMode = Boolean(
				criterion?.checkpoints && criterion.checkpoints.length > 0
			);
			const justGotLevel = !wasScored && next.level !== null;
			if (!isCheckpointMode && justGotLevel) {
				const list = data.phase === 'section_b' ? sectionB : sectionA;
				const idx = list.findIndex((c) => c.id === id);
				let nextOpen: string | null = null;
				for (let i = idx + 1; i < list.length; i++) {
					const s = scoreState[list[i].id];
					if (!s || s.level === null || s.points === null) {
						nextOpen = list[i].id;
						break;
					}
				}
				if (!nextOpen) {
					for (let i = 0; i < idx; i++) {
						const s = scoreState[list[i].id];
						if (!s || s.level === null || s.points === null) {
							nextOpen = list[i].id;
							break;
						}
					}
				}
				activeCriterionId = nextOpen;
			}
		};
	}

	function onSprintChange(v: number | null) {
		sprintSeconds = v;
		markDirty();
	}

	// ── Phase-aware editability ────────────────────────────────────────────────
	// Per-judge soft-lock: when the judge has submitted Section A for this
	// participant, Section A becomes read-only for them even if the event
	// phase is still 'section_a' (sectionA / sectionB / sectionASubmittedByJudge
	// are declared up top so the submit-eligibility deriveds can read them).
	let sectionAEditable = $derived(
		!data.readOnly && data.phase === 'section_a' && !sectionASubmittedByJudge
	);
	let sectionBEditable = $derived(!data.readOnly && data.phase === 'section_b');

	// Per-section totals and progress — used by both the active scoring header
	// and the read-only Section A reference card during Section B.
	let sectionATotal = $derived(
		sectionA.reduce((sum, c) => sum + (scoreState[c.id]?.points ?? 0), 0)
	);
	let sectionAMax = $derived(sectionA.reduce((sum, c) => sum + c.maxPoints, 0));
	let sectionAScored = $derived(
		sectionA.filter(
			(c) => scoreState[c.id]?.level !== null && scoreState[c.id]?.points !== null
		).length
	);
	let sectionBScored = $derived(
		sectionB.filter(
			(c) => scoreState[c.id]?.level !== null && scoreState[c.id]?.points !== null
		).length
	);

	// Section A summary is OPEN by default during Section B so the judge sees
	// their Section A work at all times — when it was collapsed, multiple judges
	// reported that "Section A is gone" because they didn't realise the card
	// expanded. Keep it open; the judge can collapse if they want screen space.
	let sectionASummaryOpen = $state(true);

	// ── Accordion: one criterion expanded at a time ──────────────────────────
	// Why: showing 7 fully-expanded cards = 2500px of scroll = the judge
	// constantly losing context. Collapsed cards take ~50px each, so the whole
	// rubric fits on one screen and the judge picks the next criterion with
	// their eyes still in the same spot. The first unscored criterion in the
	// active section is opened on mount; picking a level auto-advances to the
	// next unscored card so the judge keeps a steady rhythm.
	function firstUnscoredId(list: typeof data.criteria): string | null {
		for (const c of list) {
			const s = scoreState[c.id];
			if (!s || s.level === null || s.points === null) return c.id;
		}
		return null;
	}
	let activeCriterionId = $state<string | null>(
		untrack(() => {
			const initialList = data.phase === 'section_b' ? data.criteria.filter((c) => c.section === 'B') : data.criteria.filter((c) => c.section === 'A');
			return firstUnscoredId(initialList) ?? (initialList[0]?.id ?? null);
		})
	);
	function handleActivate(id: string) {
		activeCriterionId = activeCriterionId === id ? null : id;
	}

	// ── Request-edit flow ─────────────────────────────────────────────────────
	let requestEditModalOpen = $state(false);
	let requestEditReason = $state('');
	let requestEditSubmitting = $state(false);
	let pendingRequest = $derived(data.pendingEditRequest);
	// A scoresheet is "locked" from the judge's perspective if they've
	// submitted Section A OR the whole sheet is submitted/finalised. These are
	// the cases where requesting edit access makes sense.
	let isLockedForJudge = $derived(
		sectionASubmittedByJudge ||
			data.scoresheet?.status === 'submitted' ||
			data.scoresheet?.status === 'finalised'
	);

	// ── Submit modal ──────────────────────────────────────────────────────────
	let submitConfirmOpen = $state(false);
	let dqModalOpen = $state(false);
	let dqReason = $state('complete_on_arrival');
	let dqNotes = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);

	async function onSubmitFinal() {
		if (!canSubmit || !scoringForm) return;
		submitting = true;
		formError = null;
		const fd = new FormData(scoringForm);
		try {
			const res = await fetch('?/submit', {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true' }
			});
			// SvelteKit returns a devalue-encoded action envelope. `deserialize`
			// + `applyAction` handle every type (success, failure, redirect,
			// error) correctly — including action redirects, which come back as
			// HTTP 200 with `{ type: 'redirect', location: '/...' }` in the body.
			const result = deserialize(await res.text());
			if (result.type === 'redirect') {
				await goto(result.location);
				return;
			}
			if (result.type === 'failure' || result.type === 'error') {
				const data = (result.type === 'failure' ? result.data : null) as
					| { submitError?: string }
					| null;
				formError =
					data?.submitError ??
					(result.type === 'error' ? (result.error?.message ?? 'Submit failed.') : 'Submit failed.');
				submitConfirmOpen = false;
				submitting = false;
				return;
			}
			// Success without redirect = Section A submit. The server stamped
			// section_a_submitted_at; reload the data so the page reflects the
			// new read-only state and the submit button stays disabled.
			await applyAction(result);
			await invalidateAll();
			submitConfirmOpen = false;
			submitting = false;
		} catch (err) {
			formError = err instanceof Error ? err.message : String(err);
			submitConfirmOpen = false;
			submitting = false;
		}
	}

	let formattedSprint = $derived(
		sprintSeconds === null
			? '—'
			: `${String(Math.floor(sprintSeconds / 60)).padStart(2, '0')}:${String(
					sprintSeconds % 60
				).padStart(2, '0')}`
	);

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	let timeUntilSprint = $derived(
		data.sprintStart ? Math.max(0, new Date(data.sprintStart).getTime() - now) : null
	);

	function formatCountdown(ms: number) {
		const seconds = Math.floor(ms / 1000);
		const days = Math.floor(seconds / (3600 * 24));
		const hours = Math.floor((seconds % (3600 * 24)) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}
</script>

<div class="mx-auto max-w-7xl px-0 pb-32 lg:pb-10">
	<!-- Breadcrumb -->
	<a
		href="/judge"
		class="mb-3 inline-flex items-center gap-1 text-sm underline"
		style="color: var(--color-text-2);"
	>
		‹ My queue
	</a>

	<!-- Participant header — name + theme are the two things the judge most
	     needs to see at a glance: who is in front of them, and what they
	     built. Pushed up the visual hierarchy so neither gets buried under
	     status chips. -->
	<header
		class="mb-6 border-b pb-5"
		style="border-color: var(--border);"
	>
		<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
			<h1
				class="text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.6rem]"
				style="color: var(--color-text-1); font-family: var(--font-display);"
			>
				{data.participant.fullName}
			</h1>
			<span
				class="text-base sm:text-lg"
				style="color: var(--color-text-2);"
			>
				{data.participant.schoolName}
			</span>
		</div>
		{#if data.participant.theme}
			<p
				class="mt-2 text-lg font-semibold sm:text-xl"
				style="color: var(--color-accent-2);"
			>
				Theme · {data.participant.theme}
			</p>
		{/if}
		<div class="mt-3 flex flex-wrap items-center gap-3 text-xs" style="color: var(--color-text-2);">
			<span
				class="rounded px-2 py-0.5"
				style="background: var(--accent-soft); color: var(--color-accent); font-family: var(--font-mono);"
			>
				CATEGORY {data.participant.category}
			</span>
			{#if data.scoresheet}
				{@const dqStatus = data.dq?.status === 'approved' ? 'dq' : null}
				{@const aDone =
					data.scoresheet.status === 'draft' && data.scoresheet.sectionASubmittedAt
						? 'section_a_done'
						: null}
				<StatusPill status={dqStatus ?? aDone ?? data.scoresheet.status} />
			{:else}
				<StatusPill status="not_started" />
			{/if}
			{#if data.eventLocked}
				<span style="color: var(--color-danger);">Event locked — read only</span>
			{/if}
		</div>
	</header>

	<!-- Phase banner — compact, single line. Long instructions get in the way
	     when the judge is mid-flow scoring criterion by criterion. -->
	{#if data.phase === 'setup'}
		<div
			class="mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
			style="background: var(--color-bg-2); border-color: var(--border-strong); color: var(--color-text-2);"
		>
			<span class="inline-block h-2 w-2 rounded-full" style="background: var(--color-text-3);"></span>
			Scoring hasn't opened yet. Form is read-only until the admin opens Section A.
		</div>
	{:else if data.phase === 'section_a' && sectionASubmittedByJudge}
		<div
			class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
			style="background: rgba(16, 185, 129, 0.10); border-color: var(--color-success); color: var(--color-text-1);"
		>
			<div class="flex items-center gap-2">
				<span
					class="inline-block h-2 w-2 rounded-full"
					style="background: var(--color-success);"
				></span>
				<strong style="color: var(--color-success);">Section A submitted.</strong>
				<span style="color: var(--color-text-2);">
					Locked until admin opens Section B.
				</span>
			</div>
			{#if pendingRequest}
				<span class="text-[11px]" style="color: var(--color-warning); font-style: italic;">
					Edit access requested · awaiting admin
				</span>
			{:else if !data.readOnly}
				<button
					type="button"
					class="rounded px-2 py-1 text-[11px] underline-offset-4 hover:underline"
					style="color: var(--color-accent-2);"
					onclick={() => (requestEditModalOpen = true)}
				>
					Request edit access
				</button>
			{/if}
		</div>
	{:else if data.phase === 'section_a'}
		<div
			class="mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
			style="background: rgba(124, 58, 237, 0.08); border-color: var(--color-accent); color: var(--color-text-1);"
		>
			<span class="inline-block h-2 w-2 rounded-full" style="background: var(--color-accent);"></span>
			<strong>Section A is open.</strong>
			<span style="color: var(--color-text-2);">
				Pre-event scoring · Section B opens on event day.
			</span>
		</div>
	{:else if data.phase === 'section_b'}
		<div
			class="mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
			style="background: rgba(8, 145, 178, 0.08); border-color: var(--color-accent-2); color: var(--color-text-1);"
		>
			<span class="inline-block h-2 w-2 rounded-full" style="background: var(--color-accent-2);"></span>
			<strong>Section B is open.</strong>
			<span style="color: var(--color-text-2);">Section A locked · submit when all scored.</span>
		</div>
	{:else}
		<div
			class="mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
			style="background: rgba(239,68,68,0.08); border-color: var(--color-danger); color: var(--color-danger);"
		>
			<span class="inline-block h-2 w-2 rounded-full" style="background: var(--color-danger);"></span>
			Scoring is finalised. All scores are read-only.
		</div>
	{/if}

	<!-- Final-submission banner: sheet status is 'submitted'/'finalised', no
	     more editing possible. Offer a "Request edit access" button so the
	     judge isn't stuck. -->
	{#if data.scoresheet && (data.scoresheet.status === 'submitted' || data.scoresheet.status === 'finalised')}
		<div
			class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
			style="background: rgba(16, 185, 129, 0.10); border-color: var(--color-success); color: var(--color-text-1);"
		>
			<div class="flex items-center gap-2">
				<span
					class="inline-block h-2 w-2 rounded-full"
					style="background: var(--color-success);"
				></span>
				<strong style="color: var(--color-success);">Scoresheet submitted.</strong>
				<span style="color: var(--color-text-2);">Locked. Spotted a mistake?</span>
			</div>
			{#if pendingRequest}
				<span class="text-[11px]" style="color: var(--color-warning); font-style: italic;">
					Edit access requested · awaiting admin
				</span>
			{:else}
				<button
					type="button"
					class="rounded px-2 py-1 text-[11px] underline-offset-4 hover:underline"
					style="color: var(--color-accent-2);"
					onclick={() => (requestEditModalOpen = true)}
				>
					Request edit access
				</button>
			{/if}
		</div>
	{/if}

	{#if data.dq}
		<div
			class="mb-4 rounded-md border p-3 text-sm"
			style="background: rgba(239,68,68,0.08); border-color: var(--color-danger); color: var(--color-danger);"
		>
			<strong>
				{#if data.dq.status === 'pending'}
					Disqualification request — awaiting admin approval:
				{:else}
					Disqualification approved:
				{/if}
			</strong>
			{data.dq.reason.replaceAll('_', ' ')} — {data.dq.notes}
		</div>
	{/if}

	{#if formError}
		<div
			class="mb-4 rounded-md border p-3 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			{formError}
		</div>
	{/if}

	{#if form?.saveError}
		<div
			class="mb-4 rounded-md border p-3 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			{form.saveError}
		</div>
	{/if}

	<form
		bind:this={scoringForm}
		method="POST"
		action="?/save"
		class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_22rem)]"
		use:enhance={() => {
			return async ({ result, update }) => {
				// Suppress full reload — we drive autosave via fetch below. But still
				// keep enhance for the "Save & exit" button path (no-JS fallback).
				if (result.type === 'success') {
					saveState = 'saved';
					savedAt = Date.now();
					pendingDirty = false;
				}
				await update({ reset: false });
			};
		}}
	>
		<!-- Left column: criteria
		     Design principle: one section visible at a time. The phase
		     dictates what's on screen so the judge focuses on the task
		     in front of them, not on what's NOT available yet. -->
		<div class="flex flex-col gap-6">
			<!-- Active scoring area. Section A always shows (as read-only history
			     during Section B). Section B only shows during Section B phase. -->
			{#if sectionA.length > 0}
				<section aria-label="Section A criteria">
					<div
						class="mb-4 flex items-baseline justify-between border-b pb-2"
						style="border-color: var(--border);"
					>
						<div class="flex items-center gap-2">
							<span
								class="inline-block h-5 w-1 rounded-sm"
								style="background: var(--color-accent);"
							></span>
							<h2
								class="text-sm font-semibold tracking-[0.12em] uppercase"
								style="color: var(--color-text-1);"
							>
								Section A · Phase 1 At-Home Build
							</h2>
						</div>
						<span class="text-xs" style="color: var(--color-text-2); font-family: var(--font-mono);">
							{sectionAScored} / {sectionA.length} scored
						</span>
					</div>
					<div class="flex flex-col gap-2">
						{#each sectionA as c (c.id)}
							<CriterionCard
								criterion={c}
								bind:level={scoreState[c.id].level}
								bind:points={scoreState[c.id].points}
								bind:comment={scoreState[c.id].comment}
								bind:checkpointIds={scoreState[c.id].checkpointIds}
								disabled={!sectionAEditable}
								isActive={activeCriterionId === c.id}
								onActivate={handleActivate}
								onChange={onCriterionChange(c.id)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			{#if data.phase === 'section_b' && sectionB.length > 0}
				<section aria-label="Section B criteria">
					<div
						class="mb-4 flex items-baseline justify-between border-b pb-2"
						style="border-color: var(--border);"
					>
						<div class="flex items-center gap-2">
							<span
								class="inline-block h-5 w-1 rounded-sm"
								style="background: var(--color-accent-2);"
							></span>
							<h2
								class="text-sm font-semibold tracking-[0.12em] uppercase"
								style="color: var(--color-text-1);"
							>
								Section B · Live Sprint Mystery
							</h2>
						</div>
						<span class="text-xs" style="color: var(--color-text-2); font-family: var(--font-mono);">
							{sectionBScored} / {sectionB.length} scored
						</span>
					</div>
					<div class="flex flex-col gap-2">
						{#each sectionB as c (c.id)}
							<CriterionCard
								criterion={c}
								bind:level={scoreState[c.id].level}
								bind:points={scoreState[c.id].points}
								bind:comment={scoreState[c.id].comment}
								bind:checkpointIds={scoreState[c.id].checkpointIds}
								disabled={!sectionBEditable}
								isActive={activeCriterionId === c.id}
								onActivate={handleActivate}
								onChange={onCriterionChange(c.id)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Empty placeholder or Countdown Timer if neither section is in scope -->
			{#if data.phase === 'setup' || data.phase === 'finalised'}
				<div
					class="flex flex-col items-center justify-center rounded-lg border p-12 text-center"
					style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
				>
					{#if data.phase === 'setup' && timeUntilSprint !== null && timeUntilSprint > 0}
						<div class="mb-2 text-sm uppercase tracking-widest text-emerald-500 font-semibold">Section B begins in</div>
						<div class="text-5xl font-mono text-white mb-2" style="font-family: var(--font-display); font-variant-numeric: tabular-nums;">
							{formatCountdown(timeUntilSprint)}
						</div>
						<div class="text-xs text-zinc-400">Please wait for the administrator to open the scoring.</div>
					{:else}
						<div class="text-sm">
							{data.phase === 'setup'
								? 'No section is open for scoring yet.'
								: 'Scoring is finalised. View-only.'}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Right column: sidebar -->
		<aside class="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
			<LiveTotalCard
				{total}
				{maxTotal}
				{scoredCount}
				{totalCriteria}
			/>

			<div
				class="rounded-lg border p-4"
				style="background: var(--color-bg-2); border-color: var(--border);"
			>
				<p
					class="mb-2 text-xs font-medium tracking-[0.15em] uppercase"
					style="color: var(--color-text-2);"
				>
					Sprint time
				</p>
				<TimeInput
					name="live_sprint_time_seconds"
					value={sprintSeconds}
					disabled={!sectionBEditable}
					onValue={onSprintChange}
				/>
				<p class="mt-2 text-xs" style="color: var(--color-text-3);">
					mm:ss · max 45:00 · used for tiebreaks
					{#if data.phase !== 'section_b'}
						<br /><span style="color: var(--color-warning);">Enabled during Section B.</span>
					{/if}
				</p>
			</div>

			<div
				class="rounded-lg border p-4"
				style="background: var(--color-bg-2); border-color: var(--border);"
			>
				<SaveStatusIndicator
					status={saveState}
					{savedAt}
					errorMessage={saveError}
					onRetry={triggerSave}
				/>
			</div>

			<button
				type="button"
				onclick={() => (dqModalOpen = true)}
				disabled={data.readOnly}
				class="inline-flex h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors disabled:opacity-40"
				style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger); min-height: 44px;"
			>
				{data.dq ? 'Update disqualification' : 'Request disqualification'}
			</button>

			<div
				class="hidden flex-col gap-2 lg:flex"
			>
				<button
					type="submit"
					formaction="?/save"
					class="inline-flex h-11 items-center justify-center rounded-md border text-sm font-medium"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1); min-height: 44px;"
					disabled={data.readOnly}
				>
					Save draft
				</button>
				<button
					type="button"
					onclick={() => {
						formError = null;
						submitConfirmOpen = true;
					}}
					disabled={!canSubmit || submitting}
					title={canSubmit
						? data.phase === 'section_a'
							? 'Submit Section A scores'
							: 'Submit this scoresheet'
						: data.phase === 'section_a'
							? 'Score every Section A criterion'
							: dqRaised
								? 'Score every criterion'
								: 'Score every criterion AND enter sprint time (or request a disqualification)'}
					class="inline-flex h-11 items-center justify-center rounded-md text-sm font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					style="background: var(--color-accent); color: #fff; min-height: 44px;"
				>
					{submitLabel}
				</button>
			</div>
		</aside>

		<!-- Mobile / tablet sticky bottom bar -->
		<div
			class="fixed inset-x-0 bottom-0 z-40 border-t p-3 lg:hidden"
			style="background: var(--color-bg-2); border-color: var(--border-strong);"
		>
			<div class="mx-auto flex max-w-7xl items-center justify-between gap-3">
				<div class="min-w-0">
					<p
						class="text-2xl font-semibold leading-none tabular-nums"
						style="font-family: var(--font-mono); color: var(--color-text-1);"
					>
						{total}<span class="text-sm" style="color: var(--color-text-2);">/{maxTotal}</span>
					</p>
					<p class="text-[11px]" style="color: var(--color-text-2);">
						{scoredCount}/{totalCriteria} criteria · {formattedSprint}
					</p>
				</div>
				<div class="flex gap-2">
					<button
						type="submit"
						formaction="?/save"
						class="inline-flex h-11 items-center justify-center rounded-md border px-3 text-sm font-medium"
						style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1); min-height: 44px;"
						disabled={data.readOnly}
					>
						Save
					</button>
					<button
						type="button"
						onclick={() => {
							formError = null;
							submitConfirmOpen = true;
						}}
						disabled={!canSubmit || submitting}
						class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold uppercase disabled:opacity-40"
						style="background: var(--color-accent); color: #fff; min-height: 44px;"
					>
						{data.phase === 'section_a' ? 'Submit A' : 'Submit'}
					</button>
				</div>
			</div>
		</div>
	</form>
</div>

<!-- Submit confirmation modal — copy adapts to the active phase. -->
<Modal
	open={submitConfirmOpen}
	title={data.phase === 'section_a' ? 'Submit Section A?' : 'Submit final scoresheet?'}
	onClose={() => (submitConfirmOpen = false)}
>
	<div class="flex flex-col gap-4">
		<p class="text-sm" style="color: var(--color-text-2);">
			{#if data.phase === 'section_a'}
				Submit Section A for
				<strong style="color: var(--color-text-1);">{data.participant.fullName}</strong>?
				You won't be able to edit Section A again unless the admin unlocks it. Section B
				stays available on event day.
			{:else}
				Submit
				<strong style="color: var(--color-text-1);">{data.participant.fullName}'s</strong>
				scoresheet? Once submitted you cannot edit. Only the super admin can unlock it.
			{/if}
		</p>
		<dl class="grid grid-cols-2 gap-2 text-sm">
			<dt style="color: var(--color-text-2);">
				{data.phase === 'section_a' ? 'Section A total' : 'Final total'}
			</dt>
			<dd style="font-family: var(--font-mono); color: var(--color-text-1);">
				{total} / {maxTotal}
			</dd>
			{#if data.phase === 'section_b'}
				<dt style="color: var(--color-text-2);">Sprint time</dt>
				<dd style="font-family: var(--font-mono); color: var(--color-text-1);">
					{dqRaised && sprintSeconds === null ? '— (disqualified)' : formattedSprint}
				</dd>
				{#if dqRaised}
					<dt style="color: var(--color-danger);">Disqualification</dt>
					<dd style="color: var(--color-danger);">requested</dd>
				{/if}
			{/if}
		</dl>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={() => (submitConfirmOpen = false)}
				class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
				style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={onSubmitFinal}
				disabled={submitting}
				class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold uppercase disabled:opacity-40"
				style="background: var(--color-accent); color: #fff;"
			>
				{submitting
					? 'Submitting…'
					: data.phase === 'section_a'
						? 'Submit Section A ›'
						: 'Submit ›'}
			</button>
		</div>
	</div>
</Modal>

<!-- DQ modal -->
<Modal
	open={dqModalOpen}
	title={data.dq ? 'Update disqualification request' : 'Request disqualification'}
	onClose={() => (dqModalOpen = false)}
>
	<form
		method="POST"
		action="?/flagDq"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					dqModalOpen = false;
					dqNotes = '';
					await invalidateAll();
				} else {
					await applyAction(result);
				}
				await update({ reset: false });
			};
		}}
		class="flex flex-col gap-3"
	>
		<label class="flex flex-col gap-1 text-sm">
			<span style="color: var(--color-text-2);">Reason</span>
			<select
				name="reason"
				bind:value={dqReason}
				class="rounded-md border p-2"
				style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1); min-height: 44px;"
			>
				<option value="complete_on_arrival">Complete on arrival</option>
				<option value="tutorial_or_ai_use">Tutorial or AI use</option>
				<option value="parental_assistance">Parental assistance</option>
				<option value="unsportsmanlike_conduct">Unsportsmanlike conduct</option>
				<option value="other">Other</option>
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span style="color: var(--color-text-2);">Notes (required)</span>
			<textarea
				name="notes"
				rows="3"
				required
				maxlength="1000"
				bind:value={dqNotes}
				placeholder="What did you observe?"
				class="rounded-md border p-2"
				style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
			></textarea>
		</label>

		{#if form?.dqError}
			<p class="text-xs" style="color: var(--color-danger);">{form.dqError}</p>
		{/if}

		<div class="flex justify-end gap-2 pt-2">
			<button
				type="button"
				onclick={() => (dqModalOpen = false)}
				class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
				style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
			>
				Cancel
			</button>
			<button
				type="submit"
				class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold uppercase"
				style="background: var(--color-danger); color: #fff;"
			>
				Confirm
			</button>
		</div>
	</form>
</Modal>

<!-- Request edit access modal -->
<Modal
	open={requestEditModalOpen}
	title="Request edit access"
	onClose={() => (requestEditModalOpen = false)}
>
	<form
		method="POST"
		action="?/requestEdit"
		use:enhance={() => {
			requestEditSubmitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				requestEditSubmitting = false;
				if (form?.requestSent) {
					requestEditModalOpen = false;
					requestEditReason = '';
					await invalidateAll();
				}
			};
		}}
		class="flex flex-col gap-4"
	>
		<p class="text-sm" style="color: var(--color-text-2);">
			Tell the super admin what you need to change and why. Once they approve, this
			scoresheet becomes editable again until you re-submit.
		</p>
		{#if form?.requestError}
			<div
				class="rounded-md border p-2 text-xs"
				style="border-color: var(--color-danger); color: var(--color-danger); background: rgba(239, 68, 68, 0.08);"
			>
				{form.requestError}
			</div>
		{/if}
		<label class="block">
			<span
				class="mb-1 block text-xs font-medium tracking-wider uppercase"
				style="color: var(--color-text-2);">Reason</span
			>
			<textarea
				name="reason"
				required
				minlength="10"
				maxlength="1000"
				rows="4"
				bind:value={requestEditReason}
				placeholder="e.g. I marked criterion 3 wrong — meant to give Excellent not Proficient."
				class="w-full rounded-md border p-2 text-sm"
				style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			></textarea>
			<p class="mt-1 text-[11px]" style="color: var(--color-text-3);">
				At least 10 characters. The reason is logged in the audit trail.
			</p>
		</label>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={() => (requestEditModalOpen = false)}
				class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
				style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={requestEditSubmitting || requestEditReason.trim().length < 10}
				class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold uppercase disabled:opacity-40"
				style="background: var(--color-accent); color: #fff;"
			>
				{requestEditSubmitting ? 'Sending…' : 'Send request'}
			</button>
		</div>
	</form>
</Modal>
