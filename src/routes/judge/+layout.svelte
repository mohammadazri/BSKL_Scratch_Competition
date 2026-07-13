<!--
	/judge layout — wraps every judge page in <AppShell> so the top bar /
	user menu / sign-out are consistent with /admin and /viewer.

	Judges have a short nav (My queue + Audit history) because their world
	is intentionally narrow.

	Phase realtime: subscribes to event_state row 1. The instant the admin
	advances the phase (section_a → section_b → finalised) we invalidateAll()
	so the queue reloads with the judge's NEW section assignments (Section B
	often goes to a different judge for fairness). A toast surfaces the change
	so the judge knows their world just shifted without having to refresh.
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

<AppShell {nav} activeHref={page.url.pathname} user={data.profile} event={data.event}>
	{#key page.url.pathname}
		{@render children()}
	{/key}
</AppShell>
