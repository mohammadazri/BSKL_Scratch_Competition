<!--
	CriterionCard — wraps the RadioLevel + NumberStepper + optional comment
	textarea for a single rubric criterion.

	Three behaviours from TRACK_3_SCORING.md:
	  1. Picking a level auto-fills points to the middle of the band.
	  2. Manually typing a points value outside the current band re-selects
	     the level whose band contains it (if any).
	  3. Once scored, the card collapses to a one-line summary; click to expand.

	The card carries hidden inputs (criterion_id, level, points, comment) so
	the surrounding form submits cleanly without JS.
-->
<script lang="ts">
	import type { RubricCriterion, RubricLevel } from '$lib/scoring';
	import { midpoint, levelForPoints, clampToLevel } from '$lib/scoring';
	import type { PerfLevel } from '$lib/types';
	import RadioLevel from './RadioLevel.svelte';
	import NumberStepper from './NumberStepper.svelte';

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

	let collapsed = $state(false);
	let commentOpen = $state(false);
	// Open the comment editor by default if a comment already exists.
	$effect(() => {
		if (comment && comment.length > 0) commentOpen = true;
	});

	let selectedLevel: RubricLevel | null = $derived(
		level ? (criterion.levels.find((l) => l.level === level) ?? null) : null
	);

	function emit() {
		onChange?.({ level, points, comment });
	}

	function onLevelPick(opt: RubricLevel) {
		// Auto-fill the middle of the band.
		const mid = midpoint(opt);
		points = mid;
		emit();
	}

	function onPointsChange(v: number) {
		// If the value moved outside the current level's band, jump to the
		// level that contains it (per spec).
		if (selectedLevel && (v < selectedLevel.minPts || v > selectedLevel.maxPts)) {
			const next = levelForPoints(v, criterion.levels);
			if (next) {
				level = next.level;
				// Clamp into the new level's band as a safety net (DB trigger requires).
				points = clampToLevel(v, next);
			} else {
				// Shouldn't happen with contiguous bands; keep the old level + clamp.
				points = clampToLevel(v, selectedLevel);
			}
		} else {
			points = v;
		}
		emit();
	}

	function onCommentInput(e: Event) {
		const el = e.currentTarget as HTMLTextAreaElement;
		comment = el.value;
		emit();
	}

	function toggleCollapsed() {
		if (level === null || points === null) {
			collapsed = false;
			return;
		}
		collapsed = !collapsed;
	}

	let scored = $derived(level !== null && points !== null);
</script>

<section
	class="rounded-lg border"
	style="background: var(--color-bg-2); border-color: {scored
		? 'var(--border-strong)'
		: 'var(--border)'};"
	data-criterion-id={criterion.id}
>
	<!-- Header / summary row -->
	<header
		class="flex items-center justify-between gap-3 p-4"
		style={collapsed ? '' : 'border-bottom: 1px solid var(--border);'}
	>
		<div class="min-w-0">
			<h3 class="text-base font-medium" style="color: var(--color-text-1);">
				{criterion.name}
				<span class="ml-2 text-xs" style="color: var(--color-text-2); font-family: var(--font-mono);">
					/ {criterion.maxPoints}
				</span>
			</h3>
			{#if collapsed && scored}
				<p class="mt-0.5 text-xs" style="color: var(--color-text-2);">
					{level} · <span style="font-family: var(--font-mono); color: var(--color-text-1);">
						{points} / {criterion.maxPoints}
					</span>
				</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if scored}
				<span
					class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
					style="background: var(--accent-soft); color: var(--color-accent);"
				>
					scored
				</span>
			{/if}
			{#if scored && !disabled}
				<button
					type="button"
					onclick={toggleCollapsed}
					aria-expanded={!collapsed}
					aria-label={collapsed ? 'Expand criterion' : 'Collapse criterion'}
					class="inline-flex items-center justify-center rounded-md text-xs underline"
					style="min-height: 44px; min-width: 44px; color: var(--color-text-2);"
				>
					{collapsed ? 'edit' : 'collapse'}
				</button>
			{/if}
		</div>
	</header>

	{#if !collapsed}
		<div class="flex flex-col gap-4 p-4 pt-2">
			<RadioLevel
				name={`level__${criterion.id}`}
				levels={criterion.levels}
				bind:selected={level}
				{disabled}
				onPick={onLevelPick}
			/>

			<div class="flex flex-wrap items-center gap-3">
				<span
					class="text-xs font-medium tracking-wide uppercase"
					style="color: var(--color-text-2);"
				>
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
						class="text-xs"
						style="color: var(--color-text-3); font-family: var(--font-mono);"
					>
						band {selectedLevel.minPts === selectedLevel.maxPts
							? selectedLevel.minPts
							: `${selectedLevel.minPts}–${selectedLevel.maxPts}`}
					</span>
				{:else}
					<span class="text-xs" style="color: var(--color-text-3);">
						Pick a level first.
					</span>
				{/if}
			</div>

			<div>
				<button
					type="button"
					onclick={() => (commentOpen = !commentOpen)}
					class="text-xs underline"
					style="color: var(--color-text-2);"
					disabled={disabled}
				>
					{comment && comment.length > 0 ? 'Edit note' : 'Add note (optional)'}
				</button>
				{#if commentOpen}
					<textarea
						name={`comment__${criterion.id}`}
						rows="2"
						maxlength="500"
						value={comment ?? ''}
						oninput={onCommentInput}
						{disabled}
						placeholder="Short note for this criterion (visible to super admin)."
						class="mt-2 w-full rounded-md border p-2 text-sm outline-none"
						style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
					></textarea>
				{:else}
					<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
				{/if}
			</div>
		</div>
	{:else}
		<!-- Hidden inputs preserve the value when the section is collapsed. -->
		<input type="hidden" name={`level__${criterion.id}`} value={level ?? ''} />
		<input type="hidden" name={`points__${criterion.id}`} value={points ?? ''} />
		<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
	{/if}

	<!-- Always emit the criterion id so the server knows this slot exists. -->
	<input type="hidden" name="criterion_id" value={criterion.id} />
</section>
