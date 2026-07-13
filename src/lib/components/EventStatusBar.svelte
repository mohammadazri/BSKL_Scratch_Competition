<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Clock3, LockKeyhole } from '@lucide/svelte';
	import { subscribeTable } from '$lib/realtime';
	import {
		EVENT_CATEGORIES,
		deriveCategoryEventStatus,
		formatEventDuration,
		mapEventStateRow,
		type EventSnapshot,
		type EventStateDbRow
	} from '$lib/event-status';

	interface Props {
		event: EventSnapshot;
	}

	let { event }: Props = $props();
	let liveEvent = $derived(event);
	let now = $state<number>(Number.NaN);

	const statuses = $derived({
		A: deriveCategoryEventStatus(liveEvent, 'A', now),
		B: deriveCategoryEventStatus(liveEvent, 'B', now),
		C: deriveCategoryEventStatus(liveEvent, 'C', now)
	});

	function toneColor(tone: (typeof statuses)['A']['tone']): string {
		if (tone === 'danger') return 'var(--color-danger)';
		if (tone === 'warning') return 'var(--color-warning)';
		if (tone === 'success') return 'var(--color-success)';
		if (tone === 'info') return 'var(--color-accent-2)';
		return 'var(--color-text-3)';
	}

	onMount(() => {
		now = Date.now();
		const ticker = window.setInterval(() => (now = Date.now()), 1000);
		let refreshTimer: ReturnType<typeof setTimeout> | null = null;
		const unsubscribe = subscribeTable<EventStateDbRow>('event_state', {
			filter: 'id=eq.1',
			onUpdate: (row) => {
				liveEvent = mapEventStateRow(row);
				if (refreshTimer) clearTimeout(refreshTimer);
				refreshTimer = setTimeout(() => invalidateAll(), 150);
			}
		});

		return () => {
			window.clearInterval(ticker);
			if (refreshTimer) clearTimeout(refreshTimer);
			unsubscribe();
		};
	});
</script>

<section
	class="border-y"
	style="background: color-mix(in srgb, var(--color-bg-1) 92%, var(--color-accent-2)); border-color: var(--border);"
	aria-label="Live event timing and category status"
>
	<div class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:px-6 lg:flex-row lg:items-center">
		<div
			class="flex shrink-0 items-center justify-between gap-3 lg:w-44 lg:flex-col lg:items-start"
		>
			<div class="flex items-center gap-2">
				<Clock3 size={15} strokeWidth={1.8} color="var(--color-accent-2)" />
				<span
					class="text-[11px] font-semibold tracking-wider uppercase"
					style="color: var(--color-text-2);"
				>
					Live event
				</span>
			</div>
			{#if liveEvent.locked}
				<span
					class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
					style="background: rgba(239, 68, 68, 0.12); color: var(--color-danger);"
				>
					<LockKeyhole size={11} strokeWidth={2} /> Locked
				</span>
			{/if}
		</div>

		<div class="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
			{#each EVENT_CATEGORIES as category (category)}
				{@const status = statuses[category]}
				{@const color = toneColor(status.tone)}
				<div
					class="flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3 py-2"
					style="background: var(--color-bg-2); border-color: {color}55;"
				>
					<div class="flex min-w-0 items-center gap-2">
						<span
							class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold"
							style="background: {color}18; color: {color}; font-family: var(--font-mono);"
						>
							{category}
						</span>
						<div class="min-w-0">
							<p class="truncate text-xs font-semibold" style="color: var(--color-text-1);">
								{status.title}
							</p>
							{#if status.timerLabel}
								<p class="truncate text-[10px]" style="color: var(--color-text-3);">
									{status.timerLabel}
								</p>
							{/if}
						</div>
					</div>
					{#if status.remainingMs !== null}
						<span
							class="shrink-0 text-sm font-semibold tabular-nums"
							style="color: {color}; font-family: var(--font-mono);"
						>
							{formatEventDuration(status.remainingMs)}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>
