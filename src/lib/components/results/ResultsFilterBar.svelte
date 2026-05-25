<!--
	ResultsFilterBar — leaderboard filters.

	URL params drive state (?category=, ?theme=, ?school=, ?status=). The form
	submits via GET so filters survive reload and bookmark. Multi-selects
	collect values into single CSV-encoded hidden inputs.

	Identical UX in /admin/results and /viewer/results.
-->
<script lang="ts">
	import type { Category, Theme, ScoresheetStatus } from '$lib/types';

	type StatusOption = ScoresheetStatus | 'not_started';

	interface Props {
		categories: Category[];
		themes: (Theme | 'none')[];
		schools: string[];
		statuses: StatusOption[];
		schoolOptions: { id: string; name: string }[];
	}
	let {
		categories,
		themes,
		schools,
		statuses,
		schoolOptions
	}: Props = $props();

	const ALL_CATEGORIES: Category[] = ['A', 'B', 'C'];
	const ALL_THEMES: Theme[] = ['Eco-Warriors', 'Smart Cities', 'Space Pioneers'];
	const ALL_STATUSES: { value: StatusOption; label: string }[] = [
		{ value: 'not_started', label: 'Not started' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'submitted', label: 'Submitted' },
		{ value: 'finalised', label: 'Finalised' }
	];

	// Snapshot initial CSVs (the static-analysis rule wants helper functions).
	const initialCategoryCsv = () => categories.join(',');
	const initialThemeCsv = () => themes.join(',');
	const initialSchoolCsv = () => schools.join(',');
	const initialStatusCsv = () => statuses.join(',');

	let categoryCsv = $state(initialCategoryCsv());
	let themeCsv = $state(initialThemeCsv());
	let schoolCsv = $state(initialSchoolCsv());
	let statusCsv = $state(initialStatusCsv());
</script>

<form
	method="get"
	class="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border p-4"
	style="background: var(--color-bg-2); border-color: var(--border);"
>
	<label class="flex flex-col gap-1" style="min-width: 140px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			Category
		</span>
		<select
			multiple
			class="min-h-11 rounded-[var(--radius-sm)] border px-2 py-1 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			size="3"
			onchange={(e) => {
				const sel = e.currentTarget as HTMLSelectElement;
				categoryCsv = Array.from(sel.selectedOptions)
					.map((o) => o.value)
					.join(',');
			}}
		>
			{#each ALL_CATEGORIES as c (c)}
				<option value={c} selected={categories.includes(c)}>Cat {c}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1" style="min-width: 180px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			Theme
		</span>
		<select
			multiple
			class="min-h-11 rounded-[var(--radius-sm)] border px-2 py-1 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			size="4"
			onchange={(e) => {
				const sel = e.currentTarget as HTMLSelectElement;
				themeCsv = Array.from(sel.selectedOptions)
					.map((o) => o.value)
					.join(',');
			}}
		>
			{#each ALL_THEMES as t (t)}
				<option value={t} selected={themes.includes(t)}>{t}</option>
			{/each}
			<option value="none" selected={themes.includes('none')}>— no theme —</option>
		</select>
	</label>

	<label class="flex flex-1 flex-col gap-1" style="min-width: 200px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			School
		</span>
		<select
			multiple
			class="min-h-11 rounded-[var(--radius-sm)] border px-2 py-1 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			size="4"
			onchange={(e) => {
				const sel = e.currentTarget as HTMLSelectElement;
				schoolCsv = Array.from(sel.selectedOptions)
					.map((o) => o.value)
					.join(',');
			}}
		>
			{#each schoolOptions as s (s.id)}
				<option value={s.id} selected={schools.includes(s.id)}>{s.name}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1" style="min-width: 160px;">
		<span
			class="text-[11px] font-medium tracking-wider uppercase"
			style="color: var(--color-text-2);"
		>
			Status
		</span>
		<select
			multiple
			class="min-h-11 rounded-[var(--radius-sm)] border px-2 py-1 text-sm"
			style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
			size="4"
			onchange={(e) => {
				const sel = e.currentTarget as HTMLSelectElement;
				statusCsv = Array.from(sel.selectedOptions)
					.map((o) => o.value)
					.join(',');
			}}
		>
			{#each ALL_STATUSES as s (s.value)}
				<option value={s.value} selected={statuses.includes(s.value)}>{s.label}</option>
			{/each}
		</select>
	</label>

	<input type="hidden" name="category" value={categoryCsv} />
	<input type="hidden" name="theme" value={themeCsv} />
	<input type="hidden" name="school" value={schoolCsv} />
	<input type="hidden" name="status" value={statusCsv} />

	<div class="flex items-center gap-2">
		<button
			type="submit"
			class="inline-flex h-11 items-center justify-center rounded-[var(--radius)] px-4 text-sm font-medium transition-colors"
			style="background: var(--color-accent); color: #fff; min-width: 88px;"
		>
			Apply
		</button>
		<a
			href="?"
			class="inline-flex h-11 items-center justify-center rounded-[var(--radius)] border px-4 text-sm font-medium transition-colors"
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
