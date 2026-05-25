<!--
	Input — DESIGN.md § 3 Forms. Label above input, accent dot for required,
	error message below in danger colour.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		label?: string;
		error?: string;
		hint?: string;
		value?: string | number | null;
	}

	let {
		label,
		error,
		hint,
		required,
		id,
		value = $bindable(),
		...rest
	}: Props = $props();

	const autoId = $derived(id ?? `inp-${Math.random().toString(36).slice(2, 9)}`);
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
	<input
		id={autoId}
		bind:value
		{required}
		class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		style="background: var(--color-bg-3); border-color: {error
			? 'var(--color-danger)'
			: 'var(--border)'}; color: var(--color-text-1); min-height: 44px;"
		{...rest}
	/>
	{#if error}
		<p class="mt-1 text-xs" style="color: var(--color-danger);">{error}</p>
	{:else if hint}
		<p class="mt-1 text-xs" style="color: var(--color-text-3);">{hint}</p>
	{/if}
</div>
