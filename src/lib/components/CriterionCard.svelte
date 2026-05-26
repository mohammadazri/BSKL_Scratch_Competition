<!--
	CriterionCard — fast scoring for one rubric criterion.

	Design philosophy for fast event-day judging:
	  • Recognition over recall — when EXPANDED, ALL four band descriptors
	    are visible so the judge can compare without clicking. No hidden
	    information.
	  • Accordion behaviour — only ONE criterion expanded at a time,
	    the rest collapse to a 50px summary row. So 7 criteria fit in
	    ≈ 500-600px (= one screen) instead of ≈ 2500px of scroll.
	  • Color-coded band cards (green / cyan / amber / red) for instant
	    scanning when reviewing a column of scored cards.
	  • Auto-advances activation to the next unscored card after picking
	    a level — judge keeps their eyes on the screen, fingers on the
	    same area.

	Parent controls activation via `isActive` + `onActivate`. If `isActive`
	is undefined the card falls back to local self-managed open/close so
	the component is still drop-in usable in tests or other contexts.

	Hidden inputs (criterion_id, level__<id>, points__<id>, comment__<id>)
	are always rendered so the form posts cleanly without JS.
-->
<script lang="ts">
	import type { RubricCriterion, RubricLevel } from '$lib/scoring';
	import { midpoint, levelForPoints, clampToLevel } from '$lib/scoring';
	import type { PerfLevel } from '$lib/types';
	import NumberStepper from './NumberStepper.svelte';
	import { Check, MessageSquare } from '@lucide/svelte';

	interface Props {
		criterion: RubricCriterion;
		level: PerfLevel | null;
		points: number | null;
		comment: string | null;
		disabled?: boolean;
		isActive?: boolean;
		onActivate?: (id: string) => void;
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
		isActive,
		onActivate,
		onChange
	}: Props = $props();

	let scored = $derived(level !== null && points !== null);

	// If the parent didn't pass isActive, fall back to local state.
	let localOpen = $state<boolean>(false);
	let expanded = $derived(isActive ?? localOpen ?? !scored);

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

	function toggleOpen() {
		if (disabled) return;
		if (onActivate) onActivate(criterion.id);
		else localOpen = !localOpen;
	}

	// Green = best, red = worst — maps to the universal traffic-light mental
	// model so judges can read a column of scored cards in one glance.
	function levelColor(lvl: PerfLevel): string {
		if (lvl === 'Excellent') return '#10b981';
		if (lvl === 'Proficient') return '#0891b2';
		if (lvl === 'Developing') return '#d97706';
		return '#dc2626';
	}
</script>

<section
	class="overflow-hidden rounded-lg border transition-colors"
	style="background: var(--color-bg-2); border-color: {scored && selectedLevel
		? levelColor(selectedLevel.level) + '55'
		: 'var(--border)'};"
	data-criterion-id={criterion.id}
>
	<!-- Header — clickable to expand/collapse. Always visible. -->
	<header
		class="flex w-full items-center gap-3 px-4 py-2.5 text-left"
		style="border-bottom: {expanded ? '1px solid var(--border)' : 'none'};"
	>
		<button
			type="button"
			onclick={toggleOpen}
			disabled={disabled}
			class="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
			aria-expanded={expanded}
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
			<span class="ml-1 text-xs" style="color: var(--color-text-3);">
				{expanded ? '▴' : '▾'}
			</span>
		</button>
	</header>

	{#if expanded}
		<div class="flex flex-col gap-3 px-4 py-3">
			<!-- All four band cards visible at once. Each card shows the
			     descriptor in full so the judge has the guidance they need to
			     pick correctly — no hidden information, no second tap. -->
			<div
				role="radiogroup"
				aria-label="Performance level"
				class="grid gap-2 sm:grid-cols-2 lg:grid-cols-{criterion.levels.length}"
			>
				{#each criterion.levels as opt (opt.id)}
					{@const isSelected = level === opt.level}
					{@const c = levelColor(opt.level)}
					<button
						type="button"
						onclick={() => pickLevel(opt)}
						{disabled}
						aria-pressed={isSelected}
						class="flex h-full flex-col gap-1.5 rounded-md border p-3 text-left transition-colors disabled:opacity-50"
						style="background: {isSelected
							? c + '12'
							: 'var(--color-bg-1)'}; border-color: {isSelected ? c : 'var(--border)'};"
					>
						<div class="flex items-baseline justify-between gap-2">
							<span
								class="text-sm font-semibold"
								style="color: {isSelected ? c : 'var(--color-text-1)'};"
							>
								{opt.level}
							</span>
							<span
								class="shrink-0 text-[11px] font-medium tabular-nums"
								style="color: var(--color-text-3); font-family: var(--font-mono);"
							>
								{opt.minPts === opt.maxPts ? opt.minPts : `${opt.minPts}–${opt.maxPts}`}
							</span>
						</div>
						<p
							class="text-[11px] leading-snug sm:text-xs"
							style="color: var(--color-text-2);"
						>
							{opt.descriptor}
						</p>
					</button>
				{/each}
			</div>

			<!-- Points stepper + note toggle on one compact row -->
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-[11px] tracking-wider uppercase" style="color: var(--color-text-2);">
					Points
				</span>
				<NumberStepper
					name={`points__${criterion.id}`}
					bind:value={points}
					min={selectedLevel?.minPts ?? 0}
					max={selectedLevel?.maxPts ?? criterion.maxPoints}
					disabled={disabled || !selectedLevel}
					onValue={onPointsChange}
				/>
				{#if selectedLevel}
					<span
						class="text-[11px]"
						style="color: var(--color-text-3); font-family: var(--font-mono);"
					>
						band {selectedLevel.minPts === selectedLevel.maxPts
							? selectedLevel.minPts
							: `${selectedLevel.minPts}–${selectedLevel.maxPts}`}
					</span>
				{:else}
					<span class="text-[11px]" style="color: var(--color-text-3);">
						Tap a level above first.
					</span>
				{/if}
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
		<!-- Collapsed: hidden inputs only. The header stays clickable. -->
		<input type="hidden" name={`level__${criterion.id}`} value={level ?? ''} />
		<input type="hidden" name={`points__${criterion.id}`} value={points ?? ''} />
		<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
	{/if}

	<input type="hidden" name="criterion_id" value={criterion.id} />
</section>
