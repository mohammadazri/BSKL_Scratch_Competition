<!--
	Admin AppShell — DESIGN.md § 3 global shell.
	Brand bar at top, sidebar nav left, page content right.
	Sidebar shows the admin sections; active item highlighted.
-->
<script lang="ts">
	import { page } from '$app/state';
	import BrandHeader from '$lib/components/BrandHeader.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import RolePill from '$lib/components/RolePill.svelte';
	import {
		LayoutDashboard,
		Users,
		School,
		GraduationCap,
		Workflow,
		Calendar,
		LogOut
	} from 'lucide-svelte';

	let { children, data } = $props();

	const navItems = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/users', label: 'Users', icon: Users },
		{ href: '/admin/schools', label: 'Schools', icon: School },
		{ href: '/admin/participants', label: 'Participants', icon: GraduationCap },
		{ href: '/admin/assignments', label: 'Assignments', icon: Workflow },
		{ href: '/admin/event', label: 'Event', icon: Calendar }
	];

	let userMenuOpen = $state(false);
</script>

<div class="flex h-screen flex-col" style="background: var(--color-bg-0);">
	<BrandHeader>
		{#snippet right()}
			<div class="relative ml-2 flex items-center gap-3">
				<button
					type="button"
					class="flex items-center gap-2 rounded-(--radius-sm) px-2 py-1 transition hover:bg-white/5"
					onclick={() => (userMenuOpen = !userMenuOpen)}
					aria-haspopup="menu"
					aria-expanded={userMenuOpen}
				>
					<UserAvatar name={data.session.fullName} size={28} />
					<div class="hidden text-left sm:block">
						<p class="text-xs font-medium leading-tight" style="color: var(--color-text-1);">
							{data.session.fullName}
						</p>
						<div class="mt-0.5">
							<RolePill role={data.session.role} />
						</div>
					</div>
				</button>

				{#if userMenuOpen}
					<div
						class="absolute top-full right-0 z-30 mt-2 w-56 rounded-(--radius) border p-1 shadow-xl"
						style="background: var(--color-bg-2); border-color: var(--border-strong);"
						role="menu"
					>
						<div
							class="border-b px-3 py-2 text-xs"
							style="border-color: var(--border); color: var(--color-text-2);"
						>
							{data.session.email}
						</div>
						<form method="POST" action="/logout" class="m-0">
							<button
								type="submit"
								class="flex w-full items-center gap-2 rounded-(--radius-sm) px-3 py-2 text-left text-sm transition hover:bg-white/5"
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

	<div class="flex flex-1 overflow-hidden">
		<Sidebar items={navItems} activeHref={page.url.pathname} />
		<main class="min-w-0 flex-1 overflow-y-auto">
			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
				{@render children()}
			</div>
		</main>
	</div>
</div>
