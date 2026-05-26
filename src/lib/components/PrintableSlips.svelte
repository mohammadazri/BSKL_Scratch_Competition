<!--
	PrintableSlips — premium A4 sign-in slip handout.

	Layout: 2 slips per A4 portrait page. Each slip has:
	  - P3 + BSKL logos and event meta in a header band
	  - Role-coloured accent bar at the top
	  - Big personalised greeting + role/categories chips
	  - Credentials block (URL + email + password) next to an inline SVG QR code
	  - Numbered "How to sign in" steps
	  - Role-specific tip
	  - Footer with PIN label, slip counter, security note, and support contact

	The QR SVG is generated server-side by `qrcode` in +page.server.ts so the
	component is dependency-free and renders identically online or offline.
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
		qrSvg?: string;
	}

	interface Props {
		event: string;
		eventDate?: string | null;
		venue?: string;
		support?: string;
		slips: Slip[];
		url: string;
	}

	let {
		event,
		eventDate,
		venue = 'British International School of Kuala Lumpur',
		support = 'Speak to Mohammad (Tech lead) at the registration desk',
		slips,
		url
	}: Props = $props();

	const roleLabel = (r: Role) =>
		r === 'super_admin' ? 'Super admin' : r === 'judge' ? 'Judge' : 'Viewer';

	const roleAccent = (r: Role) =>
		r === 'super_admin' ? '#7c3aed' : r === 'judge' ? '#0891b2' : '#d97706';

	const roleTip = (r: Role) =>
		r === 'super_admin'
			? 'You can manage users, schools, participants, assignments, and override scores. Use it sparingly — every action is audit-logged.'
			: r === 'judge'
				? 'You will only see the participants assigned to you. Each scoresheet auto-saves while you work; submit when done. Tap the timer button right when the sprint starts.'
				: 'Read-only access. You can watch the live leaderboard and inspect any submitted scoresheet, but you cannot change anything.';

	const fmtDate = (iso: string | null | undefined): string | null => {
		if (!iso) return null;
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	};
</script>

<div class="print-sheet">
	{#each slips as slip, i (slip.email)}
		<article class="slip" style="--accent: {roleAccent(slip.role)};">
			<div class="accent-bar"></div>

			<header class="slip-header">
				<div class="logos">
					<img src="/brand/p3-logo.png" alt="P3 Robotics & Coding" />
					<span class="logo-sep" aria-hidden="true">·</span>
					<img src="/brand/bskl-logo.png" alt="BSKL" />
				</div>
				<div class="event">
					<p class="event-name">{event}</p>
					<p class="event-meta">
						{#if fmtDate(eventDate)}<span>{fmtDate(eventDate)}</span>{/if}
						{#if fmtDate(eventDate) && venue}<span class="dot">·</span>{/if}
						{#if venue}<span>{venue}</span>{/if}
					</p>
				</div>
			</header>

			<section class="greeting">
				<p class="kicker">Sign-in slip for</p>
				<h2 class="name">{slip.fullName}</h2>
				<div class="chips">
					<span class="chip chip-role">{roleLabel(slip.role)}</span>
					{#if slip.role === 'judge' && slip.categories?.length}
						{#each slip.categories as c (c)}
							<span class="chip chip-cat">Category {c}</span>
						{/each}
					{/if}
				</div>
			</section>

			<section class="creds-row">
				<dl class="creds">
					<div>
						<dt>URL</dt>
						<dd class="mono url">{url}</dd>
					</div>
					<div>
						<dt>Email</dt>
						<dd class="mono">{slip.email}</dd>
					</div>
					<div>
						<dt>Temporary password</dt>
						<dd class="mono password">{slip.password}</dd>
					</div>
				</dl>
				{#if slip.qrSvg}
					<div class="qr" aria-label="QR code linking to the sign-in page">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html slip.qrSvg}
						<p class="qr-caption">Scan to open</p>
					</div>
				{/if}
			</section>

			<section class="how">
				<p class="how-title">How to sign in</p>
				<ol class="how-list">
					<li>Open the URL above in any browser (or scan the QR code).</li>
					<li>Enter the email and the temporary password exactly as shown.</li>
					<li>You will be taken straight to your dashboard.</li>
				</ol>
			</section>

			<aside class="tip">
				<p class="tip-label">For you as a {roleLabel(slip.role).toLowerCase()}</p>
				<p class="tip-body">{roleTip(slip.role)}</p>
			</aside>

			<footer class="slip-footer">
				<div class="footer-left">
					{#if slip.pinLabel}<p class="pin">PIN reference: {slip.pinLabel}</p>{/if}
					<p class="security">Keep this slip private. Destroy it after the event.</p>
				</div>
				<div class="footer-right">
					<p class="slip-num">Slip {i + 1} of {slips.length}</p>
					<p class="support">Need help? {support}</p>
				</div>
			</footer>
		</article>
	{/each}
</div>

<style>
	.print-sheet {
		display: flex;
		flex-direction: column;
		gap: 10mm;
		padding: 12mm;
		background: white;
		color: #0f172a;
		font-family: 'Inter', system-ui, sans-serif;
	}
	.slip {
		position: relative;
		border: 1px solid #e2e8f0;
		border-radius: 4mm;
		padding: 10mm 12mm 8mm;
		background: white;
		page-break-inside: avoid;
		break-inside: avoid;
		display: flex;
		flex-direction: column;
		gap: 6mm;
		min-height: 130mm;
		overflow: hidden;
	}
	.accent-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3mm;
		background: var(--accent);
	}

	/* ── Header band ── */
	.slip-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8mm;
		padding-bottom: 4mm;
		border-bottom: 1px solid #e2e8f0;
	}
	.logos {
		display: flex;
		align-items: center;
		gap: 4mm;
	}
	.logos img {
		height: 12mm;
		width: auto;
		object-fit: contain;
	}
	.logo-sep {
		color: #cbd5e1;
		font-size: 12pt;
	}
	.event {
		text-align: right;
	}
	.event-name {
		margin: 0;
		font-family: 'Space Grotesk', system-ui, sans-serif;
		font-size: 11pt;
		font-weight: 600;
		color: #0f172a;
	}
	.event-meta {
		margin: 1mm 0 0;
		font-size: 8pt;
		color: #64748b;
		display: flex;
		gap: 1.5mm;
		justify-content: flex-end;
		flex-wrap: wrap;
	}
	.event-meta .dot {
		color: #cbd5e1;
	}

	/* ── Greeting ── */
	.greeting .kicker {
		margin: 0;
		font-size: 8pt;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #94a3b8;
	}
	.greeting .name {
		margin: 1mm 0 3mm;
		font-family: 'Space Grotesk', system-ui, sans-serif;
		font-size: 22pt;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.1;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 2mm;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.8mm 2.5mm;
		border-radius: 999px;
		font-size: 8pt;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.chip-role {
		background: color-mix(in srgb, var(--accent) 12%, white);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, white);
	}
	.chip-cat {
		background: #f1f5f9;
		color: #334155;
		border: 1px solid #e2e8f0;
	}

	/* ── Credentials row ── */
	.creds-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6mm;
		padding: 5mm;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 3mm;
	}
	.creds {
		display: flex;
		flex-direction: column;
		gap: 3mm;
		margin: 0;
	}
	.creds > div {
		display: flex;
		flex-direction: column;
		gap: 0.5mm;
	}
	.creds dt {
		font-size: 7.5pt;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
		margin: 0;
		font-weight: 600;
	}
	.creds dd {
		margin: 0;
		font-size: 10pt;
		color: #0f172a;
		font-weight: 500;
	}
	.creds .mono {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.creds .url {
		color: var(--accent);
		font-weight: 600;
		font-size: 9.5pt;
		word-break: break-all;
	}
	.creds .password {
		font-size: 13pt;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #0f172a;
	}
	.qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5mm;
		padding: 2mm;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 2mm;
	}
	.qr :global(svg) {
		width: 28mm;
		height: 28mm;
		display: block;
	}
	.qr-caption {
		margin: 0;
		font-size: 7pt;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}

	/* ── How to sign in ── */
	.how {
		display: flex;
		flex-direction: column;
		gap: 2mm;
	}
	.how-title {
		margin: 0;
		font-size: 8pt;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
		font-weight: 600;
	}
	.how-list {
		margin: 0;
		padding-left: 5mm;
		font-size: 9pt;
		color: #334155;
		display: flex;
		flex-direction: column;
		gap: 1mm;
	}
	.how-list li::marker {
		color: var(--accent);
		font-weight: 700;
	}

	/* ── Tip box ── */
	.tip {
		padding: 3mm 4mm;
		border-left: 1mm solid var(--accent);
		background: color-mix(in srgb, var(--accent) 5%, white);
		border-radius: 0 2mm 2mm 0;
	}
	.tip-label {
		margin: 0 0 1mm;
		font-size: 7.5pt;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
		font-weight: 700;
	}
	.tip-body {
		margin: 0;
		font-size: 8.5pt;
		color: #334155;
		line-height: 1.4;
	}

	/* ── Footer ── */
	.slip-footer {
		margin-top: auto;
		padding-top: 3mm;
		border-top: 1px dashed #e2e8f0;
		display: flex;
		justify-content: space-between;
		gap: 4mm;
		font-size: 7.5pt;
		color: #64748b;
	}
	.footer-left p,
	.footer-right p {
		margin: 0;
		line-height: 1.4;
	}
	.footer-right {
		text-align: right;
	}
	.pin {
		font-weight: 600;
		color: #334155;
	}
	.slip-num {
		font-weight: 600;
		color: #334155;
	}

	/* ── Print rules ── */
	@media print {
		:global(body) {
			background: white !important;
		}
		:global(header, nav, aside.print-hide, .print-hide) {
			display: none !important;
		}
		.print-sheet {
			padding: 0;
			gap: 0;
		}
		.slip {
			margin: 0 0 5mm;
			page-break-after: auto;
		}
	}
	@page {
		size: A4;
		margin: 10mm;
	}
</style>
