<!--
	Button — DESIGN.md § 5. Variants: primary | secondary | ghost | danger.
	Uses tokens; minimum 44px height (DESIGN.md § 2 spacing rule for touch targets).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		variant?: Variant;
		size?: Size;
		loading?: boolean;
		icon?: Snippet;
		iconRight?: Snippet;
		href?: string;
		children?: Snippet;
		fullWidth?: boolean;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		icon,
		iconRight,
		href,
		disabled = false,
		fullWidth = false,
		type = 'button',
		children,
		...rest
	}: Props = $props();

	const styleFor = (v: Variant) => {
		switch (v) {
			case 'primary':
				return 'background: var(--color-accent); color: white; border: 1px solid var(--color-accent);';
			case 'secondary':
				return 'background: var(--color-bg-3); color: var(--color-text-1); border: 1px solid var(--border-strong);';
			case 'ghost':
				return 'background: transparent; color: var(--color-text-1); border: 1px solid transparent;';
			case 'danger':
				return 'background: var(--color-danger); color: white; border: 1px solid var(--color-danger);';
		}
	};

	const sizeClass = $derived(
		size === 'sm'
			? 'px-3 py-1.5 text-xs min-h-9'
			: size === 'lg'
				? 'px-5 py-3 text-sm min-h-12'
				: 'px-4 py-2.5 text-sm min-h-11'
	);
</script>

{#if href}
	<a
		{href}
		class="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition hover:opacity-90 disabled:opacity-50 {sizeClass} {fullWidth
			? 'w-full'
			: ''}"
		style={styleFor(variant)}
	>
		{#if icon}{@render icon()}{/if}
		{#if children}{@render children()}{/if}
		{#if iconRight}{@render iconRight()}{/if}
	</a>
{:else}
	<button
		{type}
		disabled={disabled || loading}
		class="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 {sizeClass} {fullWidth
			? 'w-full'
			: ''}"
		style={styleFor(variant)}
		{...rest}
	>
		{#if loading}
			<svg
				class="h-4 w-4 animate-spin"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
			</svg>
		{:else if icon}
			{@render icon()}
		{/if}
		{#if children}{@render children()}{/if}
		{#if iconRight}{@render iconRight()}{/if}
	</button>
{/if}
