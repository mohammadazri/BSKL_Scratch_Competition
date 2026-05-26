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

	// Audible chime for high-priority notifications. AudioContext requires a
	// user gesture to unlock in some browsers — wrap in try/catch so it
	// silently no-ops if blocked.
	function chime() {
		try {
			const Ctx =
				(window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
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
			// Audio context blocked. Toast still shows.
		}
	}

	// Priority toasts for new edit-access AND disqualification requests so
	// the admin doesn't have to keep refreshing /admin/requests. Subscribed
	// at the layout level so the alerts work from any admin page.
	onMount(() => {
		if (data.profile.role !== 'super_admin') return;

		const editUnsub = subscribeTable<{ id: string; reason: string; scoresheet_id: string }>(
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
					chime();
					if (page.url.pathname === '/admin/requests') invalidateAll();
				},
				onUpdate: () => {
					if (page.url.pathname === '/admin/requests') invalidateAll();
				}
			}
		);

		const dqUnsub = subscribeTable<{ id: string; reason: string; scoresheet_id: string }>(
			'disqualifications',
			{
				filter: 'status=eq.pending',
				onInsert: () => {
					toasts.warning(
						'A judge has requested a disqualification. Approve or reject.',
						'Disqualification request',
						{
							actionLabel: 'Review now',
							onAction: () => goto('/admin/requests')
						}
					);
					chime();
					if (page.url.pathname === '/admin/requests') invalidateAll();
				},
				onUpdate: () => {
					if (page.url.pathname === '/admin/requests') invalidateAll();
				}
			}
		);

		return () => {
			editUnsub();
			dqUnsub();
		};
	});

	const navByRole = $derived.by(() => {
		if (data.profile.role === 'super_admin') {
			return [
				{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
				{ href: '/admin/users', label: 'Users', icon: Users },
				{ href: '/admin/schools', label: 'Schools', icon: School },
				{ href: '/admin/participants', label: 'Participants', icon: UserSquare2 },
				{ href: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
				{ href: '/admin/requests', label: 'Approvals', icon: Inbox },
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
