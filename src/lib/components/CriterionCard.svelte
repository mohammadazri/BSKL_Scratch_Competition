<!--
	CriterionCard — fast scoring for one rubric criterion.

	DUAL MODE:
	  • Checkpoint mode (preferred). Renders when `criterion.checkpoints` is
	    a non-empty array. Each checkpoint is a binary tap-target. Points and
	    performance level are *derived* from the ticks — the judge never picks
	    a level or types a number. This removes the two anxieties of the
	    legacy UI ("which band?" and "which number inside the band?").
	  • Legacy level mode. Renders when the criterion still has 4 bands.
	    Kept so the migration to checkpoints can happen one category at a
	    time without breaking the rest of the rubric.

	UX/PSYCHOLOGY PRINCIPLES (checkpoint mode):
	  • Recognition over recall — every item the judge needs to verify is on
	    screen at the same time; no hidden information, no second tap to read.
	  • Goal gradient — the progress bar grows as ticks accumulate, pushing
	    the judge to consider the few items remaining (loss-avoidance flips
	    into pursuit-of-completion).
	  • Loss-aversion reframe — un-ticked items use a neutral "not yet" style,
	    NOT a red "failed" style. The judge sees room to award points, not
	    a wall of red.
	  • Immediate feedback — tick produces an instant colour shift + score
	    increment. Reinforces the decision and reduces second-guessing.
	  • Single primary action per row — one tap. No nested level/number
	    decision. No textbox. Just yes/no.
	  • Large tap targets — every row is ≥48px tall so it works on tablet
	    without mis-taps.
	  • Colour-coded by progress — the card edge gently glows green at ≥80%,
	    matching the underlying derived level. Visible feedback that the
	    project is "complete" in the judge's mental model.

	Parent controls activation via `isActive` + `onActivate`. If `isActive`
	is undefined the card falls back to local self-managed open/close so the
	component is still drop-in usable in tests.

	Hidden inputs (criterion_id, level__<id>, points__<id>, comment__<id>,
	checkpoints__<id>) are always rendered so the form posts cleanly without
	JS. The server is canonical — it re-derives level/points from the ticks
	regardless of what was submitted.
-->
<script lang="ts">
	import type { RubricCriterion, RubricCheckpoint, RubricLevel } from '$lib/scoring';
	import {
		deriveLevelFromPoints,
		levelForPoints,
		midpoint,
		pointsFromCheckpoints,
		clampToLevel
	} from '$lib/scoring';
	import type { PerfLevel } from '$lib/types';
	import NumberStepper from './NumberStepper.svelte';
	import { Check, MessageSquare, Sparkles } from '@lucide/svelte';

	interface Props {
		criterion: RubricCriterion;
		level: PerfLevel | null;
		points: number | null;
		comment: string | null;
		checkpointIds?: string[];
		disabled?: boolean;
		isActive?: boolean;
		onActivate?: (id: string) => void;
		onChange?: (next: {
			level: PerfLevel | null;
			points: number | null;
			comment: string | null;
			checkpointIds: string[];
		}) => void;
	}

	let {
		criterion,
		level = $bindable(null),
		points = $bindable(null),
		comment = $bindable(null),
		checkpointIds = $bindable<string[]>([]),
		disabled = false,
		isActive,
		onActivate,
		onChange
	}: Props = $props();

	// ── Mode detection ────────────────────────────────────────────────────────
	let useCheckpoints = $derived(
		Array.isArray(criterion.checkpoints) && criterion.checkpoints.length > 0
	);

	// ── Local state ───────────────────────────────────────────────────────────
	let ticked = $derived(new Set(checkpointIds));
	let scored = $derived(
		useCheckpoints ? checkpointIds.length > 0 : level !== null && points !== null
	);

	// Self-managed open/close fallback if the parent doesn't drive `isActive`.
	let localOpen = $state<boolean>(false);
	let expanded = $derived(isActive ?? localOpen ?? !scored);

	let commentOpen = $state(false);
	$effect(() => {
		if (comment && comment.length > 0) commentOpen = true;
	});

	let selectedLevel: RubricLevel | null = $derived(
		level ? (criterion.levels.find((l) => l.level === level) ?? null) : null
	);

	// ── Derived stats (checkpoint mode) ───────────────────────────────────────
	let derivedPoints = $derived(
		useCheckpoints && criterion.checkpoints
			? pointsFromCheckpoints(criterion.checkpoints, ticked)
			: (points ?? 0)
	);
	let pctComplete = $derived(
		criterion.maxPoints > 0 ? derivedPoints / criterion.maxPoints : 0
	);
	let derivedLevel = $derived(
		useCheckpoints ? deriveLevelFromPoints(derivedPoints, criterion.maxPoints) : level
	);
	let displayLevel: PerfLevel | null = $derived(
		useCheckpoints ? (checkpointIds.length > 0 ? derivedLevel : null) : level
	);

	// ── Colour palette per level ─────────────────────────────────────────────
	// Traffic-light progression — green = best, red = worst. Keeps the
	// reading-a-column-of-cards glance from earlier iterations.
	function levelColor(lvl: PerfLevel | null): string {
		if (lvl === 'Excellent') return '#10b981';
		if (lvl === 'Proficient') return '#0891b2';
		if (lvl === 'Developing') return '#d97706';
		if (lvl === 'Insufficient') return '#dc2626';
		return 'var(--color-text-3)';
	}
	let progressColor = $derived(levelColor(displayLevel));
	let isCelebrating = $derived(useCheckpoints && pctComplete >= 0.8);

	// ── Handlers ──────────────────────────────────────────────────────────────
	function emit(nextIds: string[] = checkpointIds) {
		if (useCheckpoints && criterion.checkpoints) {
			const newPoints = pointsFromCheckpoints(
				criterion.checkpoints,
				new Set(nextIds)
			);
			const newLevel: PerfLevel = deriveLevelFromPoints(newPoints, criterion.maxPoints);
			level = newLevel;
			points = newPoints;
			onChange?.({ level: newLevel, points: newPoints, comment, checkpointIds: nextIds });
		} else {
			onChange?.({ level, points, comment, checkpointIds: nextIds });
		}
	}

	function toggleCheckpoint(cp: RubricCheckpoint) {
		if (disabled) return;
		const next = new Set(checkpointIds);
		if (next.has(cp.id)) next.delete(cp.id);
		else next.add(cp.id);
		const arr = Array.from(next);
		checkpointIds = arr;
		emit(arr);
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

	// Level label, used in the header pill and the celebration banner.
	function levelLabel(lvl: PerfLevel | null): string {
		if (lvl === 'Excellent') return 'Excellent';
		if (lvl === 'Proficient') return 'Proficient';
		if (lvl === 'Developing') return 'Developing';
		if (lvl === 'Insufficient') return 'Insufficient';
		return 'Not yet scored';
	}
</script>

<section
	class="overflow-hidden rounded-xl border transition-all duration-200"
	class:ring-2={isCelebrating}
	class:ring-emerald-500={isCelebrating}
	class:ring-opacity-30={isCelebrating}
	style="background: var(--color-bg-2); border-color: {scored
		? progressColor + '55'
		: 'var(--border)'};"
	data-criterion-id={criterion.id}
>
	<!-- ── Header — always visible, click to expand ─────────────────────────── -->
	<header
		class="flex w-full items-center gap-3 px-4 py-3 text-left"
		style="border-bottom: {expanded ? '1px solid var(--border)' : 'none'};"
	>
		<button
			type="button"
			onclick={toggleOpen}
			{disabled}
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
				{#if useCheckpoints && !expanded}
					<!-- Inline progress bar in the collapsed header -->
					<div class="mt-1.5 flex items-center gap-2">
						<div
							class="h-1.5 flex-1 overflow-hidden rounded-full"
							style="background: var(--color-bg-3);"
						>
							<div
								class="h-full transition-all duration-300"
								style="width: {Math.round(pctComplete * 100)}%; background: {progressColor};"
							></div>
						</div>
						<span
							class="shrink-0 text-[11px] tabular-nums"
							style="color: var(--color-text-3); font-family: var(--font-mono);"
						>
							{checkpointIds.length}/{criterion.checkpoints?.length ?? 0}
						</span>
					</div>
				{/if}
			</div>
			{#if scored && displayLevel}
				<div class="flex items-center gap-2 text-xs">
					<span
						class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
						style="background: {progressColor}22; color: {progressColor};"
					>
						<Check size={12} strokeWidth={2.5} />
						{levelLabel(displayLevel)}
					</span>
					<span
						class="text-sm font-semibold tabular-nums"
						style="color: var(--color-text-1); font-family: var(--font-mono);"
					>
						{derivedPoints} / {criterion.maxPoints}
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
			{#if useCheckpoints && criterion.checkpoints}
				<!-- ═══════════════════════════════════════════════════════════
				     CHECKPOINT MODE — Binary checklist
				     ═══════════════════════════════════════════════════════════ -->
				<p
					class="text-[11px] tracking-wider uppercase"
					style="color: var(--color-text-2);"
				>
					Tick everything you see in the project
				</p>

				<ul class="flex flex-col gap-1.5" role="group" aria-label="Checkpoints">
					{#each criterion.checkpoints as cp (cp.id)}
						{@const isOn = ticked.has(cp.id)}
						<li>
							<button
								type="button"
								onclick={() => toggleCheckpoint(cp)}
								{disabled}
								aria-pressed={isOn}
								class="group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 disabled:opacity-50"
								style="
									min-height: 48px;
									background: {isOn ? progressColor + '12' : 'var(--color-bg-1)'};
									border-color: {isOn ? progressColor + '88' : 'var(--border)'};
								"
							>
								<!-- Checkbox affordance -->
								<span
									class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150"
									style="
										background: {isOn ? progressColor : 'transparent'};
										border-color: {isOn ? progressColor : 'var(--border-strong)'};
									"
									aria-hidden="true"
								>
									{#if isOn}
										<Check size={14} strokeWidth={3} color="white" />
									{/if}
								</span>
								<!-- Label + auxiliary -->
								<span
									class="flex-1 text-sm leading-snug"
									style="
										color: {isOn ? 'var(--color-text-1)' : 'var(--color-text-2)'};
										font-weight: {isOn ? 600 : 400};
									"
								>
									{cp.label}
								</span>
								<!-- Points pill -->
								<span
									class="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
									style="
										background: {isOn ? progressColor + '22' : 'var(--color-bg-3)'};
										color: {isOn ? progressColor : 'var(--color-text-3)'};
										font-family: var(--font-mono);
									"
								>
									+{cp.points}
								</span>
							</button>
						</li>
					{/each}
				</ul>

				<!-- Progress strip — full-width, animated -->
				<div class="mt-1 flex flex-col gap-1.5">
					<div class="flex items-baseline justify-between gap-2">
						<span
							class="text-[11px] tracking-wider uppercase"
							style="color: var(--color-text-2);"
						>
							Progress
						</span>
						<span
							class="text-sm font-semibold tabular-nums"
							style="color: var(--color-text-1); font-family: var(--font-mono);"
						>
							{derivedPoints} <span style="color: var(--color-text-3);">/ {criterion.maxPoints}</span>
							<span
								class="ml-1 text-[11px] font-normal"
								style="color: {progressColor};"
							>
								· {levelLabel(displayLevel)}
							</span>
						</span>
					</div>
					<div
						class="h-2 overflow-hidden rounded-full"
						style="background: var(--color-bg-3);"
					>
						<div
							class="h-full transition-all duration-300 ease-out"
							style="width: {Math.round(pctComplete * 100)}%; background: linear-gradient(90deg, {progressColor}, {progressColor}dd);"
						></div>
					</div>
				</div>

				{#if isCelebrating}
					<div
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
						style="background: {progressColor}10; color: {progressColor};"
					>
						<Sparkles size={14} strokeWidth={2} />
						<span style="font-weight: 600;">Excellent territory.</span>
						<span style="color: var(--color-text-2);">
							If anything else stands out, drop a note below.
						</span>
					</div>
				{/if}
			{:else}
				<!-- ═══════════════════════════════════════════════════════════
				     LEGACY LEVEL MODE — Four band cards (unchanged)
				     ═══════════════════════════════════════════════════════════ -->
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
							style="background: {isSelected ? c + '12' : 'var(--color-bg-1)'}; border-color: {isSelected ? c : 'var(--border)'};"
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

				<!-- Stepper + note toggle row, legacy only -->
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
				</div>
			{/if}

			<!-- ── Comment toggle row (shared between modes) ───────────────── -->
			<div class="flex items-center justify-between">
				<button
					type="button"
					onclick={() => (commentOpen = !commentOpen)}
					{disabled}
					class="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-white/5"
					style="color: var(--color-text-2);"
					aria-pressed={commentOpen}
				>
					<MessageSquare size={14} strokeWidth={1.5} />
					{comment && comment.length > 0 ? 'Edit note' : 'Add note (optional)'}
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
					placeholder="Optional context for the head judge (e.g. 'animation was perfect on sprite 1, missing on sprite 2')."
					class="w-full rounded-md border p-2 text-sm outline-none"
					style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
				></textarea>
			{:else}
				<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
			{/if}

			<!-- Hidden inputs that mirror the canonical state for the no-JS form post. -->
			<input type="hidden" name={`level__${criterion.id}`} value={level ?? ''} />
			{#if useCheckpoints}
				<!-- Checkpoint mode also writes points + checkpoint state. Server
				     re-derives both for safety, but these keep the no-JS form
				     submission consistent with what the judge saw. -->
				<input type="hidden" name={`points__${criterion.id}`} value={points ?? ''} />
				<input
					type="hidden"
					name={`checkpoints__${criterion.id}`}
					value={JSON.stringify(checkpointIds)}
				/>
			{/if}
		</div>
	{:else}
		<!-- Collapsed: hidden inputs only. -->
		<input type="hidden" name={`level__${criterion.id}`} value={level ?? ''} />
		<input type="hidden" name={`points__${criterion.id}`} value={points ?? ''} />
		<input type="hidden" name={`comment__${criterion.id}`} value={comment ?? ''} />
		{#if useCheckpoints}
			<input
				type="hidden"
				name={`checkpoints__${criterion.id}`}
				value={JSON.stringify(checkpointIds)}
			/>
		{/if}
	{/if}

	<input type="hidden" name="criterion_id" value={criterion.id} />
</section>
