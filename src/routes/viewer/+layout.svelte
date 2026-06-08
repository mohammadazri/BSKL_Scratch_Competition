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
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { subscribeTable } from '$lib/realtime';
	import { toasts } from '$lib/stores/toast';
	import { Trophy, ScrollText } from '@lucide/svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/viewer', label: 'Live results', icon: Trophy },
		{ href: '/viewer/audit', label: 'Audit history', icon: ScrollText }
	];

	const phaseLabels: Record<string, string> = {
		setup: 'Setup',
		section_a: 'Section A',
		section_b: 'Section B',
		finalised: 'Finalised'
	};

	onMount(() => {
		const unsub = subscribeTable<{ id: number; phase: string }>('event_state', {
			filter: 'id=eq.1',
			onUpdate: (row, old) => {
				const newPhase = row?.phase;
				const oldPhase = old?.phase;
				if (!newPhase || newPhase === oldPhase) return;
				const label = phaseLabels[newPhase] ?? newPhase;
				toasts.info(`Phase changed to ${label}. View refreshing…`);
				invalidateAll();
			}
		});
		return () => unsub();
	});
</script>

<AppShell {nav} activeHref={page.url.pathname} user={data.profile}>
	{@render children()}
</AppShell>
