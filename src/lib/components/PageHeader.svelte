<!--
	PageHeader — DESIGN.md § 3 Page header. Title row + optional subtitle +
	optional actions slot, divider underline.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		breadcrumb?: string;
		actions?: Snippet;
	}

	let { title, subtitle, breadcrumb, actions }: Props = $props();
</script>

<header
	class="mb-6 flex flex-col gap-3 border-b pb-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
	style="border-color: var(--border);"
>
	<div class="min-w-0">
		{#if breadcrumb}
			<p
				class="mb-1 text-[11px] font-medium tracking-wider uppercase"
				style="color: var(--color-text-3);"
			>
				{breadcrumb}
			</p>
		{/if}
		<h1
			class="truncate text-2xl font-semibold sm:text-[28px]"
			style="font-family: var(--font-display); color: var(--color-text-1);"
		>
			{title}
		</h1>
		{#if subtitle}
			<p class="mt-1 text-sm" style="color: var(--color-text-2);">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
