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
	import { untrack } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import BrandHeader from '$lib/components/BrandHeader.svelte';
	import CriterionCard from '$lib/components/CriterionCard.svelte';
	import LiveTotalCard from '$lib/components/LiveTotalCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import SaveStatusIndicator from '$lib/components/SaveStatusIndicator.svelte';
	import type { SaveState } from '$lib/components/SaveStatusIndicator.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import TimeInput from '$lib/components/TimeInput.svelte';
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
	};

	function buildInitial(): Record<string, LocalScore> {
		const out: Record<string, LocalScore> = {};
		for (const c of data.criteria) {
			const existing = data.scores.find((s) => s.criterionId === c.id);
			out[c.id] = existing
				? { level: existing.level, points: existing.points, comment: existing.comment }
				: { level: null, points: null, comment: null };
		}
		return out;
	}

	let scoreState: Record<string, LocalScore> = $state(untrack(() => buildInitial()));
	let sprintSeconds = $state<number | null>(
		untrack(() => data.scoresheet?.liveSprintTimeSeconds ?? null)
	);

	// ── Live total + progress derivations ─────────────────────────────────────
	let total = $derived(
		data.criteria.reduce((sum, c) => sum + (scoreState[c.id]?.points ?? 0), 0)
	);
	let maxTotal = $derived(data.criteria.reduce((sum, c) => sum + c.maxPoints, 0));
	let scoredCount = $derived(
		data.criteria.filter((c) => scoreState[c.id]?.level !== null && scoreState[c.id]?.points !== null).length
	);
	let totalCriteria = $derived(data.criteria.length);
	let allScored = $derived(scoredCount === totalCriteria && totalCriteria > 0);
	let dqRaised = $derived(data.dq !== null);
	let canSubmit = $derived(
		!data.readOnly &&
			allScored &&
			(sprintSeconds !== null || dqRaised)
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
			scoreState[id] = { ...next };
			markDirty();
		};
	}

	function onSprintChange(v: number | null) {
		sprintSeconds = v;
		markDirty();
	}

	// ── Section grouping for the layout ───────────────────────────────────────
	let sectionA = $derived(data.criteria.filter((c) => c.section === 'A'));
	let sectionB = $derived(data.criteria.filter((c) => c.section === 'B'));

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
			const res = await fetch('?/submit', { method: 'POST', body: fd });
			if (res.redirected) {
				goto(res.url);
				return;
			}
			// On fail, parse the SvelteKit JSON envelope.
			const payload = await res.json().catch(() => null);
			const msg = payload?.data?.submitError ?? `Submit failed (HTTP ${res.status}).`;
			formError = String(msg);
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
</script>

<BrandHeader />

<div class="mx-auto max-w-7xl px-4 pt-6 pb-32 sm:px-6 lg:pb-10">
	<!-- Breadcrumb -->
	<a
		href="/judge"
		class="mb-3 inline-flex items-center gap-1 text-sm underline"
		style="color: var(--color-text-2);"
	>
		‹ My queue
	</a>

	<!-- Participant header -->
	<header
		class="mb-6 flex flex-col gap-1 border-b pb-4"
		style="border-color: var(--border);"
	>
		<h1 class="text-2xl font-semibold sm:text-3xl" style="color: var(--color-text-1);">
			{data.participant.fullName}
			<span class="ml-2 text-base" style="color: var(--color-text-2);">
				· {data.participant.schoolName}
			</span>
		</h1>
		<div class="flex flex-wrap items-center gap-3 text-xs" style="color: var(--color-text-2);">
			<span
				class="rounded px-2 py-0.5"
				style="background: var(--accent-soft); color: var(--color-accent); font-family: var(--font-mono);"
			>
				CATEGORY {data.participant.category}
			</span>
			{#if data.participant.theme}
				<span>{data.participant.theme}</span>
			{/if}
			{#if data.scoresheet}
				<StatusPill status={data.scoresheet.status} />
			{:else}
				<StatusPill status="not_started" />
			{/if}
			{#if data.eventLocked}
				<span style="color: var(--color-danger);">Event locked — read only</span>
			{/if}
		</div>
	</header>

	{#if data.dq}
		<div
			class="mb-4 rounded-md border p-3 text-sm"
			style="background: rgba(239,68,68,0.08); border-color: var(--color-danger); color: var(--color-danger);"
		>
			<strong>DQ flag raised:</strong>
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
		<!-- Left column: criteria -->
		<div class="flex flex-col gap-8">
			{#if sectionA.length > 0}
				<div>
					<div class="mb-3 flex items-baseline gap-2">
						<span
							class="inline-block h-4 w-1 rounded-sm"
							style="background: var(--color-accent);"
						></span>
						<h2
							class="text-xs font-semibold tracking-[0.18em] uppercase"
							style="color: var(--color-text-2);"
						>
							Section A · Phase 1 At-Home Build
						</h2>
					</div>
					<div class="flex flex-col gap-4">
						{#each sectionA as c (c.id)}
							<CriterionCard
								criterion={c}
								bind:level={scoreState[c.id].level}
								bind:points={scoreState[c.id].points}
								bind:comment={scoreState[c.id].comment}
								disabled={data.readOnly}
								onChange={onCriterionChange(c.id)}
							/>
						{/each}
					</div>
				</div>
			{/if}

			{#if sectionB.length > 0}
				<div>
					<div class="mb-3 flex items-baseline gap-2">
						<span
							class="inline-block h-4 w-1 rounded-sm"
							style="background: var(--color-accent-2);"
						></span>
						<h2
							class="text-xs font-semibold tracking-[0.18em] uppercase"
							style="color: var(--color-text-2);"
						>
							Section B · Live Sprint Mystery
						</h2>
					</div>
					<div class="flex flex-col gap-4">
						{#each sectionB as c (c.id)}
							<CriterionCard
								criterion={c}
								bind:level={scoreState[c.id].level}
								bind:points={scoreState[c.id].points}
								bind:comment={scoreState[c.id].comment}
								disabled={data.readOnly}
								onChange={onCriterionChange(c.id)}
							/>
						{/each}
					</div>
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
					disabled={data.readOnly}
					onValue={onSprintChange}
				/>
				<p class="mt-2 text-xs" style="color: var(--color-text-3);">
					mm:ss · max 45:00 · used for tiebreaks
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
				{data.dq ? 'Update DQ flag' : 'Raise DQ flag'}
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
						? 'Submit this scoresheet'
						: dqRaised
							? 'Score every criterion'
							: 'Score every criterion AND enter sprint time (or raise DQ)'}
					class="inline-flex h-11 items-center justify-center rounded-md text-sm font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					style="background: var(--color-accent); color: #fff; min-height: 44px;"
				>
					Submit final ›
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
						Submit
					</button>
				</div>
			</div>
		</div>
	</form>
</div>

<!-- Submit confirmation modal -->
<Modal open={submitConfirmOpen} title="Submit scoresheet?" onClose={() => (submitConfirmOpen = false)}>
	<div class="flex flex-col gap-4">
		<p class="text-sm" style="color: var(--color-text-2);">
			Submit <strong style="color: var(--color-text-1);">{data.participant.fullName}'s</strong>
			scoresheet? Once submitted you cannot edit. Only the super admin can unlock it.
		</p>
		<dl class="grid grid-cols-2 gap-2 text-sm">
			<dt style="color: var(--color-text-2);">Final total</dt>
			<dd style="font-family: var(--font-mono); color: var(--color-text-1);">
				{total} / {maxTotal}
			</dd>
			<dt style="color: var(--color-text-2);">Sprint time</dt>
			<dd style="font-family: var(--font-mono); color: var(--color-text-1);">
				{dqRaised && sprintSeconds === null ? '— (DQ)' : formattedSprint}
			</dd>
			{#if dqRaised}
				<dt style="color: var(--color-danger);">DQ flag</dt>
				<dd style="color: var(--color-danger);">raised</dd>
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
				{submitting ? 'Submitting…' : 'Submit ›'}
			</button>
		</div>
	</div>
</Modal>

<!-- DQ modal -->
<Modal open={dqModalOpen} title={data.dq ? 'Update DQ flag' : 'Raise DQ flag'} onClose={() => (dqModalOpen = false)}>
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
