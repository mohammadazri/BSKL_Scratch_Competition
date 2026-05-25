<!--
	FilterBar — actor / action / target / date-range / search controls.

	Submits via a plain GET form so filters survive without JS. The same form
	doubles as the live form because filter changes navigate, the page reloads
	with the new URL, and the realtime subscription re-attaches.

	Why GET, not a fancy reactive store: URL params ARE the filter state. They
	bookmark, they back-button, they survive reload, and they progressively
	enhance for free.
-->
<script lang="ts">
	import type { AuditAction } from '$lib/audit/types';
	import { ALL_AUDIT_ACTIONS, ALL_TARGET_TYPES, actionLabel } from '$lib/audit/types';

	interface ActorOption {
		id: string;
		label: string;
	}

	interface Props {
		actorOptions: ActorOption[]; // empty for /judge (only their own actions)
		actorIds: string[];
		actions: AuditAction[];
		targetTypes: string[];
		fromIso: string | null;
		toIso: string | null;
		search: string | null;
		showActorFilter?: boolean; // false on /judge — pointless when there's only one
	}
	let {
		actorOptions,
		actorIds,
		actions,
		targetTypes,
		fromIso,
		toIso,
		search,
		showActorFilter = true
	}: Props = $props();

	function isoToLocalInput(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function localInputToIso(local: string): string {
		if (!local) return '';
		const d = new Date(local);
		if (isNaN(d.getTime())) return '';
		return d.toISOString();
	}

	// Multi-select dropdowns use native <select multiple> for max compatibility
	// and zero-JS fallback. The CSV join is built on submit via the names.
	//
	// Initial values are snapshotted via helper functions so the static-analysis
	// rule ("reference only captures initial value") goes away — that's the
	// deliberate behaviour: SvelteKit destroys + recreates the component on
	// navigation, so the new props become the new initial state.
	const initialActorCsv = () => actorIds.join(',');
	const initialActionCsv = () => actions.join(',');
	const initialTargetCsv = () => targetTypes.join(',');
	const initialFromLocal = () => isoToLocalInput(fromIso);
	const initialToLocal = () => isoToLocalInput(toIso);
	const initialSearch = () => search ?? '';

	let actorCsv = $state(initialActorCsv());
	let actionCsv = $state(initialActionCsv());
	let targetCsv = $state(initialTargetCsv());
	let fromLocal = $state(initialFromLocal());
	let toLocal = $state(initialToLocal());
	let searchLocal = $state(initialSearch());

	// Build hidden inputs with ISO timestamps on submit so the server gets a
	// canonical UTC string regardless of the user's locale.
	let fromIsoSubmit = $derived(localInputToIso(fromLocal));
	let toIsoSubmit = $derived(localInputToIso(toLocal));
</script>

<form
	method="get"
	class="flex flex-wrap items-end gap-3 rounded-lg border p-4"
	style="background: var(--color-bg-2); border-color: var(--border);"
>
	{#if showActorFilter}
		<label class="flex flex-1 flex-col gap-1" style="min-width: 180px;">
			<span
				class="text-[11px] font-medium tracking-wider uppercase"
				style="color: var(--color-text-2);"
			>
				Actor
			</span>
			<select
				multiple
				class="min-h-11 rounded-md border px-2 py-1 text-sm"
				style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				size="1"
				onchange={(e) => {
					const sel = e.currentTarget as HTMLSelectElement;
					actorCsv = Array.from(sel.selectedOptions).map((o) => o.value).join(',');
				}}
			>
				{#each actorOptions as opt (opt.id)}
					<option value={opt.id} selected={actorIds.includes(opt.id)}>{opt.label}</option>
				{/each}
			</select>
		</label>
	{/if}

	<label class="flex flex-1 flex-col gap-1" style="min-width: 180px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			Action
		</span>
		<select
			multiple
			class="min-h-11 rounded-md border px-2 py-1 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			size="1"
			onchange={(e) => {
				const sel = e.currentTarget as HTMLSelectElement;
				actionCsv = Array.from(sel.selectedOptions).map((o) => o.value).join(',');
			}}
		>
			{#each ALL_AUDIT_ACTIONS as a (a)}
				<option value={a} selected={actions.includes(a)}>{actionLabel(a)}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-1 flex-col gap-1" style="min-width: 140px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			Target
		</span>
		<select
			multiple
			class="min-h-11 rounded-md border px-2 py-1 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			size="1"
			onchange={(e) => {
				const sel = e.currentTarget as HTMLSelectElement;
				targetCsv = Array.from(sel.selectedOptions).map((o) => o.value).join(',');
			}}
		>
			{#each ALL_TARGET_TYPES as t (t)}
				<option value={t} selected={targetTypes.includes(t as string)}>{t}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1" style="min-width: 180px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			From
		</span>
		<input
			type="datetime-local"
			bind:value={fromLocal}
			class="h-11 rounded-md border px-2 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
		/>
	</label>

	<label class="flex flex-col gap-1" style="min-width: 180px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			To
		</span>
		<input
			type="datetime-local"
			bind:value={toLocal}
			class="h-11 rounded-md border px-2 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
		/>
	</label>

	<label class="flex flex-1 flex-col gap-1" style="min-width: 180px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			Search
		</span>
		<input
			type="search"
			name="q"
			bind:value={searchLocal}
			placeholder="reason or target id"
			class="h-11 rounded-md border px-2 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
		/>
	</label>

	<!-- Hidden CSV inputs collect multi-select state into a single param each. -->
	<input type="hidden" name="actor" value={actorCsv} />
	<input type="hidden" name="action" value={actionCsv} />
	<input type="hidden" name="target" value={targetCsv} />
	<input type="hidden" name="from" value={fromIsoSubmit} />
	<input type="hidden" name="to" value={toIsoSubmit} />

	<div class="flex items-center gap-2">
		<button
			type="submit"
			class="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
			style="background: var(--color-accent); color: #fff; min-width: 88px;"
		>
			Apply
		</button>
		<a
			href="?"
			class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
		>
			Reset
		</a>
	</div>
</form>

<style>
	select[multiple] {
		min-height: 2.75rem;
	}
</style>
