<!--
	PrintableSlips — A4 print sheet of login slips for venue handout (DESIGN.md
	+ TRACK_2_ADMIN.md gotchas). 4 cards per A4 page, sidebar + header hidden
	via @media print.
-->
<script lang="ts">
	import type { Role } from '$lib/types';

	export interface Slip {
		fullName: string;
		email: string;
		role: Role;
		password: string;
		pinLabel?: string | null;
		categories?: string[];
	}

	interface Props {
		event: string;
		eventDate?: string | null;
		slips: Slip[];
		url?: string;
	}

	let { event, eventDate, slips, url }: Props = $props();
</script>

<div class="print-sheet">
	{#each slips as slip, i (slip.email)}
		<article class="slip">
			<header class="slip-head">
				<div>
					<p class="slip-event">{event}</p>
					{#if eventDate}<p class="slip-date">{eventDate}</p>{/if}
				</div>
				<p class="slip-role">{slip.role.replace('_', ' ')}</p>
			</header>
			<h2 class="slip-name">{slip.fullName}</h2>
			{#if slip.categories && slip.categories.length > 0}
				<p class="slip-cats">Categories: {slip.categories.join(', ')}</p>
			{/if}
			<dl class="slip-creds">
				<div>
					<dt>URL</dt>
					<dd>{url ?? 'https://judging'}</dd>
				</div>
				<div>
					<dt>Email</dt>
					<dd>{slip.email}</dd>
				</div>
				<div>
					<dt>Password</dt>
					<dd class="mono">{slip.password}</dd>
				</div>
			</dl>
			{#if slip.pinLabel}
				<p class="slip-pin">{slip.pinLabel}</p>
			{/if}
			<p class="slip-footnote">
				Slip #{i + 1} · keep private · destroy after the event
			</p>
		</article>
	{/each}
</div>

<style>
	.print-sheet {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8mm;
		padding: 10mm;
	}
	.slip {
		border: 1px solid #d1d5db;
		border-radius: 4mm;
		padding: 8mm;
		background: white;
		color: #111827;
		font-family: 'Inter', system-ui, sans-serif;
		page-break-inside: avoid;
		break-inside: avoid;
		display: flex;
		flex-direction: column;
		gap: 4mm;
		min-height: 80mm;
	}
	.slip-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 4mm;
	}
	.slip-event {
		font-size: 9pt;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280;
		margin: 0;
	}
	.slip-date {
		font-size: 8pt;
		color: #9ca3af;
		margin: 1mm 0 0;
	}
	.slip-role {
		font-size: 8pt;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #db2777;
		margin: 0;
	}
	.slip-name {
		font-family: 'Space Grotesk', system-ui, sans-serif;
		font-size: 18pt;
		font-weight: 600;
		margin: 0;
		color: #0f172a;
	}
	.slip-cats {
		font-size: 9pt;
		color: #475569;
		margin: 0;
	}
	.slip-creds {
		display: flex;
		flex-direction: column;
		gap: 2mm;
		margin: 0;
		padding: 4mm;
		background: #f3f4f6;
		border-radius: 2mm;
	}
	.slip-creds > div {
		display: flex;
		justify-content: space-between;
		gap: 4mm;
	}
	.slip-creds dt {
		font-size: 8pt;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280;
		margin: 0;
	}
	.slip-creds dd {
		font-size: 10pt;
		font-weight: 600;
		color: #0f172a;
		margin: 0;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.slip-creds .mono {
		letter-spacing: 0.02em;
	}
	.slip-pin {
		font-size: 8pt;
		color: #6b7280;
		margin: 0;
	}
	.slip-footnote {
		margin-top: auto;
		font-size: 7pt;
		color: #9ca3af;
		text-align: right;
	}
	@media print {
		:global(body) {
			background: white !important;
		}
		:global(header, nav, aside, .print-hide) {
			display: none !important;
		}
		.print-sheet {
			padding: 0;
		}
	}
	@page {
		size: A4;
		margin: 10mm;
	}
</style>
