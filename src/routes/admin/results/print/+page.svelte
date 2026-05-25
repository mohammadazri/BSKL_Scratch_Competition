<!--
	Print podium — one category per page, top 3 displayed certificate-style.
	@media print hides app shell + chrome. Use the browser's print dialog.
	Per DESIGN.md § 4 C and TRACK_5_RESULTS.md "Print podium" section.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { Printer } from '@lucide/svelte';
	import Button from '$lib/components/Button.svelte';
	import { onMount } from 'svelte';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();

	onMount(() => {
		// Auto-focus the print button so the user can hit Enter / Cmd+P quickly.
	});

	function fmtSprint(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	const medals = ['1st', '2nd', '3rd'];
</script>

<svelte:head>
	<title>Print podium · P3 Judging</title>
</svelte:head>

<div class="no-print mb-6 flex items-center justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold" style="font-family: var(--font-display);">
			Print podium
		</h1>
		<p class="mt-1 text-sm" style="color: var(--color-text-2);">
			One page per category. Use the browser's Print dialog (Ctrl/Cmd + P).
		</p>
	</div>
	<Button variant="primary" onclick={() => window.print()}>
		{#snippet icon()}
			<Printer size={16} strokeWidth={1.5} />
		{/snippet}
		Print
	</Button>
</div>

{#if data.loadError}
	<div
		class="no-print mb-4 rounded-[var(--radius)] border p-4 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		Failed to load podium: {data.loadError}
	</div>
{/if}

{#each data.groups as group, gi (group.category)}
	<section class="podium" class:break={gi < data.groups.length - 1}>
		<header class="podium-header">
			<img src="/brand/p3-logo.svg" alt="P3" class="logo" />
			<div class="title">
				<p class="event">P3 Future Coders Challenge 2026</p>
				<h2>Category {group.category} Winners</h2>
			</div>
			<img src="/brand/bskl-logo.svg" alt="BSKL" class="logo" />
		</header>

		{#if group.winners.length === 0}
			<p class="empty">No winners yet — no submitted scoresheets in this category.</p>
		{:else}
			<div class="winners">
				{#each group.winners as winner, i (winner.participantId)}
					<article class="winner rank-{winner.rank}">
						<p class="medal">{medals[i] ?? `${winner.rank}th`}</p>
						<p class="name">{winner.participantName}</p>
						<p class="school">{winner.schoolName}</p>
						<p class="score">{winner.totalPoints} / 100</p>
						<p class="time">{fmtSprint(winner.liveSprintTimeSeconds)}</p>
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/each}

{#if data.groups.length === 0}
	<p class="text-sm" style="color: var(--color-text-2);">
		No categories have winners yet.
	</p>
{/if}

<style>
	.podium {
		padding: 32px;
		background: var(--color-bg-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		margin-bottom: 24px;
	}
	.podium-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 16px;
		margin-bottom: 32px;
	}
	.podium-header .logo {
		height: 40px;
		width: auto;
	}
	.podium-header .title {
		text-align: center;
	}
	.podium-header .event {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--color-text-2);
	}
	.podium-header h2 {
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 700;
		color: var(--color-text-1);
		margin-top: 4px;
	}
	.winners {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
	}
	.winner {
		text-align: center;
		padding: 24px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--color-bg-1);
	}
	.winner.rank-1 {
		grid-column: 2;
		grid-row: 1;
		border-color: var(--color-accent);
		transform: scale(1.05);
	}
	.winner.rank-2 {
		grid-column: 1;
		grid-row: 1;
	}
	.winner.rank-3 {
		grid-column: 3;
		grid-row: 1;
	}
	.medal {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 18px;
		color: var(--color-accent);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.name {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 600;
		margin-top: 12px;
		color: var(--color-text-1);
	}
	.school {
		font-size: 13px;
		color: var(--color-text-2);
		margin-top: 4px;
	}
	.score {
		font-family: var(--font-mono);
		font-size: 32px;
		font-weight: 600;
		margin-top: 16px;
		color: var(--color-text-1);
	}
	.time {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-text-3);
		margin-top: 4px;
	}
	.empty {
		text-align: center;
		font-size: 14px;
		color: var(--color-text-2);
		padding: 48px 0;
	}

	@media print {
		:global(body) {
			background: white !important;
		}
		:global(header[class*='BrandHeader']),
		:global(nav),
		:global(.no-print) {
			display: none !important;
		}
		.podium {
			background: white !important;
			border: none;
			padding: 24px;
			margin: 0;
			page-break-inside: avoid;
		}
		.podium.break {
			page-break-after: always;
		}
		.podium-header h2,
		.medal,
		.name,
		.school,
		.score,
		.time,
		.event {
			color: black !important;
		}
		.winner {
			border-color: #999 !important;
			background: white !important;
		}
		.winner.rank-1 {
			border-color: #d10097 !important;
		}
	}
</style>
