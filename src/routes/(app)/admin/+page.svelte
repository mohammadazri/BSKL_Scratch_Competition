<!--
	/admin dashboard — DESIGN.md § 4 B.
	Three cards (Event Progress, Judge Load, Recent Activity) + action buttons.
	Realtime activity feed via Supabase channel; falls back gracefully if the
	channel disconnects (status indicator flips to reconnecting).
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createSupabaseBrowser } from '$lib/supabase';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import RolePill from '$lib/components/RolePill.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import {
		Shuffle,
		Lock,
		Unlock,
		Download,
		ScrollText,
		Radio,
		RadioReceiver
	} from 'lucide-svelte';
	import type { PageData } from './$types';
	import type { RecentActivity } from './+page.server';

	let { data }: { data: PageData } = $props();

	let recent = $state<RecentActivity[]>(data.recent);
	let live = $state(false);
	let channel: ReturnType<ReturnType<typeof createSupabaseBrowser>['channel']> | null = null;
	let supabase: ReturnType<typeof createSupabaseBrowser> | null = null;

	function formatTime(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function formatAction(a: string): string {
		// score_override -> "score override", etc.
		return a.replace(/_/g, ' ');
	}

	function pct(s: number, t: number): number {
		if (t === 0) return 0;
		return Math.round((s / t) * 100);
	}

	function eventCountdown(): string {
		if (!data.event?.eventDate) return '';
		const d = new Date(data.event.eventDate + 'T08:00:00');
		const diff = d.getTime() - Date.now();
		if (diff < 0) return 'in progress';
		const days = Math.floor(diff / 86_400_000);
		const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
		if (days > 1) return `${days} days to event`;
		if (days === 1) return `1 day to event`;
		return `${hrs}h to event`;
	}

	onMount(() => {
		supabase = createSupabaseBrowser();
		channel = supabase
			.channel('audit-log-tail')
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'audit_log' },
				(payload) => {
					const row = payload.new as Record<string, unknown>;
					const entry: RecentActivity = {
						id: String(row.id),
						at: String(row.at),
						actorName: row.actor_id ? 'Updating…' : 'System',
						actorRole: (row.actor_role as RecentActivity['actorRole']) ?? null,
						action: String(row.action),
						targetType: (row.target_type as string | null) ?? null,
						targetId: (row.target_id as string | null) ?? null
					};
					recent = [entry, ...recent].slice(0, 20);
				}
			)
			.subscribe((status) => {
				live = status === 'SUBSCRIBED';
			});
	});

	onDestroy(() => {
		if (channel) channel.unsubscribe();
	});
</script>

<svelte:head>
	<title>Dashboard · P3 Judging</title>
</svelte:head>

<PageHeader title="Dashboard" subtitle={data.event ? data.event.eventName : 'Event not configured.'}>
	{#snippet actions()}
		{#if data.event}
			<span
				class="hidden rounded-full px-3 py-1 text-xs font-medium sm:inline"
				style="background: var(--color-bg-3); color: var(--color-text-2);"
			>
				{eventCountdown()}
			</span>
		{/if}
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-6">
	<Card label="Event progress">
		<div class="flex flex-col gap-4">
			{#each data.progress as p (p.category)}
				<div class="flex items-center gap-3">
					<CategoryChip category={p.category} size="md" />
					<div class="min-w-0 flex-1">
						<div class="mb-1 flex items-center justify-between text-xs">
							<span style="color: var(--color-text-2);">Category {p.category}</span>
							<span
								style="font-family: var(--font-mono); color: var(--color-text-1);"
							>{p.scored} / {p.total} scored</span>
						</div>
						<div
							class="h-2 w-full overflow-hidden rounded-full"
							style="background: var(--color-bg-3);"
						>
							<div
								class="h-full transition-all"
								style="width: {pct(p.scored, p.total)}%; background: var(--color-accent);"
							></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</Card>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<Card label="Judge load">
			{#if data.judgeLoad.length === 0}
				<p class="text-sm" style="color: var(--color-text-2);">
					No active judges yet. Create them in <a
						href="/admin/users"
						class="underline"
						style="color: var(--color-accent-2);">Users</a
					>.
				</p>
			{:else}
				<ul class="flex flex-col gap-3">
					{#each data.judgeLoad as j (j.id)}
						<li class="flex items-center gap-3">
							<span
								class="min-w-0 flex-1 truncate text-sm font-medium"
								style="color: var(--color-text-1);">{j.fullName}</span
							>
							<span
								class="text-xs"
								style="font-family: var(--font-mono); color: var(--color-text-2);"
							>{j.scored} / {j.assigned}</span>
							<div
								class="h-2 w-32 overflow-hidden rounded-full"
								style="background: var(--color-bg-3);"
							>
								<div
									class="h-full"
									style="width: {pct(j.scored, j.assigned)}%; background: var(--color-accent-2);"
								></div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<Card>
			{#snippet action()}
				<span
					class="inline-flex items-center gap-1 text-[11px]"
					style="color: {live ? 'var(--color-success)' : 'var(--color-text-3)'};"
				>
					{#if live}
						<Radio size={12} strokeWidth={1.5} /> live
					{:else}
						<RadioReceiver size={12} strokeWidth={1.5} /> reconnecting
					{/if}
				</span>
			{/snippet}
			<div class="mb-2 text-[11px] font-medium tracking-[0.08em] uppercase" style="color: var(--color-text-2);">
				Recent activity
			</div>
			{#if recent.length === 0}
				<p class="text-sm" style="color: var(--color-text-2);">No activity yet.</p>
			{:else}
				<ul class="flex flex-col">
					{#each recent as r (r.id)}
						<li
							class="flex items-center gap-3 border-b py-2 text-sm last:border-0"
							style="border-color: var(--border);"
						>
							<span
								class="w-12 shrink-0 text-[11px]"
								style="font-family: var(--font-mono); color: var(--color-text-3);"
								>{formatTime(r.at)}</span
							>
							<span
								class="w-28 shrink-0 truncate text-xs font-medium"
								style="color: var(--color-text-1);">{r.actorName ?? 'System'}</span
							>
							{#if r.actorRole}<RolePill role={r.actorRole} />{/if}
							<span
								class="flex-1 truncate text-xs"
								style="color: var(--color-text-2);">{formatAction(r.action)}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>

	<div class="flex flex-wrap gap-2">
		<Button variant="primary" href="/admin/assignments">
			{#snippet icon()}<Shuffle size={16} strokeWidth={1.5} />{/snippet}
			Auto-assign
		</Button>
		<Button variant="secondary" href="/admin/event">
			{#snippet icon()}{#if data.event?.locked}<Unlock size={16} strokeWidth={1.5} />{:else}<Lock
						size={16}
						strokeWidth={1.5}
					/>{/if}{/snippet}
			{data.event?.locked ? 'Unlock event' : 'Lock event'}
		</Button>
		<Button variant="secondary" href="/admin/audit">
			{#snippet icon()}<ScrollText size={16} strokeWidth={1.5} />{/snippet}
			Audit log
		</Button>
		<Button variant="ghost" href="/admin/results">
			{#snippet icon()}<Download size={16} strokeWidth={1.5} />{/snippet}
			Export CSV
		</Button>
	</div>
</div>
