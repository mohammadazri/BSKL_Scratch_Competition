<!--
	LiveTotalCard — the right-column live total + progress for the scoring form.

	Big mono number for the total, a horizontal progress bar showing total
	points as a fraction of `maxTotal`, then a separate "scored N of M
	criteria" progress for completion.

	Animates the count-up over ~200ms when the total changes (DESIGN.md § 2.6).
	Respects prefers-reduced-motion via the global rule in app.css that wipes
	out long transitions; we additionally skip the JS interpolation when it's
	set.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		total: number;
		maxTotal: number;
		scoredCount: number;
		totalCriteria: number;
	}

	let { total, maxTotal, scoredCount, totalCriteria }: Props = $props();

	let display = $state(0);
	let mounted = $state(false);
	let prefersReducedMotion = $state(false);

	onMount(() => {
		mounted = true;
		display = total;
		if (typeof window !== 'undefined') {
			prefersReducedMotion = window.matchMedia(
				'(prefers-reduced-motion: reduce)'
			).matches;
		}
	});

	// Tween display → total whenever total changes (skip on initial mount).
	let lastTarget = $state(0);
	$effect(() => {
		const target = total;
		if (!mounted) {
			display = target;
			lastTarget = target;
			return;
		}
		if (target === lastTarget) return;
		lastTarget = target;
		if (prefersReducedMotion) {
			display = target;
			return;
		}
		const start = display;
		const delta = target - start;
		const duration = 200;
		const t0 = performance.now();
		let raf = 0;
		const step = (t: number) => {
			const p = Math.min(1, (t - t0) / duration);
			display = Math.round(start + delta * p);
			if (p < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

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
			{display}
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
