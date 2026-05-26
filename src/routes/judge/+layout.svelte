<!--
	/judge layout — wraps every judge page in <AppShell> so the top bar /
	user menu / sign-out are consistent with /admin and /viewer.

	Judges have a short nav (My queue + Audit history) because their world
	is intentionally narrow.
-->
<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { page } from '$app/state';
	import { ListChecks, ScrollText } from '@lucide/svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/judge', label: 'My queue', icon: ListChecks },
		{ href: '/judge/audit', label: 'Audit history', icon: ScrollText }
	];
</script>

<AppShell {nav} activeHref={page.url.pathname} user={data.profile}>
	{@render children()}
</AppShell>
