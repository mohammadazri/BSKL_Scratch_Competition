<!--
	ScoresheetDetailPage — per-scoresheet drill-in.
	Rendered by /admin/scoresheets/[id] and /viewer/scoresheets/[id].

	Layout per DESIGN.md / TRACK_5_RESULTS.md:
	  • Back link
	  • Header card with participant, judge, sprint time, submitted-at
	  • Per-section criterion lists (level + points + comment + override badge)
	  • Total + super_admin-only action row (Override, Unlock)

	Viewer-role variant hides Override + Unlock entirely (read-only).
-->
<script lang="ts">
	import { ArrowLeft, Download, ShieldAlert, Unlock, MessageSquare, Printer } from '@lucide/svelte';
	import BrandHeader from '$lib/components/BrandHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import OverrideModal from '$lib/components/OverrideModal.svelte';
	import UnlockModal from './UnlockModal.svelte';
	import type { ScoresheetPageData } from '$lib/results/types';
	import type { PerfLevel } from '$lib/types';
	import type { RubricLevel } from '$lib/scoring';

	interface Props {
		data: ScoresheetPageData;
	}
	let { data }: Props = $props();

	const detail = $derived(data.detail);
	const role = $derived(data.role);

	// Override modal state — driven by clicking a criterion row.
	let overrideOpen = $state(false);
	let overrideCtx = $state<{
		criterionId: string;
		criterionName: string;
		maxPoints: number;
		levels: RubricLevel[];
		currentLevel: PerfLevel | null;
		currentPoints: number | null;
	} | null>(null);

	let unlockOpen = $state(false);

	function openOverride(line: {
		criterionId: string;
		criterionName: string;
		maxPoints: number;
		levelBands: RubricLevel[];
		level: PerfLevel | null;
		points: number | null;
	}) {
		if (role !== 'super_admin') return;
		overrideCtx = {
			criterionId: line.criterionId,
			criterionName: line.criterionName,
			maxPoints: line.maxPoints,
			levels: line.levelBands,
			currentLevel: line.level,
			currentPoints: line.points
		};
		overrideOpen = true;
	}

	function fmtTime(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function fmtTs(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString();
	}

	const backHref = $derived(
		role === 'super_admin' ? '/admin/results' : '/viewer/results'
	);

	const exportHref = $derived(
		detail
			? `/${role === 'super_admin' ? 'admin' : 'viewer'}/scoresheets/${detail.scoresheetId}/export`
			: '#'
	);

	const printReportHref = $derived(
		detail
			? `/admin/results/report/${detail.participantId}`
			: '#'
	);
</script>

{#if role !== 'super_admin'}
	<BrandHeader />
{/if}

<main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
	<a
		href={backHref}
		class="mb-4 inline-flex items-center gap-2 text-sm transition hover:underline"
		style="color: var(--color-text-2);"
	>
		<ArrowLeft size={14} strokeWidth={1.5} />
		Back to results
	</a>

	{#if data.loadError}
		<div
			class="rounded-[var(--radius)] border p-4 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			Failed to load scoresheet: {data.loadError}
		</div>
	{:else if !detail}
		<div
			class="rounded-[var(--radius)] border p-4 text-sm"
			style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-2);"
		>
			Scoresheet not found.
		</div>
	{:else}
		<!-- Header card -->
		<div
			class="mb-6 rounded-[var(--radius-lg)] border p-5 sm:p-6"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p
						class="text-[11px] font-medium tracking-[0.18em] uppercase"
						style="color: var(--color-text-2);"
					>
						Scoresheet
					</p>
					<h1
						class="mt-1 text-2xl font-semibold sm:text-3xl"
						style="font-family: var(--font-display); color: var(--color-text-1);"
					>
						{detail.participantName}
					</h1>
					<p class="mt-1 text-sm" style="color: var(--color-text-2);">
						{detail.schoolName} · Cat {detail.category}
						{#if detail.theme}· {detail.theme}{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<StatusPill status={detail.status} />
					{#if role === 'super_admin'}
						<a
							href={exportHref}
							download
							class="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:bg-[color:var(--accent-soft)]"
							style="border-color: var(--border); color: var(--color-text-1);"
						>
							<Download size={14} />
							Export CSV
						</a>
						<a
							href={printReportHref}
							target="_blank"
							class="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition"
							style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-1);"
						>
							<Printer size={14} />
							Print PDF
						</a>
					{/if}
				</div>
			</div>

			<dl
				class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-xs sm:grid-cols-4"
				style="border-color: var(--border);"
			>
				<div>
					<dt
						class="text-[10px] tracking-wider uppercase"
						style="color: var(--color-text-3);"
					>
						Judge
					</dt>
					<dd class="mt-0.5" style="color: var(--color-text-1);">
						{detail.judgeName}
					</dd>
				</div>
				<div>
					<dt
						class="text-[10px] tracking-wider uppercase"
						style="color: var(--color-text-3);"
					>
						Submitted
					</dt>
					<dd
						class="mt-0.5 font-mono tabular-nums"
						style="color: var(--color-text-1);"
					>
						{fmtTs(detail.submittedAt)}
					</dd>
				</div>
				<div>
					<dt
						class="text-[10px] tracking-wider uppercase"
						style="color: var(--color-text-3);"
					>
						Sprint time
					</dt>
					<dd
						class="mt-0.5 font-mono tabular-nums"
						style="color: var(--color-text-1);"
					>
						{fmtTime(detail.liveSprintTimeSeconds)}
					</dd>
				</div>
				<div>
					<dt
						class="text-[10px] tracking-wider uppercase"
						style="color: var(--color-text-3);"
					>
						Total
					</dt>
					<dd
						class="mt-0.5 font-mono text-base font-semibold tabular-nums"
						style="color: var(--color-text-1);"
					>
						{detail.totalPoints} / {detail.maxPoints}
					</dd>
				</div>
			</dl>
		</div>

		<!-- Sections -->
		{#snippet lineBody(line: import('$lib/results/types').ScoreLineItem, interactive: boolean)}
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium" style="color: var(--color-text-1);">
					{line.criterionName}
				</p>
				<p class="mt-0.5 text-xs" style="color: var(--color-text-2);">
					{line.level ?? 'Not scored'}
					{#if line.isOverride && line.overrideReason}
						<span
							class="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider"
							style="color: var(--color-danger);"
						>
							<ShieldAlert size={11} strokeWidth={2} />
							override
						</span>
					{/if}
				</p>
				{#if line.comment}
					<p
						class="mt-1 flex items-start gap-1 text-xs"
						style="color: var(--color-text-3);"
					>
						<MessageSquare
							size={11}
							strokeWidth={1.5}
							style="margin-top: 2px; flex-shrink: 0;"
						/>
						<span>{line.comment}</span>
					</p>
				{/if}
				{#if line.isOverride && line.overrideReason}
					<p
						class="mt-1 text-xs italic"
						style="color: var(--color-text-3);"
					>
						Override reason: {line.overrideReason}
					</p>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<span
					class="font-mono tabular-nums"
					style="color: var(--color-text-1);"
				>
					{line.points ?? '—'} / {line.maxPoints}
				</span>
				{#if interactive}
					<span
						class="text-[10px] uppercase tracking-wider"
						style="color: var(--color-text-3);"
					>
						click to override
					</span>
				{/if}
			</div>
		{/snippet}

		<div class="space-y-6">
			{#each detail.sections as section (section.section)}
				<Card label="{section.label} — {section.subtotal} / {section.maxSubtotal}">
					<ul class="divide-y" style="color: var(--color-text-1);">
						{#each section.scores as line (line.criterionId)}
							{@const interactive = role === 'super_admin'}
							<li
								class="border-b py-0 last:border-b-0"
								style="border-color: var(--border);"
							>
								{#if interactive}
									<button
										type="button"
										class="flex w-full flex-wrap items-start justify-between gap-3 py-3 text-left transition hover:bg-[color:var(--accent-soft)]"
										onclick={() => openOverride(line)}
									>
										{@render lineBody(line, true)}
									</button>
								{:else}
									<div class="flex flex-wrap items-start justify-between gap-3 py-3">
										{@render lineBody(line, false)}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</Card>
			{/each}
		</div>

		<!-- Footer total + actions -->
		<div
			class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<div>
				<p
					class="text-[11px] font-medium tracking-[0.18em] uppercase"
					style="color: var(--color-text-2);"
				>
					Total
				</p>
				<p
					class="mt-0.5 text-2xl font-semibold tabular-nums"
					style="font-family: var(--font-display); color: var(--color-text-1);"
				>
					{detail.totalPoints} / {detail.maxPoints}
				</p>
			</div>
			{#if role === 'super_admin'}
				<div class="flex items-center gap-2">
					<Button
						variant="secondary"
						onclick={() => (unlockOpen = true)}
						disabled={detail.status === 'draft'}
					>
						{#snippet icon()}
							<Unlock size={14} strokeWidth={1.5} />
						{/snippet}
						Unlock to draft
					</Button>
				</div>
			{/if}
		</div>

		<!-- Override modal -->
		{#if overrideCtx}
			<OverrideModal
				bind:open={overrideOpen}
				criterionId={overrideCtx.criterionId}
				criterionName={overrideCtx.criterionName}
				maxPoints={overrideCtx.maxPoints}
				levels={overrideCtx.levels}
				currentLevel={overrideCtx.currentLevel}
				currentPoints={overrideCtx.currentPoints}
				currentJudgeName={detail.judgeName}
			/>
		{/if}

		<!-- Unlock — inline form inside its own modal so we can require a reason. -->
		<UnlockModal bind:open={unlockOpen} />
	{/if}
</main>
