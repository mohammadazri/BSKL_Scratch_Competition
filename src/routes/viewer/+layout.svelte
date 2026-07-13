<!--
	/viewer layout — wraps every viewer page in <AppShell> so the top bar /
	user menu / sign-out are consistent with /admin and /judge.

	Viewer nav: Live results + Audit history. Read-only role for committee
	people watching the event in real time.

	Phase realtime: when admin transitions phase the leaderboard / countdown
	state changes, so we invalidateAll() to refresh whatever view they're on.
-->
<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { page } from '$app/state';
	import { LayoutDashboard, Trophy, ScrollText } from '@lucide/svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/viewer', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/viewer/results', label: 'Leaderboard', icon: Trophy },
		{ href: '/viewer/audit', label: 'Audit history', icon: ScrollText }
	];
</script>

<AppShell {nav} activeHref={page.url.pathname} user={data.profile} event={data.event}>
	{@render children()}
</AppShell>
