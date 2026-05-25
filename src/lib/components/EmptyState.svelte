<!--
	EmptyState — icon + title + description + optional action (DESIGN.md § 5).
-->
<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { Inbox } from '@lucide/svelte';

	interface Props {
		icon?: Component;
		title: string;
		description?: string;
		action?: Snippet;
	}

	let { icon = Inbox, title, description, action }: Props = $props();
	const Icon = $derived(icon);
</script>

<div
	class="flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed px-6 py-12 text-center"
	style="border-color: var(--border-strong); background: var(--color-bg-1);"
>
	<div
		class="grid h-12 w-12 place-items-center rounded-full"
		style="background: var(--color-bg-3); color: var(--color-text-2);"
	>
		<Icon size={20} strokeWidth={1.5} />
	</div>
	<div>
		<p class="text-sm font-semibold" style="color: var(--color-text-1);">{title}</p>
		{#if description}
			<p class="mt-1 max-w-md text-xs" style="color: var(--color-text-2);">{description}</p>
		{/if}
	</div>
	{#if action}
		<div class="mt-1">{@render action()}</div>
	{/if}
</div>
