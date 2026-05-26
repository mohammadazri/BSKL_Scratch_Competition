<!--
	/admin/requests — super-admin approval queue. Two kinds of requests:
	  1. Edit-access requests on locked scoresheets
	  2. Disqualification requests raised by judges
	Both render as cards with Approve / Deny actions and a resolved-history list.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { CheckCircle2, XCircle, Inbox, Ban } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';
	import type { EditRequestRow, DqRequestRow } from './+page.server';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const pending = $derived(data.rows.filter((r) => r.status === 'pending'));
	const resolved = $derived(data.rows.filter((r) => r.status !== 'pending'));
	const dqPending = $derived(data.dqRows.filter((r) => r.status === 'pending'));
	const dqResolved = $derived(data.dqRows.filter((r) => r.status !== 'pending'));

	let acting = $state<EditRequestRow | null>(null);
	let action = $state<'approve' | 'deny'>('approve');
	let note = $state('');
	let submitting = $state(false);

	// Separate state for the disqualification confirm modal so the two
	// approval flows don't fight over the same variable.
	let dqActing = $state<DqRequestRow | null>(null);
	let dqAction = $state<'approve' | 'deny'>('approve');
	let dqNote = $state('');
	let dqSubmitting = $state(false);

	function openDq(r: DqRequestRow, kind: 'approve' | 'deny') {
		dqActing = r;
		dqAction = kind;
		dqNote = '';
	}

	function open(r: EditRequestRow, kind: 'approve' | 'deny') {
		acting = r;
		action = kind;
		note = '';
	}

	function lockLabel(lock: EditRequestRow['currentLock']): string {
		if (lock === 'section_a') return 'Section A locked';
		if (lock === 'submitted') return 'Final submission locked';
		return 'No lock (already open)';
	}

	function fmt(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return d.toLocaleString();
	}
</script>

<svelte:head>
	<title>Edit requests · P3 Judging</title>
</svelte:head>

<PageHeader
	title="Edit requests"
	subtitle="Judges asking for permission to edit a locked scoresheet. Approve to unlock; deny if you want them to live with the existing scores."
/>

{#if form?.message}
	<div
		class="mb-4 rounded-md border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-success); color: var(--color-success);"
	>
		{form.message}
	</div>
{:else if form?.error}
	<div
		class="mb-4 rounded-md border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		{form.error}
	</div>
{/if}

<!-- Pending -->
<Card label="Edit requests · pending ({pending.length})">
	{#if pending.length === 0}
		<div class="flex flex-col items-center gap-2 py-8" style="color: var(--color-text-2);">
			<Inbox size={28} strokeWidth={1.5} />
			<p class="text-sm">No pending requests right now.</p>
		</div>
	{:else}
		<ul class="flex flex-col divide-y" style="--tw-divide-opacity: 1; border-color: var(--border);">
			{#each pending as r (r.id)}
				<li class="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="rounded px-2 py-0.5 text-[11px] font-semibold"
								style="background: var(--accent-soft); color: var(--color-accent); font-family: var(--font-mono);"
							>
								CAT {r.participantCategory}
							</span>
							<p class="text-sm font-medium" style="color: var(--color-text-1);">
								{r.participantName}
							</p>
							<span
								class="text-[11px]"
								style="color: var(--color-text-3); font-family: var(--font-mono);"
							>
								{lockLabel(r.currentLock)}
							</span>
						</div>
						<p class="mt-1 text-xs" style="color: var(--color-text-2);">
							by <strong style="color: var(--color-text-1);">{r.judgeName}</strong>
							<span style="font-family: var(--font-mono);">· {r.judgeEmail}</span>
							<span style="color: var(--color-text-3);">· {fmt(r.createdAt)}</span>
						</p>
						<p
							class="mt-2 rounded-md border-l-2 p-2 text-sm whitespace-pre-wrap"
							style="border-color: var(--color-accent-2); background: var(--color-bg-3); color: var(--color-text-1);"
						>
							{r.reason}
						</p>
					</div>
					<div class="flex gap-2 lg:flex-col">
						<Button variant="primary" onclick={() => open(r, 'approve')}>
							{#snippet icon()}<CheckCircle2 size={16} strokeWidth={1.5} />{/snippet}
							Approve
						</Button>
						<Button variant="ghost" onclick={() => open(r, 'deny')}>
							{#snippet icon()}<XCircle size={16} strokeWidth={1.5} />{/snippet}
							Deny
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Card>

<!-- Pending disqualifications -->
<div class="mt-6">
	<Card label="Disqualification requests · pending ({dqPending.length})">
		{#if dqPending.length === 0}
			<div class="flex flex-col items-center gap-2 py-8" style="color: var(--color-text-2);">
				<Ban size={28} strokeWidth={1.5} />
				<p class="text-sm">No pending disqualification requests.</p>
			</div>
		{:else}
			<ul class="flex flex-col divide-y" style="border-color: var(--border);">
				{#each dqPending as r (r.id)}
					<li class="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span
									class="rounded px-2 py-0.5 text-[11px] font-semibold"
									style="background: var(--accent-soft); color: var(--color-accent); font-family: var(--font-mono);"
								>
									CAT {r.participantCategory}
								</span>
								<p class="text-sm font-medium" style="color: var(--color-text-1);">
									{r.participantName}
								</p>
								<span
									class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
									style="background: rgba(239, 68, 68, 0.14); color: var(--color-danger);"
								>
									{r.reason.replaceAll('_', ' ')}
								</span>
							</div>
							<p class="mt-1 text-xs" style="color: var(--color-text-2);">
								by <strong style="color: var(--color-text-1);">{r.judgeName}</strong>
								<span style="color: var(--color-text-3);">· {fmt(r.createdAt)}</span>
							</p>
							<p
								class="mt-2 rounded-md border-l-2 p-2 text-sm whitespace-pre-wrap"
								style="border-color: var(--color-danger); background: var(--color-bg-3); color: var(--color-text-1);"
							>
								{r.notes}
							</p>
						</div>
						<div class="flex gap-2 lg:flex-col">
							<Button variant="danger" onclick={() => openDq(r, 'approve')}>
								{#snippet icon()}<Ban size={16} strokeWidth={1.5} />{/snippet}
								Disqualify
							</Button>
							<Button variant="ghost" onclick={() => openDq(r, 'deny')}>
								{#snippet icon()}<XCircle size={16} strokeWidth={1.5} />{/snippet}
								Reject request
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

{#if dqResolved.length > 0}
	<div class="mt-6">
		<Card label="Disqualification decisions">
			<ul class="flex flex-col divide-y" style="border-color: var(--border);">
				{#each dqResolved as r (r.id)}
					<li class="py-2.5 text-xs">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
								style="background: {r.status === 'approved'
									? 'rgba(239, 68, 68, 0.14)'
									: r.status === 'denied'
										? 'rgba(16, 185, 129, 0.14)'
										: 'rgba(100, 116, 139, 0.14)'}; color: {r.status === 'approved'
									? 'var(--color-danger)'
									: r.status === 'denied'
										? 'var(--color-success)'
										: 'var(--color-text-2)'};"
							>
								{r.status}
							</span>
							<span style="color: var(--color-text-1);">{r.participantName}</span>
							<span style="color: var(--color-text-3);">·</span>
							<span style="color: var(--color-text-2);">by {r.judgeName}</span>
							<span style="color: var(--color-text-3); font-family: var(--font-mono);">
								· {fmt(r.approvedAt ?? r.deniedAt)}
							</span>
						</div>
						{#if r.resolutionNote}
							<p class="mt-1 ml-1" style="color: var(--color-text-2);">{r.resolutionNote}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</Card>
	</div>
{/if}

<!-- Resolved history -->
{#if resolved.length > 0}
	<div class="mt-6">
		<Card label="Recent decisions">
			<ul class="flex flex-col divide-y" style="border-color: var(--border);">
				{#each resolved as r (r.id)}
					<li class="py-2.5 text-xs">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
								style="background: {r.status === 'approved'
									? 'rgba(16, 185, 129, 0.14)'
									: 'rgba(239, 68, 68, 0.14)'}; color: {r.status === 'approved'
									? 'var(--color-success)'
									: 'var(--color-danger)'};"
							>
								{r.status}
							</span>
							<span style="color: var(--color-text-1);">{r.participantName}</span>
							<span style="color: var(--color-text-3);">·</span>
							<span style="color: var(--color-text-2);">by {r.judgeName}</span>
							<span style="color: var(--color-text-3); font-family: var(--font-mono);">
								· {fmt(r.resolvedAt)}
							</span>
						</div>
						{#if r.resolvedNote}
							<p class="mt-1 ml-1" style="color: var(--color-text-2);">{r.resolvedNote}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</Card>
	</div>
{/if}

<!-- Approve / Deny modal -->
<Modal
	open={!!acting}
	title={action === 'approve' ? 'Approve edit request' : 'Deny edit request'}
	onClose={() => (acting = null)}
>
	{#if acting}
		<form
			method="POST"
			action={action === 'approve' ? '?/approve' : '?/deny'}
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
					acting = null;
					note = '';
					await invalidateAll();
				};
			}}
			class="flex flex-col gap-4"
		>
			<input type="hidden" name="id" value={acting.id} />
			<p class="text-sm" style="color: var(--color-text-2);">
				{#if action === 'approve'}
					This unlocks <strong style="color: var(--color-text-1);">{acting.participantName}</strong>'s
					scoresheet for <strong style="color: var(--color-text-1);">{acting.judgeName}</strong>.
					{#if acting.currentLock === 'section_a'}
						Section A becomes editable until they re-submit.
					{:else if acting.currentLock === 'submitted'}
						The whole scoresheet flips back to draft. They'll need to re-submit when done.
					{/if}
				{:else}
					Deny <strong style="color: var(--color-text-1);">{acting.judgeName}</strong>'s request to
					edit <strong style="color: var(--color-text-1);">{acting.participantName}</strong>'s
					scoresheet. The judge sees the denial reason on their next page load.
				{/if}
			</p>
			<div
				class="rounded-md border-l-2 p-2 text-xs whitespace-pre-wrap"
				style="border-color: var(--color-accent-2); background: var(--color-bg-3); color: var(--color-text-2);"
			>
				<strong style="color: var(--color-text-1);">Their reason:</strong>
				<br />
				{acting.reason}
			</div>
			<label class="block">
				<span
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);">Note (optional)</span
				>
				<textarea
					name="note"
					maxlength="1000"
					rows="3"
					bind:value={note}
					placeholder={action === 'approve'
						? 'e.g. Approved — please correct criterion 3 and re-submit by 14:00.'
						: 'e.g. The decision stands; we already double-checked at the desk.'}
					class="w-full rounded-md border p-2 text-sm"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				></textarea>
			</label>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={() => (acting = null)}
					class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
					style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting}
					class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold uppercase disabled:opacity-40"
					style="background: {action === 'approve'
						? 'var(--color-accent)'
						: 'var(--color-danger)'}; color: #fff;"
				>
					{submitting ? 'Saving…' : action === 'approve' ? 'Approve' : 'Deny'}
				</button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Approve / Deny disqualification modal -->
<Modal
	open={!!dqActing}
	title={dqAction === 'approve' ? 'Confirm disqualification' : 'Reject disqualification request'}
	onClose={() => (dqActing = null)}
>
	{#if dqActing}
		<form
			method="POST"
			action={dqAction === 'approve' ? '?/approveDq' : '?/denyDq'}
			use:enhance={() => {
				dqSubmitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					dqSubmitting = false;
					dqActing = null;
					dqNote = '';
					await invalidateAll();
				};
			}}
			class="flex flex-col gap-4"
		>
			<input type="hidden" name="id" value={dqActing.id} />
			<p class="text-sm" style="color: var(--color-text-2);">
				{#if dqAction === 'approve'}
					This will <strong style="color: var(--color-danger);">disqualify</strong>
					<strong style="color: var(--color-text-1);">{dqActing.participantName}</strong>
					(Category {dqActing.participantCategory}). They are removed from the leaderboard
					but their scoresheet stays in the audit trail.
				{:else}
					Reject the request raised by
					<strong style="color: var(--color-text-1);">{dqActing.judgeName}</strong>.
					The participant remains qualified.
				{/if}
			</p>
			<div
				class="rounded-md border-l-2 p-2 text-xs whitespace-pre-wrap"
				style="border-color: var(--color-danger); background: var(--color-bg-3); color: var(--color-text-2);"
			>
				<strong style="color: var(--color-text-1);">Reason:</strong>
				{dqActing.reason.replaceAll('_', ' ')}
				<br /><br />
				<strong style="color: var(--color-text-1);">Notes:</strong><br />
				{dqActing.notes}
			</div>
			<label class="block">
				<span
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);">Decision note (optional)</span
				>
				<textarea
					name="note"
					maxlength="1000"
					rows="3"
					bind:value={dqNote}
					placeholder={dqAction === 'approve'
						? 'e.g. Confirmed at the desk — uses AI tutorial output.'
						: 'e.g. Insufficient evidence. Re-judged manually.'}
					class="w-full rounded-md border p-2 text-sm"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				></textarea>
			</label>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={() => (dqActing = null)}
					class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
					style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={dqSubmitting}
					class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold uppercase disabled:opacity-40"
					style="background: {dqAction === 'approve'
						? 'var(--color-danger)'
						: 'var(--color-bg-3)'}; color: {dqAction === 'approve' ? '#fff' : 'var(--color-text-1)'};"
				>
					{dqSubmitting
						? 'Saving…'
						: dqAction === 'approve'
							? 'Confirm disqualification'
							: 'Reject'}
				</button>
			</div>
		</form>
	{/if}
</Modal>
