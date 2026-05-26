<!--
	/judge — judge queue.
	Lists every participant assigned to this judge with their scoresheet status
	and progress. Filter chips switch the visible status set; default sort puts
	not-started first so judges always see what's still to do.
-->
<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import type { PageData } from './$types';
	import type { QueueRow } from './+page.server';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();

	type FilterKey = 'all' | 'not_started' | 'draft' | 'submitted' | 'finalised';
	let filter = $state<FilterKey>('all');

	let filtered = $derived(
		filter === 'all' ? data.rows : data.rows.filter((r: QueueRow) => r.status === filter)
	);

	function actionLabel(r: QueueRow): string {
		if (r.status === 'not_started') return 'Start';
		if (r.status === 'draft') return 'Continue';
		if (r.status === 'finalised') return 'View (locked)';
		return 'View';
	}

	function counts(status: FilterKey): number {
		if (status === 'all') return data.rows.length;
		return data.rows.filter((r: QueueRow) => r.status === status).length;
	}

	const chips: { key: FilterKey; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'not_started', label: 'Not started' },
		{ key: 'draft', label: 'Draft' },
		{ key: 'submitted', label: 'Submitted' },
		{ key: 'finalised', label: 'Finalised' }
	];
</script>

<div class="mx-auto max-w-5xl px-0 py-2">
	<div class="mb-6 flex flex-col gap-1">
		<p
			class="text-xs font-medium tracking-[0.15em] uppercase"
			style="color: var(--color-text-2);"
		>
			Hello, {data.profile.fullName.split(' ')[0]}
		</p>
		<h1 class="text-2xl font-semibold sm:text-3xl" style="color: var(--color-text-1);">
			My queue
		</h1>
		<p class="text-sm" style="color: var(--color-text-2);">
			{data.rows.length} participant{data.rows.length === 1 ? '' : 's'} assigned to you.
		</p>
	</div>

	{#if data.loadError}
		<div
			class="mb-4 rounded-lg border p-4 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			Failed to load queue: {data.loadError}
		</div>
	{/if}

	<!-- Filter chips -->
	<div class="mb-4 flex flex-wrap gap-2">
		{#each chips as chip (chip.key)}
			{@const active = filter === chip.key}
			<button
				type="button"
				class="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors"
				style="min-width: 44px; background: {active
					? 'var(--accent-soft)'
					: 'var(--color-bg-2)'}; border-color: {active
					? 'var(--color-accent)'
					: 'var(--border)'}; color: {active ? 'var(--color-accent)' : 'var(--color-text-1)'};"
				onclick={() => (filter = chip.key)}
				aria-pressed={active}
			>
				<span>{chip.label}</span>
				<span class="text-xs" style="color: var(--color-text-2);">{counts(chip.key)}</span>
			</button>
		{/each}
	</div>

	{#if data.rows.length === 0}
		<div
			class="rounded-lg border p-10 text-center"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<p class="mb-2 text-base font-medium" style="color: var(--color-text-1);">
				Your queue is empty.
			</p>
			<p class="text-sm" style="color: var(--color-text-2);">
				Check with the event admin — assignments may not have been made yet.
			</p>
		</div>
	{:else if filtered.length === 0}
		<div
			class="rounded-lg border p-8 text-center"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<p class="text-sm" style="color: var(--color-text-2);">
				Nothing in this filter. Try a different one.
			</p>
		</div>
	{:else}
		<!-- Desktop table -->
		<div
			class="hidden overflow-hidden rounded-lg border md:block"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<table class="w-full text-sm">
				<thead>
					<tr
						class="text-xs tracking-wider uppercase"
						style="background: var(--color-bg-3); color: var(--color-text-2);"
					>
						<th class="px-4 py-3 text-left font-medium">Status</th>
						<th class="px-4 py-3 text-left font-medium">Participant</th>
						<th class="px-4 py-3 text-left font-medium">Cat</th>
						<th class="px-4 py-3 text-left font-medium">School</th>
						<th class="px-4 py-3 text-left font-medium">Theme</th>
						<th class="px-4 py-3 text-right font-medium">Progress</th>
						<th class="px-4 py-3 text-right font-medium">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as r (r.participantId)}
						{@const locked = r.status === 'finalised'}
						<tr class="border-t" style="border-color: var(--border);">
							<td class="px-4 py-3 align-middle">
								<StatusPill status={r.status} />
							</td>
							<td
								class="px-4 py-3 align-middle font-medium"
								style="color: var(--color-text-1);"
							>
								{r.fullName}
							</td>
							<td
								class="px-4 py-3 align-middle"
								style="color: var(--color-text-2); font-family: var(--font-mono);"
							>
								{r.category}
							</td>
							<td class="px-4 py-3 align-middle" style="color: var(--color-text-2);">
								{r.schoolName}
							</td>
							<td class="px-4 py-3 align-middle" style="color: var(--color-text-2);">
								{r.theme ?? '—'}
							</td>
							<td
								class="px-4 py-3 text-right align-middle"
								style="color: var(--color-text-1); font-family: var(--font-mono);"
							>
								{r.scoredCount} / {r.totalCount}
							</td>
							<td class="px-4 py-3 text-right align-middle">
								<a
									href="/judge/score/{r.participantId}"
									class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
									style="min-width: 96px; background: {locked
										? 'var(--color-bg-3)'
										: 'var(--color-accent)'}; color: {locked
										? 'var(--color-text-2)'
										: '#fff'};"
								>
									{actionLabel(r)}
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards -->
		<ul class="flex flex-col gap-3 md:hidden">
			{#each filtered as r (r.participantId)}
				{@const locked = r.status === 'finalised'}
				<li
					class="rounded-lg border p-4"
					style="background: var(--color-bg-2); border-color: var(--border);"
				>
					<div class="mb-2 flex items-start justify-between gap-2">
						<div>
							<p class="font-medium" style="color: var(--color-text-1);">{r.fullName}</p>
							<p class="text-xs" style="color: var(--color-text-2);">
								Cat {r.category} · {r.schoolName}
							</p>
						</div>
						<StatusPill status={r.status} />
					</div>
					<div
						class="mb-3 flex items-center justify-between text-xs"
						style="color: var(--color-text-2);"
					>
						<span>{r.theme ?? '—'}</span>
						<span style="font-family: var(--font-mono); color: var(--color-text-1);">
							{r.scoredCount} / {r.totalCount}
						</span>
					</div>
					<a
						href="/judge/score/{r.participantId}"
						class="flex h-11 w-full items-center justify-center rounded-md text-sm font-medium"
						style="background: {locked
							? 'var(--color-bg-3)'
							: 'var(--color-accent)'}; color: {locked ? 'var(--color-text-2)' : '#fff'};"
					>
						{actionLabel(r)}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
