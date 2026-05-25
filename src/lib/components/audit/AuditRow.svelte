<!--
	AuditRow — one row of the audit table. Click to expand for JSON diff.

	Override rows (score_override, scoresheet_unlock, etc.) get a soft accent
	tint as a background per DESIGN.md § 4 D, regardless of expansion state.
	DQ rows get a small warning glyph in the actor column.

	Time is rendered locally; the underlying ISO is preserved on the title
	attribute for hover so judges can correlate with their own clock.
-->
<script lang="ts">
	import type { AuditRowWithActor } from '$lib/audit/query';
	import { OVERRIDE_ACTIONS, DQ_ACTIONS, actionLabel } from '$lib/audit/types';
	import JsonDiff from './JsonDiff.svelte';

	interface Props {
		row: AuditRowWithActor;
		currentUserId: string | null; // to render "You" instead of own name
		expanded?: boolean;
	}
	let { row, currentUserId, expanded = $bindable(false) }: Props = $props();

	let isOverride = $derived(OVERRIDE_ACTIONS.has(row.action));
	let isDq = $derived(DQ_ACTIONS.has(row.action));
	let isSystem = $derived(row.actor_id === null);
	let isSelf = $derived(currentUserId !== null && row.actor_id === currentUserId);

	let actorLabel = $derived.by(() => {
		if (isSystem) return 'System';
		if (isSelf) return 'You';
		return row.actor?.full_name ?? row.actor_id?.slice(0, 8) ?? 'Unknown';
	});

	let timeLocal = $derived.by(() => {
		const d = new Date(row.at);
		if (isNaN(d.getTime())) return row.at;
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	});
	let dateLocal = $derived.by(() => {
		const d = new Date(row.at);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString();
	});

	let targetLabel = $derived.by(() => {
		if (!row.target_type) return '—';
		const idShort = row.target_id ? row.target_id.slice(0, 8) : '';
		return idShort ? `${row.target_type} · ${idShort}` : row.target_type;
	});

	function toggle() {
		expanded = !expanded;
	}
</script>

<tr
	class="cursor-pointer border-t transition-colors hover:brightness-110"
	style="border-color: var(--border); background: {isOverride ? 'var(--accent-soft)' : 'transparent'};"
	onclick={toggle}
	aria-expanded={expanded}
>
	<td
		class="px-4 py-2.5 align-top font-mono text-xs whitespace-nowrap"
		style="color: var(--color-text-2); font-family: var(--font-mono);"
		title={row.at}
	>
		<div>{timeLocal}</div>
		<div class="text-[10px] opacity-70">{dateLocal}</div>
	</td>
	<td class="px-4 py-2.5 align-top text-sm" style="color: var(--color-text-1);">
		<span class="flex items-center gap-1.5">
			<span>{actorLabel}</span>
			{#if isDq}
				<span
					class="text-xs"
					style="color: var(--color-danger);"
					aria-label="disqualification-related action"
					title="DQ-related"
				>
					⚠
				</span>
			{/if}
			{#if isOverride && !isDq}
				<span
					class="text-xs"
					style="color: var(--color-accent);"
					aria-label="override action"
					title="Override"
				>
					⚠
				</span>
			{/if}
		</span>
		{#if row.actor?.role}
			<div class="text-[10px]" style="color: var(--color-text-3);">{row.actor.role}</div>
		{:else if isSystem}
			<div class="text-[10px]" style="color: var(--color-text-3);">trigger</div>
		{/if}
	</td>
	<td
		class="px-4 py-2.5 align-top text-sm"
		style="color: var(--color-text-1); font-family: var(--font-mono);"
	>
		{actionLabel(row.action)}
	</td>
	<td
		class="px-4 py-2.5 align-top text-sm"
		style="color: var(--color-text-2); font-family: var(--font-mono);"
	>
		{targetLabel}
	</td>
	<td
		class="px-4 py-2.5 text-right align-top text-xs"
		style="color: var(--color-text-3);"
		aria-hidden="true"
	>
		{expanded ? '▾' : '›'}
	</td>
</tr>

{#if expanded}
	<tr style="background: {isOverride ? 'var(--accent-soft)' : 'var(--color-bg-1)'};">
		<td colspan="5" class="px-4 py-4">
			<div class="flex flex-col gap-3">
				{#if row.reason}
					<div>
						<div
							class="mb-1 text-[10px] font-medium tracking-wider uppercase"
							style="color: var(--color-text-2);"
						>
							Reason
						</div>
						<div
							class="rounded-md border p-2 text-sm"
							style="background: var(--color-bg-2); border-color: var(--border); color: var(--color-text-1);"
						>
							{row.reason}
						</div>
					</div>
				{/if}

				<div>
					<div
						class="mb-1 text-[10px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Before → After (id / created_at / updated_at hidden)
					</div>
					<JsonDiff before={row.before_json} after={row.after_json} />
				</div>

				<div
					class="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2 md:grid-cols-4"
					style="color: var(--color-text-3); font-family: var(--font-mono);"
				>
					<div>id: <span style="color: var(--color-text-2);">{row.id}</span></div>
					<div>
						target_id:
						<span style="color: var(--color-text-2);">{row.target_id ?? '—'}</span>
					</div>
					<div>
						actor_id:
						<span style="color: var(--color-text-2);">{row.actor_id ?? '—'}</span>
					</div>
					<div>
						ip: <span style="color: var(--color-text-2);">{row.actor_ip ?? '—'}</span>
					</div>
				</div>
			</div>
		</td>
	</tr>
{/if}
