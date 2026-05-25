<!--
	LeaderboardPage — the body of /admin/results and /viewer/results.

	Why share a component between admin + viewer?
	  • Layout is identical, only the row-click target differs (/admin vs /viewer
	    scoresheet drill-in).
	  • The leaderboard is read-only on both pages anyway — there are no actions
	    here, only navigation. The role distinction kicks in on the drill-in.

	Realtime: subscribes to INSERT/UPDATE on `scoresheets` and `scores`. Any
	change triggers `invalidateAll()` which re-runs the server load. Channel name:
	  results:{categories|themes|schools|statuses}
	(so different filter sets get their own channel for clarity in logs).

	Trust the SQL: rows arrive ordered by (category, rank). We never re-rank or
	re-sort in JS.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import { browser } from '$app/environment';
	import { Download, Printer } from '@lucide/svelte';
	import { createSupabaseBrowser } from '$lib/supabase';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import RankBadge from '$lib/components/RankBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { ResultsPageData, RankingRow } from '$lib/results/types';
	import type { Category, Theme, ScoresheetStatus } from '$lib/types';

	interface Props {
		data: ResultsPageData;
	}

	let { data }: Props = $props();

	const drillInBase = $derived(
		data.role === 'super_admin' ? '/admin/scoresheets' : '/viewer/scoresheets'
	);

	// Reduced-motion check — kill flip if user prefers reduced motion.
	let prefersReducedMotion = $state(false);
	if (browser) {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mq.matches;
		mq.addEventListener('change', (e) => (prefersReducedMotion = e.matches));
	}

	// ─── Filters ──────────────────────────────────────────────────────────────
	// We render single-select dropdowns for category + theme (default UX) and
	// chip toggles for schools + statuses (multiselect). Filter changes update
	// the URL → triggers a server reload via the standard SvelteKit nav.
	function updateFilter(key: string, value: string[] | string) {
		const params = new URLSearchParams(page.url.search);
		if (Array.isArray(value)) {
			if (value.length === 0) params.delete(key);
			else params.set(key, value.join(','));
		} else if (value === '') {
			params.delete(key);
		} else {
			params.set(key, value);
		}
		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	function toggleInList<T extends string>(list: T[], value: T): T[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	const categoryValue = $derived(data.filters.categories[0] ?? '');
	const themeValue = $derived(data.filters.themes[0] ?? '');

	const allThemes: { value: Theme | 'none' | ''; label: string }[] = [
		{ value: '', label: 'All themes' },
		{ value: 'Eco-Warriors', label: 'Eco-Warriors' },
		{ value: 'Smart Cities', label: 'Smart Cities' },
		{ value: 'Space Pioneers', label: 'Space Pioneers' },
		{ value: 'none', label: 'Theme not set' }
	];
	const allCategories: { value: Category | ''; label: string }[] = [
		{ value: '', label: 'All categories' },
		{ value: 'A', label: 'Category A' },
		{ value: 'B', label: 'Category B' },
		{ value: 'C', label: 'Category C' }
	];
	const allStatuses: { value: ScoresheetStatus | 'not_started'; label: string }[] = [
		{ value: 'not_started', label: 'Not started' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'submitted', label: 'Submitted' },
		{ value: 'finalised', label: 'Finalised' }
	];

	// ─── Realtime ─────────────────────────────────────────────────────────────
	let supabase: ReturnType<typeof createSupabaseBrowser> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let scoresheetChannel: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let scoresChannel: any = null;
	let liveStatus = $state<'connecting' | 'subscribed' | 'disconnected'>('connecting');

	// Debounce refetch so a burst of score upserts doesn't trigger N reloads.
	let refetchTimer: ReturnType<typeof setTimeout> | null = null;
	function scheduleRefetch() {
		if (refetchTimer) clearTimeout(refetchTimer);
		refetchTimer = setTimeout(() => {
			invalidateAll();
		}, 350);
	}

	onMount(() => {
		supabase = createSupabaseBrowser();
		liveStatus = 'connecting';

		scoresheetChannel = supabase
			.channel('results:scoresheets')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'scoresheets' },
				() => scheduleRefetch()
			)
			.subscribe((status: string) => {
				if (status === 'SUBSCRIBED') liveStatus = 'subscribed';
				else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
					liveStatus = 'disconnected';
			});

		scoresChannel = supabase
			.channel('results:scores')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'scores' },
				() => scheduleRefetch()
			)
			.subscribe();
	});

	onDestroy(() => {
		if (refetchTimer) clearTimeout(refetchTimer);
		if (supabase) {
			if (scoresheetChannel) supabase.removeChannel(scoresheetChannel);
			if (scoresChannel) supabase.removeChannel(scoresChannel);
		}
		scoresheetChannel = null;
		scoresChannel = null;
		supabase = null;
	});

	// ─── Helpers ──────────────────────────────────────────────────────────────
	function fmtSprint(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function pillStatus(s: ScoresheetStatus | 'not_started'): 'draft' | 'submitted' | 'finalised' | 'not_started' {
		return s;
	}

	function rowKey(r: RankingRow) {
		return r.participantId;
	}

	const exportHref = $derived(
		`/${data.role === 'super_admin' ? 'admin' : 'viewer'}/results/export${page.url.search}`
	);

	const printHref = $derived(
		`/admin/results/print${page.url.search}`
	);
</script>

<svelte:head>
	<title>Leaderboard · P3 Judging</title>
</svelte:head>

<PageHeader
	title="Leaderboard"
	subtitle="Live rankings — ties auto-broken by sprint time (faster wins), then earlier submission."
	breadcrumb={data.role === 'super_admin' ? 'Admin · Results' : 'Viewer · Results'}
>
	{#snippet actions()}
		<span
			class="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:inline-flex"
			style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
			title="Realtime subscription status"
		>
			<span
				class="inline-block h-2 w-2 rounded-full"
				style="background: {liveStatus === 'subscribed'
					? 'var(--color-success)'
					: liveStatus === 'connecting'
						? 'var(--color-warning)'
						: 'var(--color-danger)'};"
				aria-hidden="true"
			></span>
			{liveStatus === 'subscribed' ? 'Live' : liveStatus === 'connecting' ? 'Connecting…' : 'Offline'}
		</span>
		<Button variant="secondary" href={exportHref}>
			{#snippet icon()}
				<Download size={16} strokeWidth={1.5} />
			{/snippet}
			Export CSV
		</Button>
		{#if data.role === 'super_admin'}
			<Button variant="ghost" href={printHref}>
				{#snippet icon()}
					<Printer size={16} strokeWidth={1.5} />
				{/snippet}
				Print podium
			</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if data.loadError}
	<div
		class="mb-4 rounded-[var(--radius)] border p-4 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		Failed to load rankings: {data.loadError}
	</div>
{/if}

<!-- Filters -->
<Card label="Filters">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Select
			label="Category"
			value={categoryValue}
			onchange={(e) =>
				updateFilter(
					'category',
					(e.target as HTMLSelectElement).value === ''
						? []
						: [(e.target as HTMLSelectElement).value]
				)}
		>
			{#each allCategories as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</Select>

		<Select
			label="Theme"
			value={themeValue}
			onchange={(e) =>
				updateFilter(
					'theme',
					(e.target as HTMLSelectElement).value === ''
						? []
						: [(e.target as HTMLSelectElement).value]
				)}
		>
			{#each allThemes as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</Select>

		<div>
			<p
				class="mb-1.5 text-xs font-medium tracking-wider uppercase"
				style="color: var(--color-text-2);"
			>
				Schools
			</p>
			<div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
				{#each data.schoolOptions as school (school.id)}
					{@const selected = data.filters.schools.includes(school.id)}
					<button
						type="button"
						class="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition"
						style="background: {selected
							? 'var(--accent-soft)'
							: 'var(--color-bg-1)'}; border-color: {selected
							? 'var(--color-accent)'
							: 'var(--border)'}; color: {selected
							? 'var(--color-accent)'
							: 'var(--color-text-2)'};"
						onclick={() =>
							updateFilter('school', toggleInList(data.filters.schools, school.id))}
						aria-pressed={selected}
					>
						{school.name}
					</button>
				{/each}
				{#if data.schoolOptions.length === 0}
					<span class="text-xs" style="color: var(--color-text-3);">No schools yet</span>
				{/if}
			</div>
		</div>

		<div>
			<p
				class="mb-1.5 text-xs font-medium tracking-wider uppercase"
				style="color: var(--color-text-2);"
			>
				Status
			</p>
			<div class="flex flex-wrap gap-1.5">
				{#each allStatuses as opt (opt.value)}
					{@const selected = data.filters.statuses.includes(opt.value)}
					<button
						type="button"
						class="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition"
						style="background: {selected
							? 'var(--accent-soft)'
							: 'var(--color-bg-1)'}; border-color: {selected
							? 'var(--color-accent)'
							: 'var(--border)'}; color: {selected
							? 'var(--color-accent)'
							: 'var(--color-text-2)'};"
						onclick={() =>
							updateFilter('status', toggleInList(data.filters.statuses, opt.value))}
						aria-pressed={selected}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>
	</div>
</Card>

<!-- Leaderboard table -->
<div class="mt-6">
	{#if data.rows.length === 0}
		<EmptyState
			title="No participants match these filters."
			description="Adjust filters above, or wait for judges to submit their first scoresheets."
		/>
	{:else}
		<div
			class="overflow-x-auto rounded-[var(--radius)] border"
			style="border-color: var(--border); background: var(--color-bg-1);"
		>
			<table class="w-full border-collapse text-sm">
				<thead class="sticky top-0 z-10">
					<tr style="background: var(--color-bg-3);">
						<th
							class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Rank
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Cat
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Participant
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							School
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Theme
						</th>
						<th
							class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Score
						</th>
						<th
							class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Time
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2);"
						>
							Status
						</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row, i (rowKey(row))}
						<tr
							animate:flip={{ duration: prefersReducedMotion ? 0 : 250 }}
							class="border-t transition hover:bg-[color:var(--accent-soft)]"
							style="border-color: var(--border); background: {i % 2 === 0
								? 'var(--color-bg-1)'
								: 'var(--color-bg-2)'}; {row.scoresheetId
								? 'cursor: pointer;'
								: ''}"
							onclick={() => {
								if (row.scoresheetId) {
									goto(`${drillInBase}/${row.scoresheetId}`);
								}
							}}
						>
							<td class="px-3 py-2.5">
								<RankBadge rank={row.rank} tied={row.isTied} />
							</td>
							<td class="px-3 py-2.5">
								<CategoryChip category={row.category} />
							</td>
							<td
								class="px-3 py-2.5 font-medium"
								style="color: var(--color-text-1);"
							>
								{row.participantName}
								{#if row.hasOverride}
									<span
										class="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px]"
										style="background: rgba(239,68,68,0.15); color: var(--color-danger);"
										title="One or more scores were overridden by a super_admin."
									>
										⚠ override
									</span>
								{/if}
							</td>
							<td class="px-3 py-2.5" style="color: var(--color-text-2);">
								{row.schoolName}
							</td>
							<td class="px-3 py-2.5" style="color: var(--color-text-2);">
								{row.theme ?? '—'}
							</td>
							<td
								class="px-3 py-2.5 text-right tabular-nums"
								style="color: var(--color-text-1); font-family: var(--font-mono);"
							>
								{row.totalPoints == null ? '—' : row.totalPoints}
							</td>
							<td
								class="px-3 py-2.5 text-right tabular-nums"
								style="color: var(--color-text-2); font-family: var(--font-mono);"
							>
								{fmtSprint(row.liveSprintTimeSeconds)}
							</td>
							<td class="px-3 py-2.5">
								<StatusPill status={pillStatus(row.scoresheetStatus)} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Footer totals -->
<div
	class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"
	style="color: var(--color-text-2);"
>
	<div class="flex flex-wrap items-center gap-4">
		<span>
			<span style="color: var(--color-text-1);">{data.totals.scored}</span> scored
		</span>
		<span>
			<span style="color: var(--color-text-1);">{data.totals.pending}</span> pending
		</span>
		<span>
			<span style="color: var(--color-text-1);">{data.totals.tiesBrokenByTime}</span>
			tied (broken by sprint time)
		</span>
	</div>
	<p>
		ⓘ Ranks are computed in the database (RANK() over the
		<code style="color: var(--color-text-1);">final_rankings</code> view) — no client-side re-sort.
	</p>
</div>
