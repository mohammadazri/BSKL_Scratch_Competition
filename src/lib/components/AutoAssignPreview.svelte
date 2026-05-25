<!--
	AutoAssignPreview — TRACK_2_ADMIN.md /admin/assignments. Modal that shows
	the planned auto-assignment per judge BEFORE any DB writes. Apply commits.
-->
<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import type { Category } from '$lib/types';

	export interface PreviewBucket {
		judge_id: string;
		judge_name: string;
		participant_ids: string[];
		school_breakdown: { school_name: string; count: number }[];
	}

	interface Props {
		open: boolean;
		category: Category;
		eligibleJudgeNames: string[];
		buckets: PreviewBucket[];
		maxPerSchool: number;
		applying?: boolean;
		onapply?: () => void;
		oncancel?: () => void;
	}

	let {
		open = $bindable(false),
		category,
		eligibleJudgeNames,
		buckets,
		maxPerSchool,
		applying = false,
		onapply,
		oncancel
	}: Props = $props();

	let showDetails = $state(false);

	function cancel() {
		open = false;
		oncancel?.();
	}
</script>

<Modal bind:open title="Auto-assign — Category {category}" size="lg" onclose={cancel}>
	<p class="mb-1 text-sm" style="color: var(--color-text-2);">
		Algorithm: shuffle → round-robin → school-spread constraint (max {maxPerSchool} per school per
		judge)
	</p>
	<p class="mb-4 text-sm" style="color: var(--color-text-2);">
		Eligible judges: <strong style="color: var(--color-text-1);"
			>{eligibleJudgeNames.join(', ') || 'none'}</strong
		>
	</p>

	<div
		class="rounded-[var(--radius)] border"
		style="border-color: var(--border); background: var(--color-bg-1);"
	>
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr style="background: var(--color-bg-3);">
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Judge</th
					>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Participants</th
					>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Max one school</th
					>
				</tr>
			</thead>
			<tbody>
				{#each buckets as b (b.judge_id)}
					{@const maxOne = b.school_breakdown.reduce((m, s) => Math.max(m, s.count), 0)}
					<tr class="border-t" style="border-color: var(--border);">
						<td class="px-3 py-2.5" style="color: var(--color-text-1);">{b.judge_name}</td>
						<td
							class="px-3 py-2.5 text-right"
							style="font-family: var(--font-mono); color: var(--color-text-1);"
						>
							{b.participant_ids.length}
						</td>
						<td
							class="px-3 py-2.5 text-right"
							style="font-family: var(--font-mono); color: {maxOne > maxPerSchool
								? 'var(--color-warning)'
								: 'var(--color-text-2)'};"
						>
							{maxOne}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if showDetails}
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			{#each buckets as b (b.judge_id)}
				<div
					class="rounded-[var(--radius)] border p-3"
					style="background: var(--color-bg-1); border-color: var(--border);"
				>
					<p class="mb-2 text-sm font-semibold" style="color: var(--color-text-1);">
						{b.judge_name}
					</p>
					<ul class="text-xs" style="color: var(--color-text-2);">
						{#each b.school_breakdown as s (s.school_name)}
							<li class="flex justify-between">
								<span class="truncate">{s.school_name}</span>
								<span style="font-family: var(--font-mono);">{s.count}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}

	<button
		type="button"
		class="mt-4 text-xs underline-offset-4 hover:underline"
		style="color: var(--color-accent-2);"
		onclick={() => (showDetails = !showDetails)}
	>
		{showDetails ? 'Hide details' : 'Show details'}
	</button>

	{#snippet footer()}
		<Button variant="ghost" onclick={cancel}>Cancel</Button>
		<Button variant="primary" onclick={onapply} loading={applying}>Apply</Button>
	{/snippet}
</Modal>
