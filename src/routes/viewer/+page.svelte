<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import { subscribeTable } from '$lib/realtime';
	import { EVENT_CATEGORIES } from '$lib/event-status';
	import { Activity, Medal, ScrollText, Sparkles, Trophy } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function percent(value: number, total: number): number {
		return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
	}

	function formatSprintTime(total: number | null): string {
		if (total === null) return '—';
		return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}

	onMount(() => {
		let refreshTimer: ReturnType<typeof setTimeout> | null = null;
		const refresh = () => {
			if (refreshTimer) clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => invalidateAll(), 250);
		};
		const unsubscribeSheets = subscribeTable('scoresheets', {
			onInsert: refresh,
			onUpdate: refresh
		});
		const unsubscribeScores = subscribeTable('scores', {
			onInsert: refresh,
			onUpdate: refresh
		});
		return () => {
			if (refreshTimer) clearTimeout(refreshTimer);
			unsubscribeSheets();
			unsubscribeScores();
		};
	});
</script>

<svelte:head>
	<title>Live observer dashboard · P3 Judging</title>
</svelte:head>

<PageHeader
	title="Live observer dashboard"
	subtitle="A calm, read-only pulse of judging progress and provisional category leaders."
>
	{#snippet actions()}
		<Button variant="primary" href="/viewer/results">
			{#snippet icon()}<Trophy size={16} strokeWidth={1.7} />{/snippet}
			Full leaderboard
		</Button>
	{/snippet}
</PageHeader>

{#if data.loadError}
	<div
		class="mb-4 rounded-xl border p-4 text-sm"
		style="border-color: var(--color-danger); color: var(--color-danger);"
	>
		Leaderboard data is temporarily unavailable: {data.loadError}
	</div>
{/if}

<div class="mb-5 grid gap-3 sm:grid-cols-3">
	<div
		class="rounded-xl border p-4"
		style="background: var(--color-bg-2); border-color: var(--border);"
	>
		<div class="flex items-center gap-2 text-xs" style="color: var(--color-text-2);">
			<Activity size={15} strokeWidth={1.7} color="var(--color-accent-2)" /> Event participation
		</div>
		<p
			class="mt-2 text-2xl font-bold"
			style="font-family: var(--font-mono); color: var(--color-text-1);"
		>
			{data.overall.qualified}
		</p>
		<p class="text-[10px]" style="color: var(--color-text-3);">qualified participants</p>
	</div>
	<div
		class="rounded-xl border p-4"
		style="background: var(--color-bg-2); border-color: var(--border);"
	>
		<div class="flex items-center gap-2 text-xs" style="color: var(--color-text-2);">
			<Sparkles size={15} strokeWidth={1.7} color="var(--color-accent)" /> Judging units complete
		</div>
		<p
			class="mt-2 text-2xl font-bold"
			style="font-family: var(--font-mono); color: var(--color-text-1);"
		>
			{data.overall.completedSections}/{data.overall.qualified * 2}
		</p>
		<p class="text-[10px]" style="color: var(--color-text-3);">Section A + Section B submissions</p>
	</div>
	<div
		class="rounded-xl border p-4"
		style="background: var(--color-bg-2); border-color: var(--border);"
	>
		<div class="flex items-center gap-2 text-xs" style="color: var(--color-text-2);">
			<ScrollText size={15} strokeWidth={1.7} color="var(--color-warning)" /> Transparency
		</div>
		<p class="mt-2 text-sm font-semibold" style="color: var(--color-text-1);">
			Read-only by design
		</p>
		<a
			href="/viewer/audit"
			class="mt-1 inline-block text-xs underline"
			style="color: var(--color-accent-2);"
		>
			Open audit history
		</a>
	</div>
</div>

<div class="grid gap-4 xl:grid-cols-3">
	{#each EVENT_CATEGORIES as category (category)}
		{@const overview = data.categories[category]}
		{@const phase = data.event?.phases[category] ?? 'setup'}
		{@const finalised = phase === 'finalised'}
		<Card label="Category {category} · {finalised ? 'Final standings' : 'Provisional'}">
			<div class="mb-4 grid grid-cols-2 gap-3">
				{#each [{ section: 'A', value: overview.submittedA }, { section: 'B', value: overview.submittedB }] as progress (progress.section)}
					<div
						class="rounded-lg border p-3"
						style="background: var(--color-bg-1); border-color: var(--border);"
					>
						<div
							class="flex justify-between text-[10px] font-semibold uppercase"
							style="color: var(--color-text-3);"
						>
							<span>Section {progress.section}</span>
							<span>{progress.value}/{overview.qualified}</span>
						</div>
						<div
							class="mt-2 h-1.5 overflow-hidden rounded-full"
							style="background: var(--color-bg-3);"
						>
							<div
								class="h-full rounded-full"
								style="width: {percent(
									progress.value,
									overview.qualified
								)}%; background: var(--color-accent-2);"
							></div>
						</div>
					</div>
				{/each}
			</div>

			{#if overview.leaders.length > 0}
				<ol class="space-y-2">
					{#each overview.leaders as leader, index (leader.participantId)}
						<li
							class="flex items-center gap-3 rounded-lg border p-3"
							style="background: var(--color-bg-1); border-color: var(--border);"
						>
							<span
								class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold"
								style="background: {index === 0
									? 'rgba(245, 158, 11, 0.18)'
									: 'var(--color-bg-3)'}; color: {index === 0
									? 'var(--color-warning)'
									: 'var(--color-text-2)'};"
							>
								{leader.rank ?? index + 1}
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-semibold" style="color: var(--color-text-1);">
									{leader.participantName}
								</p>
								<p class="truncate text-[10px]" style="color: var(--color-text-3);">
									{leader.schoolName}
								</p>
							</div>
							<div class="text-right">
								<p
									class="text-sm font-semibold"
									style="font-family: var(--font-mono); color: var(--color-text-1);"
								>
									{leader.totalPoints}
								</p>
								<p
									class="text-[10px]"
									style="font-family: var(--font-mono); color: var(--color-text-3);"
								>
									{formatSprintTime(leader.liveSprintTimeSeconds)}
								</p>
							</div>
						</li>
					{/each}
				</ol>
			{:else}
				<div
					class="rounded-lg border border-dashed p-6 text-center"
					style="border-color: var(--border-strong);"
				>
					<Medal class="mx-auto mb-2" size={24} strokeWidth={1.4} color="var(--color-text-3)" />
					<p class="text-sm font-semibold" style="color: var(--color-text-1);">
						The podium is waiting
					</p>
					<p class="mt-1 text-xs" style="color: var(--color-text-3);">
						The first submitted scoresheet will bring this card to life.
					</p>
				</div>
			{/if}
		</Card>
	{/each}
</div>

<div
	class="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px]"
	style="color: var(--color-text-3);"
>
	<span>Standings remain provisional until each category is finalised.</span>
	<span>Updated {new Date(data.refreshedAt).toLocaleTimeString()}</span>
</div>
