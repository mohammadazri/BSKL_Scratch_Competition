<!--
	RadioLevel — performance-level radio group used inside <CriterionCard>.

	Handles either 3 OR 4 levels gracefully (Cat A "Sprite Added Correctly"
	only has Excellent / Proficient / Insufficient — no Developing). Each row
	shows the level name + band (e.g. "Excellent  14–16") and the descriptor
	in small text below. Selected row is visually highlighted.

	Touch targets ≥ 44px (DESIGN.md tablet rule, non-negotiable).
	Progressive enhancement: works as a plain radio group without JS — name
	prop hooks each input into the surrounding <form>.
-->
<script lang="ts">
	import type { PerfLevel } from '$lib/types';
	import type { RubricLevel } from '$lib/scoring';

	interface Props {
		name: string; // form field name (so submit-without-JS works)
		levels: RubricLevel[];
		selected: PerfLevel | null;
		disabled?: boolean;
		onPick?: (level: RubricLevel) => void;
	}

	let { name, levels, selected = $bindable(null), disabled = false, onPick }: Props = $props();

	function pick(opt: RubricLevel) {
		if (disabled) return;
		selected = opt.level;
		onPick?.(opt);
	}
</script>

<div role="radiogroup" aria-label="Performance level" class="flex flex-col gap-2">
	{#each levels as opt (opt.id)}
		{@const checked = selected === opt.level}
		<label
			class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors"
			style="min-height: 44px; background: {checked
				? 'var(--accent-soft)'
				: 'var(--color-bg-1)'}; border-color: {checked
				? 'var(--color-accent)'
				: 'var(--border)'}; opacity: {disabled ? 0.5 : 1};"
		>
			<input
				type="radio"
				{name}
				value={opt.level}
				checked={checked}
				disabled={disabled}
				onchange={() => pick(opt)}
				class="mt-1 h-5 w-5 shrink-0"
				style="accent-color: var(--color-accent);"
			/>
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<div class="flex items-baseline justify-between gap-3">
					<span class="text-sm font-semibold" style="color: var(--color-text-1);">
						{opt.level}
					</span>
					<span
						class="shrink-0 text-xs"
						style="color: var(--color-text-2); font-family: var(--font-mono);"
					>
						{opt.minPts === opt.maxPts ? `${opt.minPts}` : `${opt.minPts}–${opt.maxPts}`}
					</span>
				</div>
				<span class="text-xs leading-snug" style="color: var(--color-text-2);">
					{opt.descriptor}
				</span>
			</div>
		</label>
	{/each}
</div>
