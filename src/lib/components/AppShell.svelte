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
	<!-- Top bar: BrandHeader carries the P3 logo + title on the left and the
	     BSKL logo + user menu on the right. We pass the user menu / hamburger
	     into the `right` snippet so they share the same flex row as the BSKL
	     logo — no more absolute-positioned overlay sitting on top of the logo. -->
	<BrandHeader>
		{#snippet right()}
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
					<span class="hidden flex-col text-left leading-tight md:flex">
						<span class="max-w-[10rem] truncate text-xs font-semibold">{user.fullName}</span>
						<span
							class="max-w-[10rem] truncate text-[10px]"
							style="color: var(--color-text-3);"
						>
							{user.email}
						</span>
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
		{/snippet}
	</BrandHeader>

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
				class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r md:hidden"
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
				<!-- Sign out is also reachable from the top-right user menu, but on
				     mobile the avatar dropdown can be easy to miss. Mirror it here
				     so it's always one tap away from the drawer. -->
				<div class="mt-auto border-t p-2" style="border-color: var(--border);">
					<form method="POST" action="/logout" use:enhance>
						<button
							type="submit"
							class="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition hover:bg-white/5"
							style="color: var(--color-text-2);"
						>
							<LogOut size={18} strokeWidth={1.5} />
							Sign out
						</button>
					</form>
				</div>
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
