<!--
	AuditPage — full audit screen body. Reused across:
	  /admin/audit  (super_admin)
	  /viewer/audit (viewer)
	  /judge/audit  (judge, sees own only via RLS)

	Owns:
	  • Page header + brand
	  • LiveIndicator + Export CSV button
	  • FilterBar (driven by URL params)
	  • AuditTable
	  • Realtime subscription that prepends new rows that match active filters

	Does NOT own role gating — that's done by +layout.server.ts above.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { createSupabaseBrowser } from '$lib/supabase';
	import type { AuditRowWithActor } from '$lib/audit/query';
	import type { AuditPageData } from '$lib/audit/loader';
	import type { AuditAction } from '$lib/audit/types';
	import BrandHeader from '$lib/components/BrandHeader.svelte';
	import AuditTable from './AuditTable.svelte';
	import FilterBar from './FilterBar.svelte';
	import LiveIndicator, { type LiveStatus } from './LiveIndicator.svelte';

	interface Props {
		data: AuditPageData;
		title?: string;
		subtitle?: string;
		showActorFilter?: boolean;
		canExport?: boolean;
	}
	let {
		data,
		title = 'Audit log',
		subtitle = 'Append-only record of every mutation. Filterable, exportable, live.',
		showActorFilter = true,
		canExport = true
	}: Props = $props();

	// Local mutable copy of rows so realtime can prepend without invalidating
	// the whole page. We reset whenever the server-side `data.rows` changes
	// (i.e. filters were re-applied). The `$effect` below tracks data.rows for
	// the reseed; seeding the initial value through a function silences the
	// "captures initial value" lint that fires when reading data.rows directly.
	const initialRows = () => data.rows;
	let liveRows = $state<AuditRowWithActor[]>(initialRows());
	let liveStatus = $state<LiveStatus>('disabled');
	let outOfFilterCount = $state(0);

	// Re-seed liveRows when server data changes (filter change, invalidate).
	// Reference `data.rows` inside the effect so the dependency is tracked.
	$effect(() => {
		const next = data.rows;
		liveRows = next;
		outOfFilterCount = 0;
	});

	// Decide if a freshly inserted row matches the currently active filters.
	// Date range is checked against `at`. Search is best-effort (only against
	// reason / target_id) — we can't redo a full LIKE on the client cheaply.
	function rowMatchesFilters(row: any): boolean {
		const f = data.filters;
		if (f.actorIds.length && !f.actorIds.includes(row.actor_id)) return false;
		if (f.actions.length && !f.actions.includes(row.action as AuditAction)) return false;
		if (f.targetTypes.length && !f.targetTypes.includes(row.target_type)) return false;
		if (f.fromIso && row.at < f.fromIso) return false;
		if (f.toIso && row.at > f.toIso) return false;
		if (f.search) {
			const needle = f.search.toLowerCase();
			const reason = (row.reason ?? '').toLowerCase();
			const tid = (row.target_id ?? '').toLowerCase();
			if (!reason.includes(needle) && !tid.includes(needle)) return false;
		}
		return true;
	}

	let supabase: ReturnType<typeof createSupabaseBrowser> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let channel: any = null;

	onMount(() => {
		liveStatus = 'connecting';
		supabase = createSupabaseBrowser();

		channel = supabase
			.channel(`audit_log_tail:${data.subscribeKey || 'all'}`)
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'audit_log' },
				async (payload) => {
					const raw = payload.new as any;

					// Out-of-filter rows just bump a small badge so the user knows
					// activity is happening they don't currently see.
					if (!rowMatchesFilters(raw)) {
						outOfFilterCount += 1;
						return;
					}

					// We don't have the joined actor profile in the realtime payload.
					// Fast path: synthesise a minimal actor stub. The actor's display
					// name will fill in on the next full reload — good enough.
					const synthetic: AuditRowWithActor = {
						id: String(raw.id),
						at: raw.at,
						actor_id: raw.actor_id,
						actor_role: raw.actor_role,
						actor: null,
						actor_ip: raw.actor_ip,
						actor_ua: raw.actor_ua,
						action: raw.action,
						target_type: raw.target_type,
						target_id: raw.target_id,
						before_json: raw.before_json,
						after_json: raw.after_json,
						reason: raw.reason
					};

					// Best-effort actor lookup so the row isn't anonymous on screen.
					if (synthetic.actor_id) {
						const { data: actor } = await supabase!
							.from('profiles')
							.select('full_name, role')
							.eq('id', synthetic.actor_id)
							.maybeSingle();
						if (actor) synthetic.actor = actor as any;
					}

					liveRows = [synthetic, ...liveRows].slice(0, data.limit);
				}
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') liveStatus = 'subscribed';
				else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
					liveStatus = 'disconnected';
				else if (status === 'CLOSED') liveStatus = 'disabled';
				else liveStatus = 'connecting';
			});
	});

	onDestroy(() => {
		if (channel && supabase) {
			supabase.removeChannel(channel);
		}
		channel = null;
		supabase = null;
	});

	function reloadWithFilters() {
		invalidateAll();
	}

	let exportUrl = $derived(
		`/${data.role === 'super_admin' ? 'admin' : data.role}/audit/export${page.url.search}`
	);
</script>

<BrandHeader />

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
	<div class="mb-4 flex flex-col gap-1">
		<p
			class="text-[11px] font-medium tracking-[0.18em] uppercase"
			style="color: var(--color-text-2);"
		>
			{data.role === 'judge' ? 'Your activity' : 'Bias prevention'}
		</p>
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold sm:text-3xl" style="color: var(--color-text-1);">
					{title}
				</h1>
				<p class="mt-1 text-sm" style="color: var(--color-text-2);">{subtitle}</p>
			</div>
			<div class="flex items-center gap-4">
				<LiveIndicator status={liveStatus} />
				{#if outOfFilterCount > 0}
					<button
						type="button"
						class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs"
						style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
						onclick={reloadWithFilters}
						title="New rows arrived that don't match your filters. Click to refresh."
					>
						<span>+{outOfFilterCount} new</span>
						<span style="color: var(--color-accent);">·</span>
						<span>refresh</span>
					</button>
				{/if}
				{#if canExport}
					<a
						href={exportUrl}
						download
						class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
						style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-1);"
					>
						Export CSV
					</a>
				{/if}
			</div>
		</div>
	</div>

	{#if data.loadError}
		<div
			class="mb-4 rounded-lg border p-4 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			Failed to load audit rows: {data.loadError}
		</div>
	{/if}

	<div class="mb-4">
		<FilterBar
			actorOptions={data.actorOptions}
			actorIds={data.filters.actorIds}
			actions={data.filters.actions}
			targetTypes={data.filters.targetTypes}
			fromIso={data.filters.fromIso}
			toIso={data.filters.toIso}
			search={data.filters.search}
			{showActorFilter}
		/>
	</div>

	<AuditTable
		rows={liveRows}
		currentUserId={data.currentUserId}
		limit={data.limit}
		truncated={data.truncated && liveRows.length >= data.limit}
	/>
</main>
