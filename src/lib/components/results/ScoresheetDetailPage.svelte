<!--
	ScoresheetDetailPage — body for /admin/scoresheets/[id] and
	/viewer/scoresheets/[id].

	The layout is identical between admin and viewer; the only difference is
	whether the Override + Unlock buttons render. We branch on `data.role`.

	Form actions live on the page (?/override, ?/unlock); this component just
	posts to them via enhance.
-->
<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Download, ShieldAlert, Unlock, ArrowLeft, MessageSquare } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import OverrideModal from '$lib/components/OverrideModal.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import { toasts } from '$lib/stores/toast';
	import type { ScoresheetPageData, ScoreLineItem } from '$lib/results/types';

	interface Props {
		data: ScoresheetPageData;
	}

	let { data }: Props = $props();

	const backHref = $derived(data.role === 'super_admin' ? '/admin/results' : '/viewer/results');
	const exportHref = $derived(
		data.detail
			? `/${data.role === 'super_admin' ? 'admin' : 'viewer'}/scoresheets/${data.detail.scoresheetId}/export`
			: '#'
	);

	// ─── Override modal state ─────────────────────────────────────────────────
	let overrideOpen = $state(false);
	let activeCriterion = $state<ScoreLineItem | null>(null);

	function openOverride(item: ScoreLineItem) {
		if (data.role !== 'super_admin') return;
		activeCriterion = item;
		overrideOpen = true;
	}

	// ─── Unlock modal ─────────────────────────────────────────────────────────
	let unlockOpen = $state(false);
	let unlockReason = $state('');
	let unlockSubmitting = $state(false);
	let unlockError = $state<string | null>(null);

	function fmtSprint(seconds: number | null): string {
		if (seconds == null) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function fmtTime(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}
</script>

<svelte:head>
	<title>
		{data.detail
			? `${data.detail.participantName} · Scoresheet`
			: 'Scoresheet'} · P3 Judging
	</title>
</svelte:head>

<button
	type="button"
	class="mb-4 inline-flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase transition hover:opacity-80"
	style="color: var(--color-text-2);"
	onclick={() => goto(backHref)}
>
	<ArrowLeft size={14} strokeWidth={1.5} />
	Back to results
</button>

{#if data.loadError}
	<div
		class="mb-4 rounded-[var(--radius)] border p-4 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		{data.loadError}
	</div>
{/if}

{#if data.detail}
	{@const d = data.detail}

	<PageHeader
		title={d.participantName}
		subtitle="{d.schoolName} · Category {d.category} · {d.theme ?? 'Theme not set'}"
		breadcrumb="Scoresheet"
	>
		{#snippet actions()}
			<Button variant="secondary" href={exportHref}>
				{#snippet icon()}
					<Download size={16} strokeWidth={1.5} />
				{/snippet}
				Export CSV
			</Button>
			{#if data.role === 'super_admin' && d.status !== 'draft'}
				<Button variant="ghost" onclick={() => (unlockOpen = true)}>
					{#snippet icon()}
						<Unlock size={16} strokeWidth={1.5} />
					{/snippet}
					Unlock
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Header card -->
	<Card label="Submission">
		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 text-sm">
			<div>
				<p class="text-[11px] uppercase tracking-wider" style="color: var(--color-text-2);">
					Judge
				</p>
				<p class="mt-1" style="color: var(--color-text-1);">{d.judgeName}</p>
				<p class="text-xs" style="color: var(--color-text-3);">{d.judgeEmail}</p>
			</div>
			<div>
				<p class="text-[11px] uppercase tracking-wider" style="color: var(--color-text-2);">
					Status
				</p>
				<div class="mt-1"><StatusPill status={d.status} /></div>
			</div>
			<div>
				<p class="text-[11px] uppercase tracking-wider" style="color: var(--color-text-2);">
					Submitted
				</p>
				<p
					class="mt-1 tabular-nums"
					style="color: var(--color-text-1); font-family: var(--font-mono);"
				>
					{fmtTime(d.submittedAt)}
				</p>
			</div>
			<div>
				<p class="text-[11px] uppercase tracking-wider" style="color: var(--color-text-2);">
					Sprint time
				</p>
				<p
					class="mt-1 tabular-nums"
					style="color: var(--color-text-1); font-family: var(--font-mono);"
				>
					{fmtSprint(d.liveSprintTimeSeconds)}
				</p>
			</div>
			<div>
				<p class="text-[11px] uppercase tracking-wider" style="color: var(--color-text-2);">
					Category
				</p>
				<div class="mt-1 flex items-center gap-2">
					<CategoryChip category={d.category} size="md" />
					<span style="color: var(--color-text-2);">{d.theme ?? '—'}</span>
				</div>
			</div>
		</div>
	</Card>

	<!-- Sections of criteria -->
	{#each d.sections as section (section.section)}
		<div class="mt-6">
			<Card label={section.label}>
				<div class="divide-y" style="border-color: var(--border);">
					{#each section.scores as item (item.criterionId)}
						<div
							class="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4"
							style="border-color: var(--border);"
						>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<p
										class="font-medium"
										style="color: var(--color-text-1);"
									>
										{item.criterionName}
									</p>
									{#if item.isOverride}
										<span
											class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
											style="background: rgba(239,68,68,0.15); color: var(--color-danger);"
											title={item.overrideReason ?? 'Overridden by super_admin'}
										>
											<ShieldAlert size={10} strokeWidth={2} />
											override
										</span>
									{/if}
								</div>
								<p
									class="mt-1 text-xs"
									style="color: var(--color-text-2);"
								>
									{item.level ?? 'Not scored'} · max {item.maxPoints} pts
								</p>
								{#if item.comment}
									<div
										class="mt-2 flex items-start gap-2 rounded-[var(--radius-sm)] border p-2 text-xs"
										style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-2);"
									>
										<MessageSquare
											size={12}
											strokeWidth={1.5}
											style="flex-shrink: 0; margin-top: 2px;"
										/>
										<span>{item.comment}</span>
									</div>
								{/if}
								{#if item.isOverride && item.overrideReason}
									<p
										class="mt-2 text-xs italic"
										style="color: var(--color-danger);"
									>
										Override reason: {item.overrideReason}
									</p>
								{/if}
							</div>
							<div class="flex items-center gap-3 sm:flex-col sm:items-end">
								<p
									class="text-base tabular-nums whitespace-nowrap"
									style="color: var(--color-text-1); font-family: var(--font-mono);"
								>
									<span class="font-semibold">{item.points ?? '—'}</span>
									<span style="color: var(--color-text-3);"> / {item.maxPoints}</span>
								</p>
								{#if data.role === 'super_admin'}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => openOverride(item)}
									>
										{#snippet icon()}
											<ShieldAlert size={14} strokeWidth={1.5} />
										{/snippet}
										Override
									</Button>
								{/if}
							</div>
						</div>
					{/each}

					<div
						class="flex items-center justify-between py-3 text-sm"
						style="border-color: var(--border);"
					>
						<span style="color: var(--color-text-2);">Section subtotal</span>
						<span
							class="tabular-nums"
							style="color: var(--color-text-1); font-family: var(--font-mono);"
						>
							{section.subtotal} / {section.maxSubtotal}
						</span>
					</div>
				</div>
			</Card>
		</div>
	{/each}

	<!-- Total -->
	<div class="mt-6">
		<Card>
			<div class="flex items-center justify-between">
				<p
					class="text-sm font-semibold tracking-wider uppercase"
					style="color: var(--color-text-2);"
				>
					Total
				</p>
				<p
					class="text-3xl font-bold tabular-nums"
					style="color: var(--color-text-1); font-family: var(--font-display);"
				>
					{d.totalPoints}
					<span class="text-base font-normal" style="color: var(--color-text-3);">
						/ {d.maxPoints}
					</span>
				</p>
			</div>
		</Card>
	</div>

	<!-- Override modal -->
	{#if activeCriterion && data.role === 'super_admin'}
		<OverrideModal
			bind:open={overrideOpen}
			criterionId={activeCriterion.criterionId}
			criterionName={activeCriterion.criterionName}
			maxPoints={activeCriterion.maxPoints}
			levels={activeCriterion.levelBands}
			currentLevel={activeCriterion.level}
			currentPoints={activeCriterion.points}
			currentJudgeName={d.judgeName}
			onsuccess={() => invalidateAll()}
		/>
	{/if}

	<!-- Unlock modal -->
	{#if data.role === 'super_admin'}
		<Modal bind:open={unlockOpen} title="Unlock scoresheet" size="md">
			<form
				id="unlock-form"
				method="POST"
				action="?/unlock"
				use:enhance={({ formData, cancel }) => {
					const trimmed = String(formData.get('reason') ?? '').trim();
					if (!trimmed) {
						unlockError = 'A reason is required.';
						cancel();
						return;
					}
					unlockSubmitting = true;
					unlockError = null;
					return async ({ result, update }) => {
						unlockSubmitting = false;
						if (result.type === 'failure') {
							unlockError =
								(result.data as { unlockError?: string } | undefined)?.unlockError ??
								'Unlock failed.';
							return;
						}
						if (result.type === 'error') {
							unlockError = result.error?.message ?? 'Unlock failed.';
							return;
						}
						toasts.success('Scoresheet unlocked — judge can re-edit.');
						unlockOpen = false;
						unlockReason = '';
						await update();
					};
				}}
			>
				<p class="mb-3 text-sm" style="color: var(--color-text-2);">
					Unlocking sets the scoresheet status back to <code>draft</code> so the judge
					can re-edit it. The change is captured in the audit log.
				</p>
				<Textarea
					label="Reason"
					name="reason"
					required
					bind:value={unlockReason}
					rows={3}
					placeholder="Why is this being unlocked?"
					error={unlockError ?? undefined}
				/>
			</form>

			{#snippet footer()}
				<Button
					variant="ghost"
					type="button"
					onclick={() => (unlockOpen = false)}
					disabled={unlockSubmitting}
				>
					Cancel
				</Button>
				<button
					type="submit"
					form="unlock-form"
					disabled={unlockSubmitting}
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					style="background: var(--color-warning); color: white; border: 1px solid var(--color-warning);"
				>
					<Unlock size={16} strokeWidth={1.5} />
					Unlock
				</button>
			{/snippet}
		</Modal>
	{/if}
{/if}
