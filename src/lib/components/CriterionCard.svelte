<!--
	CriterionCard — fast scoring for one rubric criterion.

	Redesigned for the event-day judge psychology:
	  • Recognition over recall — all four bands visible at all times as
	    horizontal pills, no clicking to reveal descriptors.
	  • Reduced cognitive load — descriptor of the SELECTED band shows
	    inline beneath the pills, others are summarised by their range only.
	  • Compact: ~80-160px tall (vs 350-450px in the old vertical radio
	    list), so 7 criteria fit on a single screen with minimal scrolling.
	  • Auto-collapses to a one-line summary after scoring, expand to edit.

	Hidden inputs keep no-JS submit working: criterion_id, level__<id>,
	points__<id>, comment__<id>.
-->
<script lang="ts">
	import type { RubricCriterion, RubricLevel } from '$lib/scoring';
	import { midpoint, levelForPoints, clampToLevel } from '$lib/scoring';
	import type { PerfLevel } from '$lib/types';
	import NumberStepper from './NumberStepper.svelte';
	import { Check, MessageSquare, Pencil } from '@lucide/svelte';

	interface Props {
		criterion: RubricCriterion;
		level: PerfLevel | null;
		points: number | null;
		comment: string | null;
		disabled?: boolean;
		onChange?: (next: {
			level: PerfLevel | null;
			points: number | null;
			comment: string | null;
		}) => void;
	}

	let {
		criterion,
		level = $bindable(null),
		points = $bindable(null),
		comment = $bindable(null),
		disabled = false,
		onChange
	}: Props = $props();

	let scored = $derived(level !== null && points !== null);

	// Default: unscored = expanded, scored = collapsed.
	let manualOpen = $state<boolean | null>(null);
	let expanded = $derived(manualOpen ?? !scored);

	let commentOpen = $state(false);
	$effect(() => {
		if (comment && comment.length > 0) commentOpen = true;
	});

	let selectedLevel: RubricLevel | null = $derived(
		level ? (criterion.levels.find((l) => l.level === level) ?? null) : null
	);

	function emit() {
		onChange?.({ level, points, comment });
	}

	function pickLevel(opt: RubricLevel) {
		if (disabled) return;
		level = opt.level;
		points = midpoint(opt);
		emit();
	}

	function onPointsChange(v: number) {
		if (selectedLevel && (v < selectedLevel.minPts || v > selectedLevel.maxPts)) {
			const next = levelForPoints(v, criterion.levels);
			if (next) {
				level = next.level;
				points = clampToLevel(v, next);
			} else if (selectedLevel) {
				points = clampToLevel(v, selectedLevel);
			}
		} else {
			points = v;
		}
		emit();
	}

	function onCommentInput(e: Event) {
		comment = (e.currentTarget as HTMLTextAreaElement).value;
		emit();
	}

	// Visual accent per level so judges can scan a long list quickly:
	// green = best, red = worst, intuitive at a glance.
	function levelColor(lvl: PerfLevel): string {
		if (lvl === 'Excellent') return '#10b981';
		if (lvl === 'Proficient') return '#0891b2';
		if (lvl === 'Developing') return '#d97706';
		return '#dc2626';
	}
</script>

<section
	class="overflow-hidden rounded-lg border"
	style="background: var(--color-bg-2); border-color: {scored && selectedLevel
		? levelColor(selectedLevel.level) + '55'
		: 'var(--border)'};"
	data-criterion-id={criterion.id}
>
	<!-- Header (always visible) — name + score chip + edit/collapse button -->
	<header
		class="flex items-center gap-3 px-4 py-2.5"
		style="border-bottom: {expanded ? '1px solid var(--border)' : 'none'};"
	>
		<div class="min-w-0 flex-1">
			<h3
				class="truncate text-sm font-semibold sm:text-base"
				style="color: var(--color-text-1);"
			>
				{criterion.name}
			</h3>
		</div>
		{#if scored && selectedLevel}
			<div class="flex items-center gap-2 text-xs">
				<span
					class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
					style="background: {levelColor(selectedLevel.level)}22; color: {levelColor(
						selectedLevel.level
					)};"
				>
					<Check size={12} strokeWidth={2.5} />
					{selectedLevel.level}
				</span>
				<span
					class="text-sm font-semibold tabular-nums"
					style="color: var(--color-text-1); font-family: var(--font-mono);"
				>
					{points} / {criterion.maxPoints}
				</span>
			</div>
		{:else}
			<span
				class="rounded-full px-2 py-0.5 text-[11px] font-medium"
				style="background: var(--color-bg-3); color: var(--color-text-3); font-family: var(--font-mono);"
			>
				/ {criterion.maxPoints}
			</span>
		{/if}
		{#if !disabled}
			<button
				type="button"
				onclick={() => (manualOpen = !expanded)}
				aria-expanded={expanded}
				aria-label={expanded ? 'Collapse' : 'Edit'}
				class="grid h-9 w-9 place-items-center rounded-md hover:bg-white/5"
				style="color: var(--color-text-2);"
			>
				{#if expanded}
					<span class="text-xs">▴</span>
				{:else}
					<Pencil size={14} strokeWidth={1.5} />
				{/if}
			</button>
		{/if}
	</header>

	{#if expanded}
		<div class="flex flex-col gap-3 px-4 py-3">
			<!-- 4 horizontal pills — single row, recognition over recall.
			     Each pill carries the band range so the judge sees the full
			     rubric without clicking. -->
			<div
				role="radiogroup"
				aria-label="Performance level"
				class="grid gap-1.5 sm:gap-2"
				style="grid-template-columns: repeat({criterion.levels.length}, minmax(0, 1fr));"
			>
				{#each criterion.levels as opt (opt.id)}
					{@const isSelected = level === opt.level}
					{@const c = levelColor(opt.level)}
					<button
						type="button"
						onclick={() => pickLevel(opt)}
						{disabled}
						aria-pressed={isSelected}
						class="flex h-auto min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-2 transition-colors disabled:opacity-50"
						style="background: {isSelected ? c + '22' : 'var(--color-bg-1)'}; border-color: {isSelected
							? c
							: 'var(--border)'};"
					>
						<span
							class="text-[11px] font-semibold sm:text-xs"
							style="color: {isSelected ? c : 'var(--color-text-1)'};"
						>
							{opt.level}
						</span>
						<span
							class="text-[10px] tabular-nums"
							style="color: var(--color-text-3); font-family: var(--font-mono);"
						>
							{opt.minPts === opt.maxPts ? opt.minPts : `${opt.minPts}–${opt.maxPts}`}
						</span>
					</button>
				{/each}
			</div>

			<!-- Inline descriptor of the SELECTED band only — judges focus on
			     the one band they're choosing, not all four at once. -->
			{#if selectedLevel}
				<p
					class="rounded-md border-l-2 px-3 py-2 text-xs leading-snug"
					style="border-color: {levelColor(selectedLevel.level)}; background: var(--color-bg-1); color: var(--color-text-2);"
				>
					{selectedLevel.descriptor}
				</p>
			{:else}
				<p class="text-xs" style="color: var(--color-text-3);">
					Tap a level to score this criterion.
				</p>
			{/if}

			<!-- Points stepper + note toggle on a single compact row. -->
			<div class="flex flex-wrap items-center gap-3">
				<NumberStepper
					name={`points__${criterion.id}`}
					bind:value={points}
					min={selectedLevel?.minPts ?? 0}
					max={selectedLevel?.maxPts ?? criterion.maxPoints}
					disabled={disabled || !selectedLevel}
					onValue={onPointsChange}
				/>
				<button
					type="button"
					onclick={() => (commentOpen = !commentOpen)}
					{disabled}
					class="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-white/5"
					style="color: var(--color-text-2);"
					aria-pressed={commentOpen}
				>
					<MessageSquare size={14} strokeWidth={1.5} />
					{comment && comment.length > 0 ? 'Edit note' : 'Add note'}
				</button>
			</div>

			{#if commentOpen}
				<textarea
					name={`comment__${criterion.id}`}
					rows="2"
					maxlength="500"
					value={comment ?? ''}
					oninput={onCommentInput}
					{disabled}
					placeholder="Short note for this criterion (admin can see)."
					class="w-full rounded-md border p-2 text-sm outline-none"
					style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
				></textarea>
			{:else}
				<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
			{/if}

			<input type="hidden" name={`level__${criterion.id}`} value={level ?? ''} />
		</div>
	{:else}
		<!-- Collapsed — preserve all hidden inputs so the form still submits. -->
		<input type="hidden" name={`level__${criterion.id}`} value={level ?? ''} />
		<input type="hidden" name={`points__${criterion.id}`} value={points ?? ''} />
		<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
	{/if}

	<input type="hidden" name="criterion_id" value={criterion.id} />
</section>
