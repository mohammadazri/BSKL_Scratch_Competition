<!--
	/admin/results/podium — printable category winners page.
	One category per printed page (page-break-after: always). Brand fonts.
	Nav and sidebar hidden under @media print.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();

	// Auto-open the system print dialog so the operator gets the dialog as soon
	// as the page renders. Deferred a tick so the page paints first.
	onMount(() => {
		setTimeout(() => window.print(), 250);
	});

	const medals = ['1st', '2nd', '3rd'];

	function fmtTime(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>Podium · P3 Judging</title>
</svelte:head>

<div class="podium-root" style="background: white; color: #111;">
	{#each data.podiums as p (p.category)}
		<section class="podium-page">
			<header class="podium-head">
				<img src="/brand/p3-logo.svg" alt="P3" class="podium-logo" />
				<div>
					<p class="podium-event">P3 Future Coders Challenge 2026</p>
					<h1 class="podium-title">Category {p.category} Winners</h1>
				</div>
				<img src="/brand/bskl-logo.svg" alt="BSKL" class="podium-logo" />
			</header>

			<div class="podium-grid">
				{#each p.rows.slice(0, 3) as row, i (row.participantId)}
					<div class="podium-slot rank-{i + 1}">
						<p class="rank-label">{medals[i]} place</p>
						<p class="name">{row.participantName}</p>
						<p class="school">{row.schoolName}</p>
						<p class="score">
							{row.totalPoints ?? '—'}
							<span class="score-max">/ 100</span>
						</p>
						{#if row.isTied}
							<p class="tied">tied · {fmtTime(row.liveSprintTimeSeconds)} sprint</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}

	{#if data.podiums.length === 0}
		<p style="padding: 4rem; text-align: center;">
			No podium data available for the active filters.
		</p>
	{/if}
</div>

<style>
	.podium-root {
		min-height: 100vh;
		font-family: 'Space Grotesk', system-ui, sans-serif;
	}

	.podium-page {
		min-height: 90vh;
		display: flex;
		flex-direction: column;
		gap: 3rem;
		padding: 3rem;
		page-break-after: always;
	}

	.podium-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		border-bottom: 2px solid #E5135C;
		padding-bottom: 1.5rem;
	}

	.podium-logo {
		height: 48px;
		width: auto;
	}

	.podium-event {
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #555;
		margin: 0;
	}

	.podium-title {
		font-size: 36px;
		font-weight: 700;
		margin: 6px 0 0 0;
		color: #111;
	}

	.podium-grid {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1.2fr 1fr;
		gap: 2rem;
		align-items: end;
	}

	.podium-slot {
		text-align: center;
		padding: 2rem 1rem;
		border-radius: 12px;
		border: 1px solid #E5E5E5;
		background: #FAFAFA;
	}

	.podium-slot.rank-1 {
		background: #FFF7DC;
		border-color: #E5BC1C;
		transform: translateY(-1.5rem);
		padding-top: 3rem;
		padding-bottom: 3rem;
	}

	.podium-slot.rank-2 {
		background: #F2F2F2;
		border-color: #C5C5C5;
	}

	.podium-slot.rank-3 {
		background: #FBF1E5;
		border-color: #B45309;
	}

	.rank-label {
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #555;
		margin: 0 0 1rem 0;
	}

	.name {
		font-size: 24px;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
	}

	.school {
		font-size: 14px;
		color: #555;
		margin: 0 0 1rem 0;
	}

	.score {
		font-size: 32px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		margin: 0;
		color: #E5135C;
	}

	.score-max {
		font-size: 18px;
		color: #777;
		font-weight: 400;
	}

	.tied {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #777;
		margin: 0.5rem 0 0 0;
	}

	@media print {
		:global(body) {
			background: white;
		}
		:global(nav),
		:global(header.app-shell),
		:global(aside),
		:global([role='navigation']) {
			display: none !important;
		}
	}
</style>
