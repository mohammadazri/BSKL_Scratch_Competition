<!--
	AuditTable — sticky-header table that paginates rows in the client.

	Virtualization is intentionally NOT used here. Default load is 200 rows; even
	a full event day (~2700 rows) would be at most a couple of thousand DOM
	nodes once expanded. We can revisit @tanstack/svelte-virtual if profiling on
	the Pi shows scroll jank, but the simpler implementation wins until then.

	Each row is rendered via <AuditRow>. The table is responsible for the
	header row and the empty state; row internals (expand, override tint,
	JSON diff) live in <AuditRow>.
-->
<script lang="ts">
	import type { AuditRowWithActor } from '$lib/audit/query';
	import AuditRow from './AuditRow.svelte';

	interface Props {
		rows: AuditRowWithActor[];
		currentUserId: string | null;
		limit: number;
		truncated: boolean;
	}
	let { rows, currentUserId, limit, truncated }: Props = $props();
</script>

<div
	class="overflow-hidden rounded-lg border"
	style="background: var(--color-bg-2); border-color: var(--border);"
>
	<div class="max-h-[70vh] overflow-y-auto">
		<table class="w-full border-collapse text-sm">
			<thead class="sticky top-0 z-10">
				<tr
					class="text-xs tracking-wider uppercase"
					style="background: var(--color-bg-3); color: var(--color-text-2);"
				>
					<th class="px-4 py-3 text-left font-medium" style="min-width: 96px;">Time</th>
					<th class="px-4 py-3 text-left font-medium" style="min-width: 140px;">Actor</th>
					<th class="px-4 py-3 text-left font-medium" style="min-width: 180px;">Action</th>
					<th class="px-4 py-3 text-left font-medium">Target</th>
					<th class="w-8 px-4 py-3 text-right font-medium" aria-hidden="true">⌄</th>
				</tr>
			</thead>
			<tbody>
				{#if rows.length === 0}
					<tr>
						<td colspan="5" class="px-4 py-12 text-center text-sm" style="color: var(--color-text-2);">
							No audit rows match the current filters.
						</td>
					</tr>
				{:else}
					{#each rows as r (r.id)}
						<AuditRow row={r} {currentUserId} />
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>

{#if truncated}
	<p class="mt-2 text-xs" style="color: var(--color-text-2);">
		Showing the most recent {limit} rows. Narrow filters or export CSV for the full set.
	</p>
{/if}
