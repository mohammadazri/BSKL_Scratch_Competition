<script lang="ts">
	import type { PageData } from './$types';
	import { Printer } from '@lucide/svelte';
	import Button from '$lib/components/Button.svelte';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();

	function fmtSprint(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	
	// Group rows by category
	let catA = $derived(data.rows.filter(r => r.category === 'A'));
	let catB = $derived(data.rows.filter(r => r.category === 'B'));
	let catC = $derived(data.rows.filter(r => r.category === 'C'));
	let groups = $derived([
		{ category: 'A', rows: catA },
		{ category: 'B', rows: catB },
		{ category: 'C', rows: catC }
	].filter(g => g.rows.length > 0));
</script>

<svelte:head>
	<title>Print Leaderboard · P3 Judging</title>
</svelte:head>

<div class="no-print mb-6 flex items-center justify-between gap-4 px-6 pt-6">
	<div>
		<h1 class="text-2xl font-semibold" style="font-family: var(--font-display);">
			Print Full Leaderboard
		</h1>
		<p class="mt-1 text-sm" style="color: var(--color-text-2);">
			Use the browser's Print dialog (Ctrl/Cmd + P) to generate a PDF. Make sure "Background graphics" is enabled.
		</p>
	</div>
	<Button variant="primary" onclick={() => window.print()}>
		{#snippet icon()}
			<Printer size={16} strokeWidth={1.5} />
		{/snippet}
		Print to PDF
	</Button>
</div>

{#if data.loadError}
	<div
		class="no-print mx-6 mb-4 rounded-[var(--radius)] border p-4 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		Failed to load leaderboard: {data.loadError}
	</div>
{/if}

<div class="print-container">
	<header class="doc-header">
		<img src="/brand/p3-logo.png" alt="P3" class="logo" />
		<div class="title-block">
			<p class="event">P3 Future Coders Challenge 2026</p>
			<h2>Official Competition Results</h2>
			<p class="meta">Exported: {new Date().toLocaleString()}</p>
		</div>
		<img src="/brand/bskl-logo.png" alt="BSKL" class="logo" />
	</header>
	
	{#each groups as group}
		<section class="category-section">
			<h3>Category {group.category}</h3>
			<table class="leaderboard-table">
				<thead>
					<tr>
						<th class="col-rank">Rank</th>
						<th class="col-name">Participant</th>
						<th class="col-school">School</th>
						<th class="col-theme">Theme</th>
						<th class="col-score text-center">Score</th>
						<th class="col-sprint text-center">Sprint Time</th>
						<th class="col-status text-center">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each group.rows as row}
						<tr class:podium={row.rank && row.rank <= 3}>
							<td class="col-rank">
								{#if row.rank}
									<span class="rank-badge rank-{row.rank}">{row.rank}</span>
								{:else}
									<span class="unranked">—</span>
								{/if}
							</td>
							<td class="col-name">
								<div class="font-medium">{row.participantName}</div>
							</td>
							<td class="col-school text-sm text-gray-600">{row.schoolName}</td>
							<td class="col-theme text-sm">{row.theme || '—'}</td>
							<td class="col-score text-center font-mono font-semibold">{row.totalPoints ?? '—'}</td>
							<td class="col-sprint text-center font-mono text-sm">{fmtSprint(row.liveSprintTimeSeconds)}</td>
							<td class="col-status text-center text-xs">
								<span class="status-badge {row.scoresheetStatus}">{row.scoresheetStatus}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/each}
	
	{#if groups.length === 0}
		<div class="empty-state">
			No results to display.
		</div>
	{/if}
</div>

<style>
	.print-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
		background: white;
		color: #111827;
	}
	
	.doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 24px;
		border-bottom: 2px solid #e5e7eb;
		margin-bottom: 32px;
	}
	
	.doc-header .logo {
		height: 48px;
		width: auto;
	}
	
	.title-block {
		text-align: center;
	}
	
	.title-block .event {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: #6b7280;
	}
	
	.title-block h2 {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 700;
		color: #111827;
		margin: 4px 0;
	}
	
	.title-block .meta {
		font-size: 12px;
		color: #9ca3af;
	}
	
	.category-section {
		margin-bottom: 48px;
		page-break-inside: avoid;
	}
	
	.category-section h3 {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 16px;
		color: #4f46e5;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 8px;
	}
	
	.leaderboard-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	
	.leaderboard-table th {
		text-align: left;
		padding: 10px 12px;
		background: #f9fafb;
		color: #374151;
		font-weight: 600;
		border-bottom: 2px solid #d1d5db;
	}
	
	.leaderboard-table td {
		padding: 10px 12px;
		border-bottom: 1px solid #e5e7eb;
		vertical-align: middle;
	}
	
	.leaderboard-table tr:nth-child(even) td {
		background: #fdfdfd;
	}
	
	.leaderboard-table tr.podium td {
		background: #fefce8; /* Light yellow */
	}
	
	.rank-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 12px;
		font-weight: 600;
		font-size: 12px;
		background: #e5e7eb;
		color: #374151;
	}
	
	.rank-1 { background: #fef08a; color: #854d0e; }
	.rank-2 { background: #e5e7eb; color: #374151; }
	.rank-3 { background: #fed7aa; color: #9a3412; }
	
	.status-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 500;
		text-transform: uppercase;
		font-size: 10px;
	}
	
	.status-badge.submitted, .status-badge.finalised { background: #dcfce7; color: #166534; }
	.status-badge.draft { background: #fef3c7; color: #92400e; }
	.status-badge.not_started { background: #f3f4f6; color: #4b5563; }
	
	.empty-state {
		text-align: center;
		padding: 48px;
		color: #6b7280;
	}
	
	@media print {
		@page { margin: 1cm; size: A4; }
		:global(body) { background: white !important; }
		:global(header[class*='BrandHeader']), :global(nav), :global(.no-print) { display: none !important; }
		.print-container { padding: 0; max-width: none; }
		.leaderboard-table tr.podium td { background: #fefce8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.rank-badge, .status-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	}
</style>
