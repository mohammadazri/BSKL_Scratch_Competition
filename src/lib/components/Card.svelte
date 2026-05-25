<!--
	Card — DESIGN.md § 3 Cards. Section label uppercase 12px in text-2.
	bg-2 surface, border, radius, 24px padding (16px on mobile).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		action?: Snippet;
		children?: Snippet;
		padding?: 'none' | 'sm' | 'md' | 'lg';
	}

	let { label, action, children, padding = 'md' }: Props = $props();

	const padClass = $derived(
		padding === 'none'
			? ''
			: padding === 'sm'
				? 'p-3'
				: padding === 'lg'
					? 'p-6 sm:p-8'
					: 'p-4 sm:p-6'
	);
</script>

<section
	class="rounded-[var(--radius)] border"
	style="background: var(--color-bg-2); border-color: var(--border);"
>
	{#if label || action}
		<header
			class="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
			style="border-color: var(--border);"
		>
			{#if label}
				<h3
					class="text-[11px] font-medium tracking-[0.08em] uppercase"
					style="color: var(--color-text-2);"
				>
					{label}
				</h3>
			{/if}
			{#if action}
				<div class="flex items-center gap-2">{@render action()}</div>
			{/if}
		</header>
	{/if}
	<div class={padClass}>
		{#if children}{@render children()}{/if}
	</div>
</section>
