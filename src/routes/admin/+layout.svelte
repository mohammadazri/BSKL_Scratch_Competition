<!--
	(app) group layout — wraps every authenticated page in <AppShell>.
	The nav set is derived per role so judges/viewers see their own items
	when their pages later move under (app) too.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import AppShell from '$lib/components/AppShell.svelte';
	import { subscribeTable } from '$lib/realtime';
	import { toasts } from '$lib/stores/toast';
	import {
		LayoutDashboard,
		Users,
		School,
		UserSquare2,
		ClipboardList,
		Settings2,
		ListChecks,
		ScrollText,
		Trophy,
		Inbox
	} from '@lucide/svelte';

	let { data, children } = $props();

	// Priority toast for new edit-access requests. The admin gets pinged the
	// moment a judge files one — they don't have to keep refreshing
	// /admin/requests. Subscribed at the layout so the alert works from any
	// admin page (Dashboard, Users, Results, etc).
	onMount(() => {
		if (data.profile.role !== 'super_admin') return;
		return subscribeTable<{ id: string; reason: string; scoresheet_id: string }>(
			'edit_requests',
			{
				filter: 'status=eq.pending',
				onInsert: () => {
					toasts.warning(
						'New edit-access request. Open the queue to review.',
						'Judge needs your attention',
						{
							actionLabel: 'Review now',
							onAction: () => goto('/admin/requests')
						}
					);
					// Trigger an audible beep so the admin notices when they aren't
					// looking at the screen. AudioContext is the most reliable way
					// across browsers without an asset file.
					try {
						const Ctx =
							(window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
								.AudioContext ??
							(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
						const ctx = new Ctx();
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.frequency.value = 880;
						osc.type = 'triangle';
						gain.gain.value = 0.08;
						osc.connect(gain).connect(ctx.destination);
						osc.start();
						osc.stop(ctx.currentTime + 0.18);
					} catch {
						// AudioContext blocked (e.g. no user gesture yet) — silent fail.
					}
					// Refresh /admin/requests if the admin is on it so the new row
					// shows up without a manual refresh.
					if (page.url.pathname === '/admin/requests') invalidateAll();
				},
				onUpdate: () => {
					// Other admins resolving requests in parallel — keep the page
					// in sync regardless of who acted.
					if (page.url.pathname === '/admin/requests') invalidateAll();
				}
			}
		);
	});

	const navByRole = $derived.by(() => {
		if (data.profile.role === 'super_admin') {
			return [
				{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
				{ href: '/admin/users', label: 'Users', icon: Users },
				{ href: '/admin/schools', label: 'Schools', icon: School },
				{ href: '/admin/participants', label: 'Participants', icon: UserSquare2 },
				{ href: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
				{ href: '/admin/requests', label: 'Edit requests', icon: Inbox },
				{ href: '/admin/results', label: 'Results', icon: Trophy },
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
