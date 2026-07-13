<!--
	LeaderboardPage — full results screen body. Reused across:
	  /admin/results  (super_admin — drill row links to /admin/scoresheets/[id])
	  /viewer/results (viewer — links to /viewer/scoresheets/[id], same data)

	Owns:
	  • Page header + brand
	  • Filter bar (URL-driven)
	  • Realtime subscription (scoresheets + scores → invalidateAll)
	  • Export CSV download link
	  • Footer counters (scored / pending / ties-broken-by-time)
	  • Print podium link (super_admin only — page renders for both but is
	    decorative on viewer side)

	Role-aware bits are limited to: which drill-in path the row points at, and
	whether the "Print podium" button shows. Override buttons live on the
	scoresheet drill-in page, not here.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import LeaderboardTable from './LeaderboardTable.svelte';
	import ResultsFilterBar from './ResultsFilterBar.svelte';
	import { createSupabaseBrowser } from '$lib/supabase';
	import type { ResultsPageData } from '$lib/results/types';
	import { Activity, Award, Download, Printer } from '@lucide/svelte';

	interface Props {
		data: ResultsPageData;
		title?: string;
		subtitle?: string;
	}
	let {
		data,
		title = 'Leaderboard',
		subtitle = 'Live results. Ties broken by sprint time (faster wins), then by submission order.'
	}: Props = $props();

	type LiveStatus = 'disabled' | 'connecting' | 'subscribed' | 'disconnected';
	let liveStatus = $state<LiveStatus>('disabled');

	let supabase: ReturnType<typeof createSupabaseBrowser> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let scoresheetChannel: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let scoreChannel: any = null;

	// Debounce realtime refetches — multiple score updates from one submit
	// would otherwise hammer the loader. 250ms is below human perception but
	// avoids triple-fetching on a multi-score insert.
	let pendingRefetch: ReturnType<typeof setTimeout> | null = null;
	function scheduleRefetch() {
		if (pendingRefetch) clearTimeout(pendingRefetch);
		pendingRefetch = setTimeout(() => {
			pendingRefetch = null;
			invalidateAll();
		}, 250);
	}

	onMount(() => {
		liveStatus = 'connecting';
		supabase = createSupabaseBrowser();

		scoresheetChannel = supabase
			.channel('results_scoresheets_tail')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'scoresheets' }, () =>
				scheduleRefetch()
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') liveStatus = 'subscribed';
				else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') liveStatus = 'disconnected';
				else if (status === 'CLOSED') liveStatus = 'disabled';
				else liveStatus = 'connecting';
			});

		scoreChannel = supabase
			.channel('results_scores_tail')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () =>
				scheduleRefetch()
			)
			.subscribe();
	});

	onDestroy(() => {
		if (pendingRefetch) clearTimeout(pendingRefetch);
		if (scoresheetChannel && supabase) supabase.removeChannel(scoresheetChannel);
		if (scoreChannel && supabase) supabase.removeChannel(scoreChannel);
		scoresheetChannel = null;
		scoreChannel = null;
		supabase = null;
	});

	const exportUrl = $derived(
		`/${data.role === 'super_admin' ? 'admin' : 'viewer'}/results/export${page.url.search}`
	);
	const exportExcelUrl = $derived(
		`/${data.role === 'super_admin' ? 'admin' : 'viewer'}/results/export-excel${page.url.search}`
	);
	const podiumUrl = $derived(
		`/${data.role === 'super_admin' ? 'admin' : 'viewer'}/results/podium${page.url.search}`
	);
	const printLeaderboardUrl = $derived(
		`/${data.role === 'super_admin' ? 'admin' : 'viewer'}/results/print${page.url.search}`
	);
</script>

<div>
	<div class="mb-4 flex flex-col gap-1">
		<p
			class="text-[11px] font-medium tracking-[0.18em] uppercase"
			style="color: var(--color-text-2);"
		>
			Results
		</p>
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1
					class="text-2xl font-semibold sm:text-3xl"
					style="font-family: var(--font-display); color: var(--color-text-1);"
				>
					{title}
				</h1>
				<p class="mt-1 text-sm" style="color: var(--color-text-2);">{subtitle}</p>
			</div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium tracking-wider uppercase"
					style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
					title="Realtime status (subscribed = updates within 1s)"
				>
					<Activity
						size={12}
						strokeWidth={2}
						style="color: {liveStatus === 'subscribed'
							? 'var(--color-success)'
							: liveStatus === 'connecting'
								? 'var(--color-warning)'
								: 'var(--color-text-3)'};"
					/>
					{liveStatus}
				</span>
				{#if data.role === 'super_admin'}
					<a
						href={podiumUrl}
						target="_blank"
						rel="noopener"
						class="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-medium transition-colors"
						style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-1);"
					>
						<Printer size={14} strokeWidth={1.5} />
						Print podium
					</a>
					<a
						href={exportExcelUrl}
						download
						class="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-medium transition-colors"
						style="background: var(--color-accent-2); border-color: var(--color-accent-2); color: white;"
					>
						<Download size={14} strokeWidth={1.5} />
						Export Excel
					</a>
					<a
						href={printLeaderboardUrl}
						target="_blank"
						class="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-medium transition-colors"
						style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-1);"
					>
						<Printer size={14} strokeWidth={1.5} />
						Print PDF
					</a>
				{/if}
				<a
					href={exportUrl}
					download
					class="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-medium transition-colors"
					style="background: var(--color-accent); border-color: var(--color-accent); color: white;"
				>
					<Download size={14} strokeWidth={1.5} />
					Export CSV
				</a>
			</div>
		</div>
	</div>

	{#if data.loadError}
		<div
			class="mb-4 rounded-[var(--radius)] border p-4 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			Failed to load rankings: {data.loadError}
		</div>
	{/if}

	<div class="mb-4">
		<ResultsFilterBar
			categories={data.filters.categories}
			themes={data.filters.themes}
			schools={data.filters.schools}
			statuses={data.filters.statuses}
			schoolOptions={data.schoolOptions}
		/>
	</div>

	<LeaderboardTable rows={data.rows} role={data.role} />

	<footer
		class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3 text-xs"
		style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
	>
		<div class="flex flex-wrap items-center gap-4">
			<span class="inline-flex items-center gap-1.5">
				<Award size={12} strokeWidth={2} style="color: var(--color-success);" />
				<strong style="color: var(--color-text-1);">{data.totals.scored}</strong>
				scored
			</span>
			<span class="inline-flex items-center gap-1.5">
				<strong style="color: var(--color-text-1);">{data.totals.pending}</strong>
				pending
			</span>
			{#if data.totals.tiesBrokenByTime > 0}
				<span
					class="inline-flex items-center gap-1.5"
					title="Pairs of participants ordered by sprint time after a tie on points"
				>
					<strong style="color: var(--color-text-1);">{data.totals.tiesBrokenByTime}</strong>
					ties broken by sprint time
				</span>
			{/if}
		</div>
		<span>Ties auto-broken by sprint time (faster wins).</span>
	</footer>
</div>
