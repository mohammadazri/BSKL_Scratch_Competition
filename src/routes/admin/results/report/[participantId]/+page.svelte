<script lang="ts">
	import type { PageData } from './$types';
	import { Printer, CheckCircle, HelpCircle } from '@lucide/svelte';
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
</script>

<svelte:head>
	<title>Rubric Scorecard: {data.participant.name}</title>
</svelte:head>

<div class="no-print mb-6 flex items-center justify-between gap-4 px-6 pt-6">
	<div>
		<h1 class="text-2xl font-semibold" style="font-family: var(--font-display);">
			Print Individual Scorecard
		</h1>
		<p class="mt-1 text-sm" style="color: var(--color-text-2);">
			Print this detailed rubric for {data.participant.name}.
		</p>
	</div>
	<Button variant="primary" onclick={() => window.print()}>
		{#snippet icon()}
			<Printer size={16} strokeWidth={1.5} />
		{/snippet}
		Print to PDF
	</Button>
</div>

<div class="print-container">
	<header class="doc-header">
		<img src="/brand/p3-logo.png" alt="P3" class="logo" />
		<div class="title-block">
			<p class="event">P3 Future Coders Challenge 2026</p>
			<h2>Official Rubric Scorecard</h2>
			<p class="meta">Category {data.participant.category}</p>
		</div>
		<img src="/brand/bskl-logo.png" alt="BSKL" class="logo" />
	</header>
	
	<section class="participant-info">
		<div class="info-grid">
			<div class="info-item">
				<span class="label">Participant Name</span>
				<span class="value">{data.participant.name}</span>
			</div>
			<div class="info-item">
				<span class="label">School</span>
				<span class="value">{data.participant.schoolName}</span>
			</div>
			<div class="info-item">
				<span class="label">Theme</span>
				<span class="value">{data.participant.theme || '—'}</span>
			</div>
			<div class="info-item highlight">
				<span class="label">Total Score</span>
				<span class="value final-score">{data.grandTotal} / {data.grandMax}</span>
			</div>
		</div>
	</section>

	{#each data.reportSections as section}
		<section class="rubric-section">
			<div class="section-header">
				<div class="section-title">
					<h3>Section {section.section}</h3>
					{#if section.status === 'submitted' || section.status === 'finalised'}
						<span class="status-pill success"><CheckCircle size={14} /> Completed</span>
					{:else}
						<span class="status-pill missing"><HelpCircle size={14} /> Missing/Draft</span>
					{/if}
				</div>
				<div class="section-meta">
					{#if section.judgeName}
						<span class="judge">Judge: {section.judgeName}</span>
					{/if}
					{#if section.sprintTime !== null}
						<span class="sprint">Sprint Time: {fmtSprint(section.sprintTime)}</span>
					{/if}
					<span class="section-score">{section.totalScore} / {section.maxPossible}</span>
				</div>
			</div>

			{#if section.criteria.length === 0}
				<div class="empty">No criteria for this section.</div>
			{:else}
				<table class="rubric-table">
					<thead>
						<tr>
							<th class="col-crit">Criterion</th>
							<th class="col-level">Level</th>
							<th class="col-points text-center">Points</th>
							<th class="col-comment">Judge's Comment</th>
						</tr>
					</thead>
					<tbody>
						{#each section.criteria as crit}
							<tr>
								<td class="col-crit font-medium">{crit.name}</td>
								<td class="col-level">
									{#if crit.level}
										<span class="level-badge level-{crit.level}">{crit.level}</span>
									{:else}
										<span class="unscored">—</span>
									{/if}
								</td>
								<td class="col-points text-center font-mono font-semibold">
									{crit.points !== null ? crit.points : '—'} <span class="max-pt">/ {crit.maxPoints}</span>
								</td>
								<td class="col-comment text-sm italic text-gray-600">
									{crit.comment || '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/each}
</div>

<style>
	.print-container {
		max-width: 900px; /* A4 width roughly */
		margin: 0 auto;
		padding: 40px;
		background: white;
		color: #111827;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}
	
	.doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 24px;
		margin-bottom: 24px;
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
		font-size: 26px;
		font-weight: 700;
		color: #111827;
		margin: 4px 0;
	}
	
	.title-block .meta {
		font-size: 14px;
		color: #4f46e5;
		font-weight: 600;
	}
	
	.participant-info {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 32px;
	}
	
	.info-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
	}
	
	.info-item {
		display: flex;
		flex-direction: column;
	}
	
	.info-item .label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		margin-bottom: 4px;
	}
	
	.info-item .value {
		font-size: 16px;
		font-weight: 500;
		color: #0f172a;
	}
	
	.info-item.highlight .value {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 700;
		color: #4f46e5;
	}
	
	.rubric-section {
		margin-bottom: 40px;
	}
	
	.section-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 2px solid #e2e8f0;
	}
	
	.section-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	
	.section-title h3 {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		color: #1e293b;
	}
	
	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}
	.status-pill.success { background: #dcfce7; color: #166534; }
	.status-pill.missing { background: #fee2e2; color: #991b1b; }
	
	.section-meta {
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: 13px;
		color: #475569;
	}
	
	.section-score {
		font-family: var(--font-mono);
		font-size: 18px;
		font-weight: 700;
		color: #0f172a;
		background: #f1f5f9;
		padding: 4px 12px;
		border-radius: 6px;
	}
	
	.rubric-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}
	
	.rubric-table th {
		text-align: left;
		padding: 12px;
		background: #f8fafc;
		color: #475569;
		font-weight: 600;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #cbd5e1;
	}
	
	.rubric-table td {
		padding: 12px;
		border-bottom: 1px solid #e2e8f0;
		vertical-align: top;
	}
	
	.max-pt {
		font-size: 11px;
		color: #94a3b8;
	}
	
	.level-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}
	.level-0 { background: #f1f5f9; color: #64748b; }
	.level-1 { background: #ffedd5; color: #c2410c; }
	.level-2 { background: #fef08a; color: #854d0e; }
	.level-3 { background: #dcfce7; color: #15803d; }
	.level-4 { background: #dbeafe; color: #1d4ed8; }
	
	@media print {
		@page { margin: 0; size: A4; }
		:global(body) { background: white !important; }
		:global(header[class*='BrandHeader']), :global(nav), :global(.no-print) { display: none !important; }
		.print-container { 
			padding: 2cm; 
			max-width: none;
			box-shadow: none;
		}
		.participant-info { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.rubric-section { page-break-inside: avoid; }
		.level-badge, .status-pill, .section-score { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	}
</style>
