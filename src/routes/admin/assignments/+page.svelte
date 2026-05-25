<!--
	/admin/assignments — matrix view, tabs per category, auto-assign button.
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
	import { Sparkles, Workflow } from 'lucide-svelte';
	import type { PageData } from './$types';
	import type { Category } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let tab = $state<Category>('A');
	let pending = $state<Set<string>>(new Set());
	let banner = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	// Auto-assign preview state
	let previewOpen = $state(false);
	let previewLoading = $state(false);
	let previewBuckets = $state<PreviewBucket[]>([]);
	let previewEligible = $state<string[]>([]);
	let previewMaxPerSchool = $state(3);
	let applying = $state(false);

	function judgesForTab(cat: Category) {
		return data.judges.filter((j) => j.categories.includes(cat));
	}

	function participantsForTab(cat: Category) {
		return data.participants.filter((p) => p.category === cat);
	}

	function judgeLoads(cat: Category) {
		const tabJudges = judgesForTab(cat);
		const parts = participantsForTab(cat);
		const counts = new Map<string, number>();
		for (const p of parts) {
			if (p.assignedJudgeId) {
				counts.set(p.assignedJudgeId, (counts.get(p.assignedJudgeId) ?? 0) + 1);
			}
		}
		return tabJudges.map((j) => ({
			id: j.id,
			name: j.name,
			load: counts.get(j.id) ?? 0
		}));
	}

	async function handleAssign(participantId: string, judgeId: string | null) {
		pending = new Set(pending).add(participantId);
		const fd = new FormData();
		fd.set('participant_id', participantId);
		if (judgeId) fd.set('judge_id', judgeId);
		const res = await fetch('?/swap', { method: 'POST', body: fd });
		await invalidateAll();
		const next = new Set(pending);
		next.delete(participantId);
		pending = next;
		if (!res.ok) {
			banner = { kind: 'error', text: 'Swap failed.' };
		}
	}

	async function openPreview() {
		previewLoading = true;
		banner = null;
		const res = await fetch('/admin/assignments/auto', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ category: tab, maxPerSchool: previewMaxPerSchool })
		});
		const j = await res.json();
		previewLoading = false;
		if (!res.ok) {
			banner = { kind: 'error', text: j.error ?? 'Auto-assign failed.' };
			return;
		}
		previewBuckets = j.buckets;
		previewEligible = j.eligibleJudgeNames;
		previewOpen = true;
	}

	async function commitPreview() {
		applying = true;
		const res = await fetch('/admin/assignments/auto/commit', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				buckets: previewBuckets.map((b) => ({
					judge_id: b.judge_id,
					participant_ids: b.participant_ids
				}))
			})
		});
		const j = await res.json();
		applying = false;
		previewOpen = false;
		if (!res.ok) {
			banner = { kind: 'error', text: j.error ?? 'Commit failed.' };
			return;
		}
		banner = {
			kind: 'success',
			text: `Auto-assigned ${j.inserted} participant${j.inserted === 1 ? '' : 's'} for category ${tab}.`
		};
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Assignments · P3 Judging</title>
</svelte:head>

<PageHeader title="Assignments" subtitle="One row per participant, one column per judge.">
	{#snippet actions()}
		<Button variant="primary" onclick={openPreview} loading={previewLoading}>
			{#snippet icon()}<Sparkles size={16} strokeWidth={1.5} />{/snippet}
			Auto-assign {tab}
		</Button>
	{/snippet}
</PageHeader>

{#if banner}
	<div
		class="mb-4 rounded-(--radius) border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: {banner.kind === 'success'
			? 'var(--color-success)'
			: 'var(--color-danger)'}; color: {banner.kind === 'success'
			? 'var(--color-success)'
			: 'var(--color-danger)'};"
	>
		{banner.text}
	</div>
{/if}

<!-- Category tabs -->
<div class="mb-4 flex gap-2">
	{#each ['A', 'B', 'C'] as Category[] as cat (cat)}
		{@const active = tab === cat}
		<button
			type="button"
			class="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition"
			style="background: {active
				? 'var(--accent-soft)'
				: 'var(--color-bg-2)'}; border-color: {active
				? 'var(--color-accent)'
				: 'var(--border)'}; color: {active ? 'var(--color-accent)' : 'var(--color-text-1)'};"
			onclick={() => (tab = cat)}
			aria-pressed={active}
		>
			Category {cat}
			<span class="text-xs" style="color: var(--color-text-2);">
				{participantsForTab(cat).length}
			</span>
		</button>
	{/each}
</div>

{#if data.judges.length === 0}
	<EmptyState
		icon={Workflow}
		title="No active judges"
		description="Create at least one active judge before assigning participants."
	>
		{#snippet action()}
			<Button variant="primary" href="/admin/users">Manage users</Button>
		{/snippet}
	</EmptyState>
{:else if participantsForTab(tab).length === 0}
	<EmptyState
		icon={Workflow}
		title="No participants in category {tab}"
		description="Add participants on the Participants page or via CSV import."
	>
		{#snippet action()}
			<Button variant="primary" href="/admin/participants">Manage participants</Button>
		{/snippet}
	</EmptyState>
{:else}
	<AssignmentMatrix
		judges={judgeLoads(tab)}
		participants={participantsForTab(tab).map((p) => ({
			id: p.id,
			name: p.name,
			school: p.school,
			assignedJudgeId: p.assignedJudgeId
		}))}
		onassign={handleAssign}
		{pending}
	/>

	<p class="mt-3 text-xs" style="color: var(--color-text-3);">
		Click any cell to assign; click the filled dot again to clear. Changes save instantly and are
		audit-logged.
	</p>
{/if}

<AutoAssignPreview
	bind:open={previewOpen}
	category={tab}
	eligibleJudgeNames={previewEligible}
	buckets={previewBuckets}
	maxPerSchool={previewMaxPerSchool}
	{applying}
	onapply={commitPreview}
	oncancel={() => (previewOpen = false)}
/>
