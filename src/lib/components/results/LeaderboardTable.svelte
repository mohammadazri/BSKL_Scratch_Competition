<!--
	LeaderboardTable — the main results table.

	Reads RankingRow[] from the loader (which trusts the `final_rankings` view
	for ordering and ranking — we never re-rank here). Top-3 medal styling and
	tied chip rendered via <RankBadge>. Click a row → drill-in route.

	Columns: Rank, Participant, School, Cat, Theme, Score, Time, Status.
	Per-column sort toggles in the header; default order is the SQL order.

	Uses `animate:flip` for smooth rank shuffles when realtime data updates.
	Respects `prefers-reduced-motion` by reducing the duration to 0.
-->
<script lang="ts">
	import { flip } from 'svelte/animate';
	import RankBadge from '$lib/components/RankBadge.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { ChevronDown, ChevronUp, ShieldAlert } from '@lucide/svelte';
	import type { RankingRow } from '$lib/results/types';

	interface Props {
		rows: RankingRow[];
		role: 'super_admin' | 'viewer';
	}
	let { rows, role }: Props = $props();

	type SortKey =
		| 'default'
		| 'participant'
		| 'school'
		| 'category'
		| 'theme'
		| 'score'
		| 'time'
		| 'status';

	let sortKey = $state<SortKey>('default');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggle(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = key === 'score' ? 'desc' : 'asc';
		}
	}

	function reduceMotion(): boolean {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	const sorted = $derived.by(() => {
		if (sortKey === 'default') return rows;
		const arr = [...rows];
		const dir = sortDir === 'asc' ? 1 : -1;
		const nullsLast = (v: unknown) =>
			v === null || v === undefined ? Number.POSITIVE_INFINITY : v;
		arr.sort((a, b) => {
			switch (sortKey) {
				case 'participant':
					return a.participantName.localeCompare(b.participantName) * dir;
				case 'school':
					return a.schoolName.localeCompare(b.schoolName) * dir;
				case 'category':
					return a.category.localeCompare(b.category) * dir;
				case 'theme':
					return (a.theme ?? '').localeCompare(b.theme ?? '') * dir;
				case 'score': {
					const av = nullsLast(a.totalPoints) as number;
					const bv = nullsLast(b.totalPoints) as number;
					return (av - bv) * dir;
				}
				case 'time': {
					const av = nullsLast(a.liveSprintTimeSeconds) as number;
					const bv = nullsLast(b.liveSprintTimeSeconds) as number;
					return (av - bv) * dir;
				}
				case 'status':
					return a.scoresheetStatus.localeCompare(b.scoresheetStatus) * dir;
				default:
					return 0;
			}
		});
		return arr;
	});

	function fmtTime(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function drillHref(row: RankingRow): string | null {
		if (!row.scoresheetId) return null;
		return `/${role === 'super_admin' ? 'admin' : 'viewer'}/scoresheets/${row.scoresheetId}`;
	}

	function rowKey(row: RankingRow): string {
		return row.participantId;
	}

	const flipDuration = $derived.by(() => (reduceMotion() ? 0 : 300));

	function sortIcon(key: SortKey) {
		if (sortKey !== key) return null;
		return sortDir;
	}

	function status(row: RankingRow):
		| 'not_started'
		| 'draft'
		| 'submitted'
		| 'finalised'
		| 'override'
		| 'dq' {
		if (!row.qualified) return 'dq';
		if (row.hasOverride) return 'override';
		return row.scoresheetStatus;
	}
</script>

<div
	class="overflow-x-auto rounded-[var(--radius)] border"
	style="border-color: var(--border); background: var(--color-bg-1);"
>
	<table class="w-full border-collapse text-sm">
		<thead class="sticky top-0 z-10">
			<tr style="background: var(--color-bg-3);">
				{@render headCell('default', 'Rank', 'left', '90px')}
				{@render headCell('participant', 'Participant', 'left')}
				{@render headCell('school', 'School', 'left')}
				{@render headCell('category', 'Cat', 'left', '60px')}
				{@render headCell('theme', 'Theme', 'left')}
				{@render headCell('score', 'Score', 'right', '110px')}
				{@render headCell('time', 'Time', 'right', '90px')}
				{@render headCell('status', 'Status', 'left', '140px')}
			</tr>
		</thead>
		<tbody>
			{#each sorted as row, i (rowKey(row))}
				{@const href = drillHref(row)}
				<tr
					animate:flip={{ duration: flipDuration }}
					class="border-t transition hover:bg-[color:var(--accent-soft)]"
					style="border-color: var(--border); background: {i % 2 === 0
						? 'var(--color-bg-1)'
						: 'var(--color-bg-2)'}; {href ? 'cursor: pointer;' : ''}"
					onclick={href
						? () => {
								window.location.assign(href);
							}
						: undefined}
				>
					<td class="px-3 py-2.5">
						<RankBadge rank={row.rank} tied={row.isTied} />
					</td>
					<td
						class="px-3 py-2.5"
						style="color: var(--color-text-1); font-weight: 500;"
					>
						{row.participantName}
					</td>
					<td
						class="px-3 py-2.5"
						style="color: var(--color-text-2);"
					>
						{row.schoolName}
					</td>
					<td
						class="px-3 py-2.5 font-mono"
						style="color: var(--color-text-2);"
					>
						{row.category}
					</td>
					<td class="px-3 py-2.5" style="color: var(--color-text-2);">
						{row.theme ?? '—'}
					</td>
					<td
						class="px-3 py-2.5 text-right font-mono tabular-nums"
						style="color: var(--color-text-1);"
					>
						{row.totalPoints ?? '—'}
					</td>
					<td
						class="px-3 py-2.5 text-right font-mono tabular-nums"
						style="color: var(--color-text-2);"
					>
						{fmtTime(row.liveSprintTimeSeconds)}
					</td>
					<td class="px-3 py-2.5">
						<span class="inline-flex items-center gap-2">
							<StatusPill status={status(row)} />
							{#if row.hasOverride}
								<span
									class="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider"
									style="color: var(--color-danger);"
									title={row.hasOverride ? 'Score overridden by super_admin' : ''}
								>
									<ShieldAlert size={11} strokeWidth={2} />
								</span>
							{/if}
						</span>
					</td>
				</tr>
			{/each}
			{#if sorted.length === 0}
				<tr>
					<td colspan="8" class="px-6 py-10">
						<p
							class="text-center text-sm"
							style="color: var(--color-text-2);"
						>
							No participants match the active filters.
						</p>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

{#snippet headCell(
	key: SortKey,
	label: string,
	align: 'left' | 'right' = 'left',
	width?: string
)}
	<th
		class="px-3 py-2 text-[11px] font-medium tracking-wider uppercase whitespace-nowrap select-none"
		style="color: var(--color-text-2); text-align: {align}; {width
			? `width: ${width}`
			: ''}; cursor: pointer;"
		onclick={() => toggle(key)}
	>
		<span class="inline-flex items-center gap-1">
			{label}
			{#if sortIcon(key) === 'asc'}
				<ChevronUp size={12} />
			{:else if sortIcon(key) === 'desc'}
				<ChevronDown size={12} />
			{/if}
		</span>
	</th>
{/snippet}
