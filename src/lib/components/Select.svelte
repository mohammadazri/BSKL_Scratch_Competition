<!-- Select — same skin as Input. -->
<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface Props extends Omit<HTMLSelectAttributes, 'class' | 'children'> {
		label?: string;
		error?: string;
		hint?: string;
		value?: string | number | null;
		children?: Snippet;
	}

	let {
		label,
		error,
		hint,
		required,
		id,
		value = $bindable(),
		children,
		...rest
	}: Props = $props();

	const autoId = $derived(id ?? `sel-${Math.random().toString(36).slice(2, 9)}`);
</script>

<div class="block w-full">
	{#if label}
		<label
			for={autoId}
			class="mb-1 block text-xs font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			{label}
			{#if required}
				<span style="color: var(--color-accent);">•</span>
			{/if}
		</label>
	{/if}
	<select
		id={autoId}
		bind:value
		{required}
		class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		style="background: var(--color-bg-3); border-color: {error
			? 'var(--color-danger)'
			: 'var(--border)'}; color: var(--color-text-1); min-height: 44px;"
		{...rest}
	>
		{#if children}{@render children()}{/if}
	</select>
	{#if error}
		<p class="mt-1 text-xs" style="color: var(--color-danger);">{error}</p>
	{:else if hint}
		<p class="mt-1 text-xs" style="color: var(--color-text-3);">{hint}</p>
	{/if}
</div>
