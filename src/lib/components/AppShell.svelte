<!--
	AppShell — DESIGN.md § 3 global shell. Top bar (BrandHeader) + Sidebar + main content.
	Mobile (<768px): sidebar becomes a bottom drawer triggered by hamburger.
-->
<script lang="ts">
	import type { Snippet, Component } from 'svelte';
	import BrandHeader from './BrandHeader.svelte';
	import Sidebar from './Sidebar.svelte';
	import UserAvatar from './UserAvatar.svelte';
	import RolePill from './RolePill.svelte';
	import Toast from './Toast.svelte';
	import { Menu, LogOut, ChevronDown } from '@lucide/svelte';
	import type { Role } from '$lib/types';
	import { enhance } from '$app/forms';

	export interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

	interface Props {
		nav: NavItem[];
		activeHref: string;
		user: { fullName: string; email: string; role: Role };
		children?: Snippet;
	}

	let { nav, activeHref, user, children }: Props = $props();

	let menuOpen = $state(false);
	let drawerOpen = $state(false);
</script>

<div class="flex min-h-screen flex-col" style="background: var(--color-bg-0);">
	<!-- Top bar -->
	<div class="relative">
		<BrandHeader />
		<div class="absolute inset-y-0 right-4 flex items-center gap-2 md:right-6">
			<button
				type="button"
				class="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] md:hidden"
				style="color: var(--color-text-2);"
				onclick={() => (drawerOpen = !drawerOpen)}
				aria-label="Toggle menu"
			>
				<Menu size={18} strokeWidth={1.5} />
			</button>
			<div class="relative">
				<button
					type="button"
					class="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm transition hover:bg-white/5"
					style="color: var(--color-text-1);"
					onclick={() => (menuOpen = !menuOpen)}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
				>
					<UserAvatar name={user.fullName} size={28} />
					<span class="hidden flex-col text-left leading-tight sm:flex">
						<span class="text-xs font-semibold">{user.fullName}</span>
						<span class="text-[10px]" style="color: var(--color-text-3);">{user.email}</span>
					</span>
					<ChevronDown size={14} strokeWidth={1.5} />
				</button>
				{#if menuOpen}
					<div
						class="absolute top-full right-0 z-30 mt-2 w-56 rounded-[var(--radius)] border shadow-lg"
						style="background: var(--color-bg-2); border-color: var(--border-strong);"
						role="menu"
					>
						<div class="border-b px-3 py-3" style="border-color: var(--border);">
							<p class="text-sm font-semibold" style="color: var(--color-text-1);">
								{user.fullName}
							</p>
							<p class="mt-0.5 text-xs" style="color: var(--color-text-3);">{user.email}</p>
							<div class="mt-2"><RolePill role={user.role} /></div>
						</div>
						<form method="POST" action="/logout" use:enhance>
							<button
								type="submit"
								class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-white/5"
								style="color: var(--color-text-1);"
							>
								<LogOut size={16} strokeWidth={1.5} />
								Sign out
							</button>
						</form>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex flex-1 min-h-0">
		<Sidebar items={nav} {activeHref} />

		<!-- Mobile drawer -->
		{#if drawerOpen}
			<div
				class="fixed inset-0 z-40 bg-black/60 md:hidden"
				role="presentation"
				onclick={() => (drawerOpen = false)}
				aria-hidden="true"
			></div>
			<aside
				class="fixed inset-y-0 left-0 z-50 w-64 border-r md:hidden"
				style="background: var(--color-bg-1); border-color: var(--border);"
			>
				<div class="flex h-14 items-center px-4">
					<span
						class="text-sm font-semibold"
						style="font-family: var(--font-display); color: var(--color-text-1);"
					>
						Menu
					</span>
				</div>
				<ul class="flex flex-col gap-0.5 p-2">
					{#each nav as item (item.href)}
						{@const Icon = item.icon}
						{@const active =
							activeHref === item.href || activeHref.startsWith(item.href + '/')}
						<li>
							<a
								href={item.href}
								onclick={() => (drawerOpen = false)}
								class="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium"
								style="color: {active
									? 'var(--color-text-1)'
									: 'var(--color-text-2)'}; background: {active
									? 'var(--accent-soft)'
									: 'transparent'};"
							>
								<Icon size={18} strokeWidth={1.5} />
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</aside>
		{/if}

		<main class="flex-1 overflow-x-hidden">
			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
				{#if children}{@render children()}{/if}
			</div>
		</main>
	</div>
</div>

<Toast />
