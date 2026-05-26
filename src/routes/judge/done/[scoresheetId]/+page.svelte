<!--
	/judge/done/[scoresheetId] — submission summary.

	Confirmation screen shown after a successful submit. Shows a recap (total,
	sprint time), per-criterion line items, and two CTAs: back to queue, or
	jump to the next unfinished participant in the queue.
-->
<script lang="ts">
	// BrandHeader now provided by /judge/+layout.svelte's AppShell.
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { formatMmSs } from '$lib/scoring';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();

	let sectionA = $derived(data.lineItems.filter((l) => l.section === 'A'));
	let sectionB = $derived(data.lineItems.filter((l) => l.section === 'B'));
</script>

<div class="mx-auto max-w-3xl px-0 py-2">
	<a
		href="/judge"
		class="mb-3 inline-flex items-center gap-1 text-sm underline"
		style="color: var(--color-text-2);"
	>
		‹ My queue
	</a>

	<div
		class="mb-6 flex items-center gap-3 rounded-lg border p-4"
		style="background: var(--color-bg-2); border-color: var(--color-success);"
	>
		<span
			class="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold"
			style="background: rgba(16,185,129,0.18); color: var(--color-success);"
			aria-hidden="true"
		>
			✓
		</span>
		<div>
			<p class="text-lg font-semibold" style="color: var(--color-text-1);">
				Submitted
			</p>
			<p class="text-xs" style="color: var(--color-text-2);">
				{#if data.scoresheet.submittedAt}
					{new Date(data.scoresheet.submittedAt).toLocaleString()}
				{:else}
					just now
				{/if}
			</p>
		</div>
	</div>

	<section
		class="mb-6 rounded-lg border p-4"
		style="background: var(--color-bg-2); border-color: var(--border);"
	>
		<h1 class="text-xl font-semibold" style="color: var(--color-text-1);">
			{data.participant.fullName}
		</h1>
		<p class="text-xs" style="color: var(--color-text-2);">
			Cat {data.participant.category} · {data.participant.schoolName}
			{#if data.participant.theme} · {data.participant.theme}{/if}
		</p>
		<dl class="mt-4 grid grid-cols-3 gap-3 text-sm">
			<div>
				<dt
					class="text-xs tracking-wide uppercase"
					style="color: var(--color-text-2);"
				>
					Total
				</dt>
				<dd
					class="text-2xl font-semibold"
					style="font-family: var(--font-mono); color: var(--color-text-1);"
				>
					{data.total}
					<span class="text-sm" style="color: var(--color-text-2);">
						/ {data.maxTotal}
					</span>
				</dd>
			</div>
			<div>
				<dt
					class="text-xs tracking-wide uppercase"
					style="color: var(--color-text-2);"
				>
					Sprint time
				</dt>
				<dd
					class="text-2xl font-semibold"
					style="font-family: var(--font-mono); color: var(--color-text-1);"
				>
					{formatMmSs(data.scoresheet.liveSprintTimeSeconds)}
				</dd>
			</div>
			<div>
				<dt
					class="text-xs tracking-wide uppercase"
					style="color: var(--color-text-2);"
				>
					Status
				</dt>
				<dd class="mt-1">
					<StatusPill status={data.scoresheet.status} />
				</dd>
			</div>
		</dl>

		{#if data.dq}
			<div
				class="mt-4 rounded-md border p-3 text-sm"
				style="background: rgba(239,68,68,0.08); border-color: var(--color-danger); color: var(--color-danger);"
			>
				<strong>DQ flag:</strong>
				{data.dq.reason.replaceAll('_', ' ')} — {data.dq.notes}
			</div>
		{/if}
	</section>

	{#snippet itemList(items: typeof data.lineItems)}
		<ul class="divide-y" style="--tw-divide-opacity: 1; border-color: var(--border);">
			{#each items as item (item.id)}
				<li
					class="flex items-start justify-between gap-3 border-t py-3 first:border-t-0"
					style="border-color: var(--border);"
				>
					<div class="min-w-0">
						<p class="text-sm font-medium" style="color: var(--color-text-1);">
							{item.name}
						</p>
						{#if item.level}
							<p class="text-xs" style="color: var(--color-text-2);">{item.level}</p>
						{:else}
							<p class="text-xs" style="color: var(--color-text-3);">— not scored</p>
						{/if}
						{#if item.comment}
							<p
								class="mt-1 text-xs leading-snug"
								style="color: var(--color-text-3);"
							>
								“{item.comment}”
							</p>
						{/if}
					</div>
					<div
						class="shrink-0 text-right text-sm"
						style="font-family: var(--font-mono); color: var(--color-text-1);"
					>
						{item.points ?? '—'}
						<span class="text-xs" style="color: var(--color-text-2);">
							/ {item.maxPoints}
						</span>
					</div>
				</li>
			{/each}
		</ul>
	{/snippet}

	{#if sectionA.length > 0}
		<section
			class="mb-4 rounded-lg border p-4"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<h2
				class="mb-2 text-xs font-semibold tracking-[0.18em] uppercase"
				style="color: var(--color-text-2);"
			>
				Section A · Phase 1 At-Home Build
			</h2>
			{@render itemList(sectionA)}
		</section>
	{/if}

	{#if sectionB.length > 0}
		<section
			class="mb-6 rounded-lg border p-4"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<h2
				class="mb-2 text-xs font-semibold tracking-[0.18em] uppercase"
				style="color: var(--color-text-2);"
			>
				Section B · Live Sprint Mystery
			</h2>
			{@render itemList(sectionB)}
		</section>
	{/if}

	<div class="flex flex-wrap gap-3">
		<a
			href="/judge"
			class="inline-flex h-11 items-center justify-center rounded-md border px-5 text-sm font-medium"
			style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-1); min-height: 44px;"
		>
			Back to queue
		</a>
		<a
			href="/judge"
			class="inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold uppercase"
			style="background: var(--color-accent); color: #fff; min-height: 44px;"
		>
			Score the next one ›
		</a>
	</div>
</div>
