<!--
	/viewer layout — wraps every viewer page in <AppShell> so the top bar /
	user menu / sign-out are consistent with /admin and /judge.

	Viewer nav: Live results + Audit history. Read-only role for committee
	people watching the event in real time.
-->
<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { page } from '$app/state';
	import { Trophy, ScrollText } from '@lucide/svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/viewer', label: 'Live results', icon: Trophy },
		{ href: '/viewer/audit', label: 'Audit history', icon: ScrollText }
	];
</script>

<AppShell {nav} activeHref={page.url.pathname} user={data.profile}>
	{@render children()}
</AppShell>
