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
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { subscribeTable } from '$lib/realtime';
	import { toasts } from '$lib/stores/toast';
	import { ListChecks, ScrollText } from '@lucide/svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/judge', label: 'My queue', icon: ListChecks },
		{ href: '/judge/audit', label: 'Audit history', icon: ScrollText }
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
				if (newPhase === 'section_b') {
					toasts.warning(
						'Section A is closed. Your queue has been re-assigned for Section B (different judge per participant for fairness). Refreshing now…',
						`${label} opened`
					);
				} else if (newPhase === 'finalised') {
					toasts.info(
						'Scoring is now finalised. All scoresheets are read-only.',
						'Event finalised'
					);
				} else {
					toasts.info(`Phase changed to ${label}. Queue refreshing…`);
				}
				invalidateAll();
			}
		});
		return () => unsub();
	});
</script>

<AppShell {nav} activeHref={page.url.pathname} user={data.profile}>
	{@render children()}
</AppShell>
