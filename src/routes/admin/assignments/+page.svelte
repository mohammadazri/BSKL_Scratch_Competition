<!--
	/admin/assignments — category-tabbed matrix view.
	Click cell to swap a single participant's judge; Auto-assign button shows
	the preview modal then commits on Apply.
-->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import AssignmentMatrix from '$lib/components/AssignmentMatrix.svelte';
	import AutoAssignPreview, {
		type PreviewBucket
	} from '$lib/components/AutoAssignPreview.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import { toasts } from '$lib/stores/toast';
	import { Shuffle } from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { Category } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let activeCategory = $state<Category>('A');
	const categories: Category[] = ['A', 'B', 'C'];

	const participantsForCat = $derived(data.byCategory[activeCategory]);
	const judgesForCat = $derived(
		data.judges.filter((j) => j.categories.includes(activeCategory))
	);

	const judgeColumns = $derived(
		judgesForCat.map((j) => ({
			id: j.id,
			name: j.fullName,
			load: participantsForCat.filter((p) => p.assignedJudgeId === j.id).length
		}))
	);

	let pending = $state<Set<string>>(new Set());

	async function swap(participantId: string, judgeId: string | null) {
		pending = new Set([...pending, participantId]);
		try {
			const fd = new FormData();
			fd.set('participant_id', participantId);
			fd.set('judge_id', judgeId ?? '');
			const res = await fetch('?/swap', { method: 'POST', body: fd });
			if (!res.ok) {
				toasts.error('Failed to update assignment.');
				return;
			}
			await invalidateAll();
		} finally {
			const next = new Set(pending);
			next.delete(participantId);
			pending = next;
		}
	}

	// ─── Auto-assign flow ────────────────────────────────────────
	let previewOpen = $state(false);
	let previewBuckets = $state<PreviewBucket[]>([]);
	let previewEligible = $state<string[]>([]);
	let previewMax = $state(3);
	let applying = $state(false);
	let runningAuto = $state(false);

	async function runAuto() {
		runningAuto = true;
		try {
			const res = await fetch('/admin/assignments/auto', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ category: activeCategory, maxPerSchool: 3 })
			});
			const body = (await res.json()) as {
				ok: boolean;
				error?: string;
				buckets?: PreviewBucket[];
				eligibleJudgeNames?: string[];
				maxPerSchool?: number;
			};
			if (!body.ok) {
				toasts.error(body.error ?? 'Auto-assign failed.');
				return;
			}
			previewBuckets = body.buckets ?? [];
			previewEligible = body.eligibleJudgeNames ?? [];
			previewMax = body.maxPerSchool ?? 3;
			previewOpen = true;
		} finally {
			runningAuto = false;
		}
	}

	async function applyAuto() {
		applying = true;
		try {
			const res = await fetch('/admin/assignments/auto/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buckets: previewBuckets.map((b) => ({
						judge_id: b.judge_id,
						participant_ids: b.participant_ids
					}))
				})
			});
			const body = (await res.json()) as { ok: boolean; error?: string; created?: number };
			if (!body.ok) {
				toasts.error(body.error ?? 'Commit failed.');
				return;
			}
			toasts.success(`Assigned ${body.created} participants for Category ${activeCategory}.`);
			previewOpen = false;
			await invalidateAll();
		} finally {
			applying = false;
		}
	}
</script>

<svelte:head>
	<title>Assignments · P3 Judging</title>
</svelte:head>

<PageHeader title="Assignments" subtitle="Map each participant to their primary judge.">
	{#snippet actions()}
		<Button
			variant="primary"
			onclick={runAuto}
			loading={runningAuto}
			disabled={participantsForCat.length === 0 || judgesForCat.length === 0}
		>
			{#snippet icon()}<Shuffle size={16} strokeWidth={1.5} />{/snippet}
			Auto-assign Cat {activeCategory}
		</Button>
	{/snippet}
</PageHeader>

<div class="mb-4 flex items-center gap-2">
	{#each categories as c (c)}
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium"
			style="background: {activeCategory === c
				? 'var(--accent-soft)'
				: 'transparent'}; border-color: {activeCategory === c
				? 'var(--color-accent)'
				: 'var(--border)'}; color: var(--color-text-1);"
			onclick={() => (activeCategory = c)}
		>
			<CategoryChip category={c} />
			Cat {c}
			<span class="text-xs" style="color: var(--color-text-2); font-family: var(--font-mono);">
				{data.byCategory[c].length}
			</span>
		</button>
	{/each}
</div>

{#if judgesForCat.length === 0}
	<EmptyState
		title="No judges for Category {activeCategory}"
		description="Add a judge whose categories include {activeCategory} in /admin/users."
	>
		{#snippet action()}
			<Button variant="primary" href="/admin/users">Manage users</Button>
		{/snippet}
	</EmptyState>
{:else if participantsForCat.length === 0}
	<EmptyState
		title="No participants in Category {activeCategory}"
		description="Import or create participants for this category first."
	>
		{#snippet action()}
			<Button variant="primary" href="/admin/participants">Add participants</Button>
		{/snippet}
	</EmptyState>
{:else}
	<AssignmentMatrix
		judges={judgeColumns}
		participants={participantsForCat.map((p) => ({
			id: p.id,
			name: p.fullName,
			school: p.schoolName,
			assignedJudgeId: p.assignedJudgeId
		}))}
		onassign={swap}
		{pending}
	/>
{/if}

<AutoAssignPreview
	bind:open={previewOpen}
	category={activeCategory}
	eligibleJudgeNames={previewEligible}
	buckets={previewBuckets}
	maxPerSchool={previewMax}
	{applying}
	onapply={applyAuto}
	oncancel={() => (previewOpen = false)}
/>
