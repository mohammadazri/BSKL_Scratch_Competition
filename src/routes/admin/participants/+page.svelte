<!--
	/admin/participants — list, create, edit, delete, CSV import, DQ toggle.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CsvUpload from '$lib/components/CsvUpload.svelte';
	import { Plus, Pencil, Trash2, Upload, Ban, ShieldCheck, GraduationCap } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import type { ParticipantRow } from './+page.server';
	import type { Category, Theme, DqReason } from '$lib/types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Modal state
	let createOpen = $state(false);
	let editOpen = $state(false);
	let importOpen = $state(false);
	let dqOpen = $state(false);
	let confirmDelOpen = $state(false);
	let confirmReqOpen = $state(false);

	// Editing
	let editing = $state<ParticipantRow | null>(null);
	let editName = $state('');
	let editSchool = $state('');
	let editCategory = $state<Category>('A');
	let editTheme = $state<Theme | ''>('');

	// Create
	let newName = $state('');
	let newSchool = $state('');
	let newCategory = $state<Category>('A');
	let newTheme = $state<Theme | ''>('');

	// DQ
	let dqing = $state<ParticipantRow | null>(null);
	let dqReason = $state<DqReason>('complete_on_arrival');
	let dqNotes = $state('');

	// Delete confirm
	let delRow = $state<ParticipantRow | null>(null);
	let requalRow = $state<ParticipantRow | null>(null);

	// CSV import
	let pendingCsv = $state('');
	let preview = $state<{
		rowCount: number;
		newSchoolCount: number;
		newSchoolNames: string[];
	} | null>(null);
	let committing = $state(false);

	// Filters
	let filterCat = $state<'all' | Category>('all');
	let filterSchool = $state<'all' | string>('all');
	let searchTerm = $state('');

	const themes: Theme[] = ['Eco-Warriors', 'Smart Cities', 'Space Pioneers'];
	const reasons: { value: DqReason; label: string }[] = [
		{ value: 'complete_on_arrival', label: 'Project already complete on arrival' },
		{ value: 'tutorial_or_ai_use', label: 'Used tutorial or AI assistance' },
		{ value: 'parental_assistance', label: 'Parental / coach assistance' },
		{ value: 'unsportsmanlike_conduct', label: 'Unsportsmanlike conduct' },
		{ value: 'other', label: 'Other (describe in notes)' }
	];

	let filtered = $derived(
		data.rows.filter((r) => {
			if (filterCat !== 'all' && r.category !== filterCat) return false;
			if (filterSchool !== 'all' && r.schoolId !== filterSchool) return false;
			if (searchTerm) {
				const q = searchTerm.toLowerCase();
				if (!r.fullName.toLowerCase().includes(q) && !r.schoolName.toLowerCase().includes(q)) {
					return false;
				}
			}
			return true;
		})
	);

	function openEdit(row: ParticipantRow) {
		editing = row;
		editName = row.fullName;
		editSchool = row.schoolId;
		editCategory = row.category;
		editTheme = row.theme ?? '';
		editOpen = true;
	}

	function openDq(row: ParticipantRow) {
		dqing = row;
		dqReason = 'complete_on_arrival';
		dqNotes = '';
		dqOpen = true;
	}

	function askDelete(row: ParticipantRow) {
		delRow = row;
		confirmDelOpen = true;
	}

	function askRequalify(row: ParticipantRow) {
		requalRow = row;
		confirmReqOpen = true;
	}

	async function doDelete() {
		if (!delRow) return;
		const fd = new FormData();
		fd.set('id', delRow.id);
		await fetch('?/delete', { method: 'POST', body: fd });
		await invalidateAll();
		confirmDelOpen = false;
		delRow = null;
	}

	async function doRequalify() {
		if (!requalRow) return;
		const fd = new FormData();
		fd.set('id', requalRow.id);
		await fetch('?/requalify', { method: 'POST', body: fd });
		await invalidateAll();
		confirmReqOpen = false;
		requalRow = null;
	}

	async function previewImport(rows: Record<string, string>[]) {
		const headers = ['full_name', 'school_name', 'category', 'theme'];
		const csv = [
			headers.join(','),
			...rows.map((r) =>
				headers
					.map((h) => {
						const v = r[h] ?? '';
						if (v.includes(',') || v.includes('"') || v.includes('\n')) {
							return '"' + v.replace(/"/g, '""') + '"';
						}
						return v;
					})
					.join(',')
			)
		].join('\n');

		const fd = new FormData();
		fd.set('csv', csv);
		committing = true;
		const res = await fetch('?/importPreview', { method: 'POST', body: fd });
		committing = false;
		const result = await res.json();
		if (result.type === 'success' && result.data) {
			// SvelteKit returns devalue-encoded payload. Decode the simple subset.
			const parsedData = JSON.parse(result.data);
			// devalue's $-references aren't fully handled here; we only need scalars/array.
			const arr = Array.isArray(parsedData) ? parsedData : [];
			// Format: [{...payload}, ...references]
			const payload = arr[0] ?? {};
			pendingCsv = csv;
			preview = {
				rowCount: typeof payload.rowCount === 'number' ? payload.rowCount : 0,
				newSchoolCount: typeof payload.newSchoolCount === 'number' ? payload.newSchoolCount : 0,
				newSchoolNames: Array.isArray(payload.newSchoolNames) ? payload.newSchoolNames : []
			};
		} else if (result.type === 'failure' && result.data) {
			const parsedData = JSON.parse(result.data);
			const payload = (Array.isArray(parsedData) ? parsedData[0] : parsedData) as {
				error?: string;
			};
			alert(payload.error ?? 'Preview failed.');
		} else {
			alert('Preview failed.');
		}
	}

	async function commitImport() {
		const fd = new FormData();
		fd.set('csv', pendingCsv);
		committing = true;
		await fetch('?/importCommit', { method: 'POST', body: fd });
		await invalidateAll();
		committing = false;
		preview = null;
		pendingCsv = '';
		importOpen = false;
	}
</script>

<svelte:head>
	<title>Participants · P3 Judging</title>
</svelte:head>

<PageHeader title="Participants" subtitle="Up to 45 per category × 3 = 135 total.">
	{#snippet actions()}
		<Button variant="secondary" onclick={() => (importOpen = true)}>
			{#snippet icon()}<Upload size={16} strokeWidth={1.5} />{/snippet}
			Import CSV
		</Button>
		<Button variant="primary" onclick={() => (createOpen = true)} disabled={data.schools.length === 0}>
			{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
			Add participant
		</Button>
	{/snippet}
</PageHeader>

{#if form?.message}
	<div
		class="mb-4 rounded-(--radius) border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-success); color: var(--color-text-1);"
	>
		<span style="color: var(--color-success);">{form.message}</span>
	</div>
{:else if form?.error}
	<div
		class="mb-4 rounded-(--radius) border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		{form.error}
	</div>
{/if}

{#if data.schools.length === 0}
	<EmptyState
		icon={GraduationCap}
		title="Add schools first"
		description="Every participant belongs to a school. Add schools, then come back here."
	>
		{#snippet action()}
			<Button variant="primary" href="/admin/schools">Go to Schools</Button>
		{/snippet}
	</EmptyState>
{:else if data.rows.length === 0}
	<EmptyState
		icon={GraduationCap}
		title="No participants yet"
		description="Add participants manually or import a CSV with full_name, school_name, category."
	>
		{#snippet action()}
			<div class="flex gap-2">
				<Button variant="secondary" onclick={() => (importOpen = true)}>
					{#snippet icon()}<Upload size={16} strokeWidth={1.5} />{/snippet}
					Import CSV
				</Button>
				<Button variant="primary" onclick={() => (createOpen = true)}>
					{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
					Add participant
				</Button>
			</div>
		{/snippet}
	</EmptyState>
{:else}
	<!-- Filters -->
	<div class="mb-4 grid gap-3 sm:grid-cols-3">
		<Input label="Search" placeholder="name or school" bind:value={searchTerm} />
		<Select label="Category" bind:value={filterCat}>
			<option value="all">All categories</option>
			<option value="A">A</option>
			<option value="B">B</option>
			<option value="C">C</option>
		</Select>
		<Select label="School" bind:value={filterSchool}>
			<option value="all">All schools</option>
			{#each data.schools as s (s.id)}
				<option value={s.id}>{s.name}</option>
			{/each}
		</Select>
	</div>

	<div
		class="overflow-x-auto rounded-(--radius) border"
		style="border-color: var(--border); background: var(--color-bg-1);"
	>
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr style="background: var(--color-bg-3);">
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Name</th
					>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">School</th
					>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Cat</th
					>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Theme</th
					>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Judge</th
					>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">DQ</th
					>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Actions</th
					>
				</tr>
			</thead>
			<tbody>
				{#each filtered as row, i (row.id)}
					<tr
						class="border-t"
						style="border-color: var(--border); background: {i % 2 === 0
							? 'var(--color-bg-1)'
							: 'var(--color-bg-2)'};"
					>
						<td class="px-3 py-2.5 font-medium" style="color: var(--color-text-1);">
							{row.fullName}
						</td>
						<td class="px-3 py-2.5" style="color: var(--color-text-2);">{row.schoolName}</td>
						<td class="px-3 py-2.5"><CategoryChip category={row.category} /></td>
						<td class="px-3 py-2.5" style="color: var(--color-text-2);">
							{row.theme ?? '—'}
						</td>
						<td class="px-3 py-2.5" style="color: var(--color-text-2);">
							{row.judgeName ?? '—'}
						</td>
						<td class="px-3 py-2.5">
							<button
								type="button"
								class="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] transition hover:opacity-80"
								style="background: var(--color-bg-3); color: var(--color-text-1);"
								onclick={() => (row.qualified ? openDq(row) : askRequalify(row))}
								title={row.qualified ? 'Mark disqualified' : 'Requalify'}
							>
								<span
									class="h-2 w-2 rounded-full"
									style="background: {row.qualified
										? 'var(--color-success)'
										: 'var(--color-danger)'};"
								></span>
								{row.qualified ? 'qualified' : 'DQ'}
							</button>
						</td>
						<td class="px-3 py-2.5">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-sm transition hover:bg-white/5"
									style="color: var(--color-text-2);"
									onclick={() => openEdit(row)}
									aria-label="Edit"
									title="Edit"
								>
									<Pencil size={16} strokeWidth={1.5} />
								</button>
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-sm transition hover:bg-white/5"
									style="color: var(--color-danger);"
									onclick={() => askDelete(row)}
									aria-label="Delete"
									title="Delete"
								>
									<Trash2 size={16} strokeWidth={1.5} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr>
						<td colspan="7" class="px-3 py-10 text-center text-sm" style="color: var(--color-text-2);">
							No matches for current filters.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
{/if}

<!-- Create modal -->
<Modal bind:open={createOpen} title="Add participant" size="md">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				createOpen = false;
				newName = '';
				newSchool = '';
				newCategory = 'A';
				newTheme = '';
			};
		}}
		class="space-y-4"
	>
		<Input label="Full name" name="full_name" required bind:value={newName} />
		<Select label="School" name="school_id" bind:value={newSchool} required>
			<option value="">— pick a school —</option>
			{#each data.schools as s (s.id)}
				<option value={s.id}>{s.name}</option>
			{/each}
		</Select>
		<Select label="Category" name="category" bind:value={newCategory} required>
			<option value="A">A</option>
			<option value="B">B</option>
			<option value="C">C</option>
		</Select>
		<Select label="Theme (optional)" name="theme" bind:value={newTheme}>
			<option value="">— unknown —</option>
			{#each themes as t (t)}
				<option value={t}>{t}</option>
			{/each}
		</Select>
		<div class="flex justify-end gap-2 pt-2">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit">Add</Button>
		</div>
	</form>
</Modal>

<!-- Edit modal -->
<Modal bind:open={editOpen} title="Edit participant" size="md">
	{#if editing}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					editOpen = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={editing.id} />
			<Input label="Full name" name="full_name" required bind:value={editName} />
			<Select label="School" name="school_id" bind:value={editSchool} required>
				{#each data.schools as s (s.id)}
					<option value={s.id}>{s.name}</option>
				{/each}
			</Select>
			<Select label="Category" name="category" bind:value={editCategory} required>
				<option value="A">A</option>
				<option value="B">B</option>
				<option value="C">C</option>
			</Select>
			<Select label="Theme" name="theme" bind:value={editTheme}>
				<option value="">— unknown —</option>
				{#each themes as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</Select>
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button variant="primary" type="submit">Save</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- DQ modal -->
<Modal bind:open={dqOpen} title="Disqualify participant" size="md">
	{#if dqing}
		<form
			method="POST"
			action="?/dq"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					dqOpen = false;
					dqing = null;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={dqing.id} />
			<p class="text-sm" style="color: var(--color-text-2);">
				Disqualifying <strong style="color: var(--color-text-1);">{dqing.fullName}</strong> hides
				them from the leaderboard. Their scoresheets remain in the system for audit.
			</p>
			<Select label="Reason" name="reason" bind:value={dqReason} required>
				{#each reasons as r (r.value)}
					<option value={r.value}>{r.label}</option>
				{/each}
			</Select>
			<label class="block">
				<span
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);"
				>
					Notes <span style="color: var(--color-accent);">•</span>
				</span>
				<textarea
					name="notes"
					required
					minlength="3"
					maxlength="1000"
					rows="3"
					bind:value={dqNotes}
					class="w-full rounded-sm border px-3 py-2.5 text-sm focus:outline-none"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				></textarea>
			</label>
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (dqOpen = false)}>Cancel</Button>
				<Button variant="danger" type="submit" disabled={dqNotes.trim().length < 3}>
					{#snippet icon()}<Ban size={16} strokeWidth={1.5} />{/snippet}
					Disqualify
				</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Import modal -->
<Modal bind:open={importOpen} title="Import participants (CSV)" size="lg">
	{#if preview}
		<div class="space-y-4">
			<div
				class="rounded-(--radius) border p-4"
				style="background: var(--color-bg-3); border-color: var(--border-strong);"
			>
				<p class="text-sm" style="color: var(--color-text-1);">
					<strong>{preview.newSchoolCount}</strong> new school{preview.newSchoolCount === 1 ? '' : 's'}
					will be created.
				</p>
				<p class="mt-1 text-sm" style="color: var(--color-text-1);">
					<strong>{preview.rowCount}</strong> participant{preview.rowCount === 1 ? '' : 's'} will
					be added.
				</p>
				{#if preview.newSchoolNames.length > 0}
					<details class="mt-3">
						<summary class="cursor-pointer text-xs" style="color: var(--color-text-2);">
							Show new school list
						</summary>
						<ul
							class="mt-2 max-h-40 overflow-y-auto text-xs"
							style="color: var(--color-text-2); font-family: var(--font-mono);"
						>
							{#each preview.newSchoolNames as s (s)}
								<li>{s}</li>
							{/each}
						</ul>
					</details>
				{/if}
			</div>
			<div class="flex justify-end gap-2">
				<Button
					variant="ghost"
					onclick={() => {
						preview = null;
						pendingCsv = '';
					}}
				>
					Back
				</Button>
				<Button variant="primary" onclick={commitImport} loading={committing}>
					Commit import
				</Button>
			</div>
		</div>
	{:else}
		<p class="mb-3 text-sm" style="color: var(--color-text-2);">
			Headers required: <code>full_name</code>, <code>school_name</code>, <code>category</code>.
			Optional: <code>theme</code>. Schools are created automatically if they don't exist.
		</p>
		<CsvUpload
			headersExpected={['full_name', 'school_name', 'category', 'theme']}
			oncommit={previewImport}
			{committing}
		/>
	{/if}
</Modal>

{#if delRow}
	<ConfirmModal
		bind:open={confirmDelOpen}
		title="Delete participant?"
		message="Delete '{delRow.fullName}'? This cascades any scoresheets they have. Cannot be undone."
		danger
		confirmLabel="Delete"
		onconfirm={doDelete}
		oncancel={() => {
			confirmDelOpen = false;
			delRow = null;
		}}
	/>
{/if}

{#if requalRow}
	<ConfirmModal
		bind:open={confirmReqOpen}
		title="Requalify participant?"
		message="Bring '{requalRow.fullName}' back into the leaderboard."
		confirmLabel="Requalify"
		onconfirm={doRequalify}
		oncancel={() => {
			confirmReqOpen = false;
			requalRow = null;
		}}
	/>
{/if}
