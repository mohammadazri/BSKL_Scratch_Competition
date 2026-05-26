<!--
	LiveTotalCard — the right-column live total + progress for the scoring form.
	Big mono number for the total, horizontal bar for points-vs-max, second
	bar for criteria-scored progress.

	(We used to JS-animate the number count-up but it was racey when props
	updated mid-tween — keeping the value pure $derived avoids the bug at
	the cost of an instant number flip, which is fine for a judging UI.)
-->
<script lang="ts">
	interface Props {
		total: number;
		maxTotal: number;
		scoredCount: number;
		totalCriteria: number;
	}

	let { total, maxTotal, scoredCount, totalCriteria }: Props = $props();

	let pct = $derived(maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0);
	let progressPct = $derived(
		totalCriteria > 0 ? Math.round((scoredCount / totalCriteria) * 100) : 0
	);
</script>

<div
	class="rounded-lg border p-4"
	style="background: var(--color-bg-2); border-color: var(--border);"
>
	<p
		class="mb-1 text-xs font-medium tracking-[0.15em] uppercase"
		style="color: var(--color-text-2);"
	>
		Live total
	</p>
	<div class="flex items-baseline gap-2">
		<span
			class="text-4xl font-semibold tabular-nums sm:text-5xl"
			style="font-family: var(--font-mono); color: var(--color-text-1);"
		>
			{total}
		</span>
		<span
			class="text-base"
			style="color: var(--color-text-2); font-family: var(--font-mono);"
		>
			/ {maxTotal}
		</span>
	</div>

	<!-- Score progress -->
	<div
		class="mt-3 h-2 w-full overflow-hidden rounded-full"
		style="background: var(--color-bg-3);"
		aria-label="Score progress"
	>
		<div
			style="width: {pct}%; height: 100%; background: var(--color-accent); transition: width 200ms ease-out;"
		></div>
	</div>
	<p class="mt-1 text-xs" style="color: var(--color-text-2);">{pct}%</p>

	<!-- Criteria completion -->
	<p
		class="mt-4 mb-1 text-xs font-medium tracking-[0.15em] uppercase"
		style="color: var(--color-text-2);"
	>
		Progress
	</p>
	<div
		class="h-2 w-full overflow-hidden rounded-full"
		style="background: var(--color-bg-3);"
		aria-label="Criteria scored"
	>
		<div
			style="width: {progressPct}%; height: 100%; background: var(--color-accent-2); transition: width 200ms ease-out;"
		></div>
	</div>
	<p
		class="mt-1 text-xs"
		style="color: var(--color-text-2); font-family: var(--font-mono);"
	>
		{scoredCount} of {totalCriteria}
	</p>
</div>
