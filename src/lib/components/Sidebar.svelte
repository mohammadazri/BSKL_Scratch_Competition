<!--
	Sidebar — DESIGN.md § 3 global shell. 240px desktop, icon-only collapsible.
	Active item has a 2px accent left bar + accent-soft background.
-->
<script lang="ts">
	import type { Component } from 'svelte';

	export interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

	interface Props {
		items: NavItem[];
		activeHref?: string;
		collapsed?: boolean;
	}

	let { items, activeHref = '', collapsed = false }: Props = $props();
</script>

<nav
	class="hidden border-r md:flex md:flex-col"
	style="background: var(--color-bg-1); border-color: var(--border); width: {collapsed
		? '56px'
		: '240px'};"
	aria-label="Primary"
>
	<ul class="flex flex-col gap-0.5 p-2">
		{#each items as item (item.href)}
			{@const Icon = item.icon}
			{@const active = activeHref === item.href || activeHref.startsWith(item.href + '/')}
			<li>
				<a
					href={item.href}
					class="relative flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition"
					style="color: {active
						? 'var(--color-text-1)'
						: 'var(--color-text-2)'}; background: {active ? 'var(--accent-soft)' : 'transparent'};"
					aria-current={active ? 'page' : undefined}
				>
					{#if active}
						<span
							class="absolute top-1 bottom-1 left-0 w-[2px] rounded-full"
							style="background: var(--color-accent);"
						></span>
					{/if}
					<Icon size={18} strokeWidth={1.5} />
					{#if !collapsed}
						<span class="truncate">{item.label}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
