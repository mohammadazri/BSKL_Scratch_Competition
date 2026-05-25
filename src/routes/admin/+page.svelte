<!--
	/admin — super-admin dashboard.
	Three cards: Event Progress, Judge Load, Recent Activity (realtime).
	Action row at the bottom: auto-assign, lock event, export, audit log.
-->
<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import { Sparkles, Lock, FileDown, History, CalendarClock } from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { ActivityRow } from './+page.server';

	let { data }: { data: PageData } = $props();

	// `activity` is initialised from the server payload but mutated locally as
	// realtime INSERTs arrive; `untrack` silences `state_referenced_locally`.
	// The $effect below handles resync if the user navigates back here.
	let activity = $state(untrack(() => data.activity));
	let liveConnected = $state(false);
	let channel: ReturnType<typeof window.fetch> | null = null;
	let unsub: (() => void) | null = null;

	$effect(() => {
		activity = data.activity;
	});

	function actionLabel(a: string): string {
		return a.replace(/_/g, ' ');
	}

	function fmtTime(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function daysToEvent(date: string | null): string | null {
		if (!date) return null;
		const target = new Date(date);
		const now = new Date();
		const diffMs = target.getTime() - now.getTime();
		const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
		if (days < 0) return `${-days}d after event`;
		if (days === 0) return 'today';
		if (days < 2) return `${days}d to event`;
		return `${days}d to event`;
	}

	onMount(async () => {
		// Subscribe to audit_log changes for live tail.
		try {
			const { createBrowserClient } = await import('@supabase/ssr');
			const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import(
				'$env/static/public'
			);
			const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
			const sub = supabase
				.channel('audit-tail')
				.on(
					'postgres_changes',
					{ event: 'INSERT', schema: 'public', table: 'audit_log' },
					async (payload) => {
						const row = payload.new as Record<string, unknown>;
						let actorName = 'System';
						if (row.actor_id) {
							const { data: prof } = await supabase
								.from('profiles')
								.select('full_name')
								.eq('id', row.actor_id as string)
								.single();
							actorName = (prof?.full_name as string) ?? 'Unknown';
						}
						const newRow: ActivityRow = {
							id: Number(row.id),
							at: row.at as string,
							actorName,
							actorRole: (row.actor_role as ActivityRow['actorRole']) ?? null,
							action: row.action as string,
							targetType: (row.target_type as string | null) ?? null,
							targetId: (row.target_id as string | null) ?? null
						};
						activity = [newRow, ...activity].slice(0, 20);
					}
				)
				.subscribe((status) => {
					liveConnected = status === 'SUBSCRIBED';
				});
			unsub = () => supabase.removeChannel(sub);
		} catch {
			liveConnected = false;
		}
	});

	onDestroy(() => {
		if (unsub) unsub();
	});

	const daysLabel = $derived(daysToEvent(data.event.date));
</script>

<svelte:head>
	<title>Dashboard · P3 Judging</title>
</svelte:head>

<PageHeader title="Dashboard" subtitle={data.event.name}>
	{#snippet actions()}
		{#if daysLabel}
			<span
				class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
				style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
			>
				<CalendarClock size={12} strokeWidth={1.5} />
				{daysLabel}
			</span>
		{/if}
		{#if data.event.locked}
			<span
				class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
				style="background: rgba(239, 68, 68, 0.08); border-color: var(--color-danger); color: var(--color-danger);"
			>
				<Lock size={12} strokeWidth={1.5} />
				Event locked
			</span>
		{/if}
	{/snippet}
</PageHeader>

<div class="grid gap-4 lg:grid-cols-2">
	<Card label="Event Progress">
		<div class="space-y-4">
			{#each data.categoryProgress as p (p.category)}
				{@const pct = p.total === 0 ? 0 : Math.round((p.scored / p.total) * 100)}
				<div>
					<div class="mb-1 flex items-baseline justify-between">
						<span class="text-sm font-medium" style="color: var(--color-text-1);">
							Cat {p.category}
						</span>
						<span class="text-xs" style="color: var(--color-text-2); font-family: var(--font-mono);">
							{p.scored} / {p.total} scored
						</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full" style="background: var(--color-bg-3);">
						<div
							class="h-full rounded-full transition-all"
							style="width: {pct}%; background: {pct === 100
								? 'var(--color-success)'
								: 'var(--color-accent)'};"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</Card>

	<Card label="Judge Load">
		{#if data.judgeLoads.length === 0}
			<p class="text-sm" style="color: var(--color-text-2);">
				No active judges with assignments yet.
			</p>
		{:else}
			<ul class="space-y-3">
				{#each data.judgeLoads as j (j.id)}
					{@const pct = j.assigned === 0 ? 0 : Math.round((j.submitted / j.assigned) * 100)}
					<li>
						<div class="mb-1 flex items-baseline justify-between">
							<span class="text-sm font-medium" style="color: var(--color-text-1);">
								{j.name}
							</span>
							<span
								class="text-xs"
								style="color: var(--color-text-2); font-family: var(--font-mono);"
							>
								{j.submitted} / {j.assigned}
							</span>
						</div>
						<div
							class="h-2 w-full overflow-hidden rounded-full"
							style="background: var(--color-bg-3);"
						>
							<div
								class="h-full rounded-full transition-all"
								style="width: {pct}%; background: {pct === 100
									? 'var(--color-success)'
									: 'var(--color-accent-2)'};"
							></div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<div class="mt-4">
	<Card label="Recent Activity">
		{#snippet action()}
			<span class="inline-flex items-center gap-1 text-[11px]" style="color: var(--color-text-2);">
				<span
					class="inline-block h-2 w-2 rounded-full"
					style="background: {liveConnected ? 'var(--color-success)' : 'var(--color-warning)'};"
				></span>
				{liveConnected ? 'live' : 'reconnecting'}
			</span>
		{/snippet}

		{#if activity.length === 0}
			<p class="py-6 text-center text-sm" style="color: var(--color-text-2);">
				No activity yet. Mutations show up here in real time.
			</p>
		{:else}
			<ul class="divide-y" style="--divide-color: var(--border);">
				{#each activity as a (a.id)}
					<li class="flex items-center justify-between gap-3 py-2 text-sm">
						<span
							class="w-20 shrink-0 text-xs"
							style="color: var(--color-text-3); font-family: var(--font-mono);"
						>
							{fmtTime(a.at)}
						</span>
						<span class="w-32 shrink-0 truncate" style="color: var(--color-text-1);">
							{a.actorName}
						</span>
						<span
							class="flex-1 truncate text-xs"
							style="color: var(--color-text-2); font-family: var(--font-mono);"
						>
							{actionLabel(a.action)}
						</span>
						{#if a.targetType}
							<span class="text-xs" style="color: var(--color-text-3);">{a.targetType}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<div class="mt-6 flex flex-wrap gap-2">
	<Button variant="primary" href="/admin/assignments">
		{#snippet icon()}<Sparkles size={16} strokeWidth={1.5} />{/snippet}
		Auto-assign
	</Button>
	<Button variant="secondary" href="/admin/event">
		{#snippet icon()}<Lock size={16} strokeWidth={1.5} />{/snippet}
		{data.event.locked ? 'Unlock event' : 'Lock event'}
	</Button>
	<Button variant="ghost" href="/admin/results">
		{#snippet icon()}<FileDown size={16} strokeWidth={1.5} />{/snippet}
		Export CSV
	</Button>
	<Button variant="ghost" href="/admin/audit">
		{#snippet icon()}<History size={16} strokeWidth={1.5} />{/snippet}
		Audit log
	</Button>
</div>
