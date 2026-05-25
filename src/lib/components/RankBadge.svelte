<!--
	RankBadge — renders the rank number plus a medal indicator for top 3.
	Per DESIGN.md § 4 C:
	  • 1st → ★ in --color-accent (P3 magenta)
	  • 2nd → ☆ in --color-text-2 (silver-ish)
	  • 3rd → ☆ in a warm brown
	Optional `tied` flag renders a small "ⓘ tied" chip beside the rank.
-->
<script lang="ts">
	import { Info } from '@lucide/svelte';

	interface Props {
		rank: number | null;
		tied?: boolean;
		size?: 'sm' | 'md';
	}

	let { rank, tied = false, size = 'md' }: Props = $props();

	const meta = $derived.by(() => {
		if (rank === 1) return { symbol: '★', color: 'var(--color-accent)' };
		if (rank === 2) return { symbol: '☆', color: 'var(--color-text-2)' };
		if (rank === 3) return { symbol: '☆', color: '#B45309' }; // warm brown
		return null;
	});

	const fontSize = $derived(size === 'sm' ? '13px' : '15px');
</script>

<span class="inline-flex items-center gap-1.5 whitespace-nowrap">
	<span
		class="font-mono font-semibold tabular-nums"
		style="color: var(--color-text-1); font-size: {fontSize};"
	>
		{rank ?? '—'}
	</span>
	{#if meta}
		<span
			class="leading-none"
			aria-hidden="true"
			style="color: {meta.color}; font-size: {fontSize}; line-height: 1;"
		>
			{meta.symbol}
		</span>
		<span class="sr-only">
			{rank === 1 ? '1st place' : rank === 2 ? '2nd place' : '3rd place'}
		</span>
	{/if}
	{#if tied}
		<span
			class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
			style="background: var(--color-bg-3); color: var(--color-text-2);"
			title="Tied — sprint time then submission order break ties."
		>
			<Info size={10} strokeWidth={2} />
			tied
		</span>
	{/if}
</span>
