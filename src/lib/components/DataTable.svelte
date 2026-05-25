<!--
	DataTable — DESIGN.md § 3 Tables. Generic: columns + rows config.
	Sticky header, hover row tint, alternating zebra, empty-state slot.
	Sortable on header click for columns flagged `sortable: true`.
-->
<script lang="ts" generics="T extends Record<string, unknown>">
	import type { Snippet } from 'svelte';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	export interface Column<R> {
		key: string;
		label: string;
		align?: 'left' | 'right' | 'center';
		sortable?: boolean;
		width?: string;
		mono?: boolean;
		/** custom cell renderer */
		cell?: Snippet<[R]>;
		/** accessor for default text + sort */
		get?: (row: R) => string | number | null | undefined;
	}

	interface Props<R> {
		columns: Column<R>[];
		rows: R[];
		empty?: Snippet;
		onrowclick?: (row: R) => void;
		sticky?: boolean;
		actions?: Snippet<[R]>;
		actionsLabel?: string;
	}

	let {
		columns,
		rows,
		empty,
		onrowclick,
		sticky = true,
		actions,
		actionsLabel = 'Actions'
	}: Props<T> = $props();

	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggleSort(col: Column<T>) {
		if (!col.sortable) return;
		if (sortKey === col.key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = col.key;
			sortDir = 'asc';
		}
	}

	const sortedRows = $derived.by(() => {
		if (!sortKey) return rows;
		const col = columns.find((c) => c.key === sortKey);
		if (!col) return rows;
		const sorted = [...rows].sort((a, b) => {
			const av = col.get ? col.get(a) : (a[col.key] as string | number | null | undefined);
			const bv = col.get ? col.get(b) : (b[col.key] as string | number | null | undefined);
			if (av == null && bv == null) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			if (typeof av === 'number' && typeof bv === 'number') return av - bv;
			return String(av).localeCompare(String(bv));
		});
		if (sortDir === 'desc') sorted.reverse();
		return sorted;
	});
</script>

<div
	class="overflow-x-auto rounded-[var(--radius)] border"
	style="border-color: var(--border); background: var(--color-bg-1);"
>
	<table class="w-full border-collapse text-sm">
		<thead class={sticky ? 'sticky top-0 z-10' : ''}>
			<tr style="background: var(--color-bg-3);">
				{#each columns as col (col.key)}
					<th
						class="px-3 py-2 text-[11px] font-medium tracking-wider uppercase whitespace-nowrap select-none"
						style="color: var(--color-text-2); text-align: {col.align ??
							'left'}; {col.width ? `width: ${col.width}` : ''}; {col.sortable
							? 'cursor: pointer;'
							: ''}"
						onclick={() => toggleSort(col)}
					>
						<span class="inline-flex items-center gap-1">
							{col.label}
							{#if col.sortable && sortKey === col.key}
								{#if sortDir === 'asc'}
									<ChevronUp size={12} />
								{:else}
									<ChevronDown size={12} />
								{/if}
							{/if}
						</span>
					</th>
				{/each}
				{#if actions}
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
						style="color: var(--color-text-2);"
					>
						{actionsLabel}
					</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each sortedRows as row, i (i)}
				<tr
					class="border-t transition hover:bg-[color:var(--accent-soft)]"
					style="border-color: var(--border); background: {i % 2 === 0
						? 'var(--color-bg-1)'
						: 'var(--color-bg-2)'}; {onrowclick ? 'cursor: pointer;' : ''}"
					onclick={() => onrowclick?.(row)}
				>
					{#each columns as col (col.key)}
						<td
							class="px-3 py-2.5"
							style="text-align: {col.align ?? 'left'}; color: var(--color-text-1); {col.mono
								? 'font-family: var(--font-mono);'
								: ''}"
						>
							{#if col.cell}
								{@render col.cell(row)}
							{:else}
								{col.get ? (col.get(row) ?? '') : (row[col.key] ?? '')}
							{/if}
						</td>
					{/each}
					{#if actions}
						<td class="px-3 py-2.5 text-right">
							{@render actions(row)}
						</td>
					{/if}
				</tr>
			{/each}
			{#if sortedRows.length === 0}
				<tr>
					<td colspan={columns.length + (actions ? 1 : 0)} class="px-6 py-10">
						{#if empty}
							{@render empty()}
						{:else}
							<p class="text-center text-sm" style="color: var(--color-text-2);">No rows.</p>
						{/if}
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>
