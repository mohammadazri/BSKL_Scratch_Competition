<!--
	CategoryChip — small A/B/C colour-coded chip (DESIGN.md).
-->
<script lang="ts">
	import type { Category } from '$lib/types';

	interface Props {
		category: Category;
		size?: 'sm' | 'md';
	}

	let { category, size = 'sm' }: Props = $props();

	const config = $derived(
		category === 'A'
			? { bg: 'var(--accent-soft)', fg: 'var(--color-accent)' }
			: category === 'B'
				? { bg: 'rgba(56, 189, 248, 0.14)', fg: 'var(--color-accent-2)' }
				: { bg: 'rgba(245, 158, 11, 0.14)', fg: 'var(--color-warning)' }
	);

	const sizeClass = $derived(
		size === 'md' ? 'h-6 w-6 text-xs' : 'h-5 w-5 text-[11px]'
	);
</script>

<span
	class="inline-flex items-center justify-center rounded-[var(--radius-sm)] font-mono font-semibold {sizeClass}"
	style="background: {config.bg}; color: {config.fg};"
	title="Category {category}"
>
	{category}
</span>
