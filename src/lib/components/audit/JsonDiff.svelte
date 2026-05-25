<!--
	JsonDiff — side-by-side before/after display with line-level change tinting.

	We don't ship a real diff library; instead we project both objects onto a
	union of keys and render each key on its own line with a small visual cue
	for added / removed / changed. That's enough for the audit use case where
	rows are typically <30 keys.

	Noisy fields (id, created_at, updated_at) are filtered out — they always
	change and add nothing to a human review. They stay in the underlying JSON;
	we just don't render them here.
-->
<script lang="ts">
	import { NOISY_JSON_FIELDS } from '$lib/audit/types';

	interface Props {
		before: Record<string, unknown> | null;
		after: Record<string, unknown> | null;
	}
	let { before, after }: Props = $props();

	type Status = 'unchanged' | 'added' | 'removed' | 'changed';
	type Row = { key: string; beforeVal: string; afterVal: string; status: Status };

	function stringify(v: unknown): string {
		if (v === null) return 'null';
		if (v === undefined) return '—';
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		try {
			return JSON.stringify(v, null, 2);
		} catch {
			return String(v);
		}
	}

	let rows = $derived.by((): Row[] => {
		const b = before ?? {};
		const a = after ?? {};
		const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
		const out: Row[] = [];
		for (const k of [...keys].sort()) {
			if (NOISY_JSON_FIELDS.has(k)) continue;
			const beforeHas = Object.prototype.hasOwnProperty.call(b, k);
			const afterHas = Object.prototype.hasOwnProperty.call(a, k);
			const bv = beforeHas ? (b as any)[k] : undefined;
			const av = afterHas ? (a as any)[k] : undefined;
			let status: Status;
			if (!beforeHas) status = 'added';
			else if (!afterHas) status = 'removed';
			else if (JSON.stringify(bv) === JSON.stringify(av)) status = 'unchanged';
			else status = 'changed';
			out.push({
				key: k,
				beforeVal: beforeHas ? stringify(bv) : '',
				afterVal: afterHas ? stringify(av) : '',
				status
			});
		}
		return out;
	});

	let visibleRows = $derived(rows.filter((r) => r.status !== 'unchanged'));
	let unchangedCount = $derived(rows.length - visibleRows.length);
	let showAll = $state(false);
	let rendered = $derived(showAll ? rows : visibleRows);

	function statusColor(s: Status): { dot: string; tint: string } {
		switch (s) {
			case 'added':
				return { dot: 'var(--color-success)', tint: 'rgba(16,185,129,0.08)' };
			case 'removed':
				return { dot: 'var(--color-danger)', tint: 'rgba(239,68,68,0.08)' };
			case 'changed':
				return { dot: 'var(--color-warning)', tint: 'rgba(245,158,11,0.08)' };
			default:
				return { dot: 'var(--color-text-3)', tint: 'transparent' };
		}
	}
</script>

{#if rows.length === 0}
	<p class="text-sm" style="color: var(--color-text-2);">
		No fields to diff (both snapshots empty).
	</p>
{:else}
	<div class="overflow-hidden rounded-md border" style="border-color: var(--border);">
		<div
			class="grid grid-cols-[140px_1fr_1fr] gap-px text-xs tracking-wider uppercase"
			style="background: var(--border);"
		>
			<div
				class="px-3 py-2 font-medium"
				style="background: var(--color-bg-3); color: var(--color-text-2);"
			>
				Field
			</div>
			<div
				class="px-3 py-2 font-medium"
				style="background: var(--color-bg-3); color: var(--color-text-2);"
			>
				Before
			</div>
			<div
				class="px-3 py-2 font-medium"
				style="background: var(--color-bg-3); color: var(--color-text-2);"
			>
				After
			</div>
		</div>
		<div class="flex flex-col gap-px" style="background: var(--border);">
			{#each rendered as r (r.key)}
				{@const c = statusColor(r.status)}
				<div
					class="grid grid-cols-[140px_1fr_1fr] gap-px text-xs"
					style="background: {c.tint};"
				>
					<div
						class="flex items-start gap-2 px-3 py-2"
						style="background: var(--color-bg-2);"
					>
						<span
							class="mt-1 block h-1.5 w-1.5 rounded-full"
							style="background: {c.dot};"
							aria-hidden="true"
						></span>
						<code
							class="font-mono"
							style="color: var(--color-text-1); font-family: var(--font-mono);"
						>
							{r.key}
						</code>
					</div>
					<pre
						class="overflow-x-auto px-3 py-2 whitespace-pre-wrap"
						style="background: var(--color-bg-2); color: var(--color-text-1); font-family: var(--font-mono);"
					>{r.beforeVal}</pre>
					<pre
						class="overflow-x-auto px-3 py-2 whitespace-pre-wrap"
						style="background: var(--color-bg-2); color: var(--color-text-1); font-family: var(--font-mono);"
					>{r.afterVal}</pre>
				</div>
			{/each}
		</div>
	</div>

	{#if unchangedCount > 0}
		<button
			type="button"
			class="mt-2 text-xs underline-offset-2 hover:underline"
			style="color: var(--color-text-2); background: none; border: 0;"
			onclick={() => (showAll = !showAll)}
		>
			{showAll ? 'Hide' : 'Show'}
			{unchangedCount} unchanged field{unchangedCount === 1 ? '' : 's'}
		</button>
	{/if}
{/if}
