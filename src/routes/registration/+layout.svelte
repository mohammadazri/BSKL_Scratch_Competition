<!--
	/registration layout — minimal AppShell with a 2-item sidebar (Schools,
	Participants) for the registration committee. Phase 2 will plug the full
	pages in; for now the nav links go to the existing /admin/* equivalents
	which super_admin can use. Registration-committee users see a placeholder
	on the dashboard until those pages get their own /registration mirrors.
-->
<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { page } from '$app/state';
	import { LayoutDashboard, School, UserSquare2 } from '@lucide/svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/registration', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/registration/schools', label: 'Schools', icon: School },
		{ href: '/registration/participants', label: 'Participants', icon: UserSquare2 }
	];
</script>

<AppShell {nav} activeHref={page.url.pathname} user={data.profile}>
	{@render children()}
</AppShell>
