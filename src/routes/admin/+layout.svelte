<!--
	(app) group layout — wraps every authenticated page in <AppShell>.
	The nav set is derived per role so judges/viewers see their own items
	when their pages later move under (app) too.
-->
<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { page } from '$app/state';
	import {
		LayoutDashboard,
		Users,
		School,
		UserSquare2,
		ClipboardList,
		Settings2,
		ListChecks,
		ScrollText,
		Trophy
	} from '@lucide/svelte';

	let { data, children } = $props();

	const navByRole = $derived.by(() => {
		if (data.profile.role === 'super_admin') {
			return [
				{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
				{ href: '/admin/users', label: 'Users', icon: Users },
				{ href: '/admin/schools', label: 'Schools', icon: School },
				{ href: '/admin/participants', label: 'Participants', icon: UserSquare2 },
				{ href: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
				{ href: '/admin/event', label: 'Event', icon: Settings2 }
			];
		}
		if (data.profile.role === 'judge') {
			return [{ href: '/judge', label: 'My queue', icon: ListChecks }];
		}
		return [
			{ href: '/viewer', label: 'Live view', icon: Trophy },
			{ href: '/viewer/audit', label: 'Audit', icon: ScrollText }
		];
	});
</script>

<AppShell nav={navByRole} activeHref={page.url.pathname} user={data.profile}>
	{@render children()}
</AppShell>
