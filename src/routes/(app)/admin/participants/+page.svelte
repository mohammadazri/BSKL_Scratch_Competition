<!--
	/admin/participants — list, create modal, edit modal, delete, DQ toggle,
	and CSV import (with preview).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { parseCsv } from '$lib/utils/csv';
	import { toasts } from '$lib/stores/toast';
	import { Plus, Pencil, Trash2, Upload, Ban, CheckCircle2, FileText } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import type { ParticipantRow } from './+page.server';
	import type { Category, DqReason, Theme } from '$lib/types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let createOpen = $state(false);
	let editOpen = $state(false);
	let importOpen = $state(false);
	let dqOpen = $state(false);
	let requalifyOpen = $state(false);
	let deleteOpen = $state(false);

	let editing = $state<ParticipantRow | null>(null);
	let editName = $state('');
	let editSchoolId = $state('');
	let editCategory = $state<Category>('A');
	let editTheme = $state<Theme | ''>('');

	let newName = $state('');
	let newSchoolId = $state('');
	let newCategory = $state<Category>('A');
	let newTheme = $state<Theme | ''>('');

	let dqing = $state<ParticipantRow | null>(null);
	let dqReason = $state<DqReason>('tutorial_or_ai_use');
	let dqNotes = $state('');

	let requalifying = $state<ParticipantRow | null>(null);
	let deleting = $state<ParticipantRow | null>(null);

	let categoryFilter = $state<Category | 'all'>('all');

	const filteredRows = $derived(
		categoryFilter === 'all' ? data.rows : data.rows.filter((r) => r.category === categoryFilter)
	);

	// ─── CSV import state ────────────────────────────────────────
	let csvFile = $state<File | null>(null);
	let csvParsedRows = $state<Record<string, string>[]>([]);
	let csvErrors = $state<{ line: number; message: string }[]>([]);
	let csvPreview = $state<{
		newSchools: string[];
		participants: number;
		byCategory: { A: number; B: number; C: number };
	} | null>(null);
	let csvCommitting = $state(false);

	async function onCsvFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0] ?? null;
		csvFile = f;
		csvParsedRows = [];
		csvErrors = [];
		csvPreview = null;
		if (!f) return;
		const text = await f.text();
		const parsed = parseCsv(text);
		const missing = ['full_name', 'school_name', 'category'].filter(
			(h) => !parsed.headers.includes(h)
		);
		if (missing.length > 0) {
			csvErrors = [{ line: 1, message: `missing headers: ${missing.join(', ')}` }];
			return;
		}
		csvErrors = parsed.errors;
		csvParsedRows = parsed.rows;

		// Ask the server to preview (no write).
		const res = await fetch('/admin/participants/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ rows: parsed.rows, commit: false })
		});
		const body = (await res.json()) as {
			ok: boolean;
			error?: string;
			errors?: { line: number; message: string }[];
			newSchools?: string[];
			participants?: number;
			byCategory?: { A: number; B: number; C: number };
		};
		if (!body.ok) {
			csvErrors = [
				...(csvErrors ?? []),
				...(body.errors ?? [{ line: 0, message: body.error ?? 'Preview failed.' }])
			];
			return;
		}
		csvPreview = {
			newSchools: body.newSchools ?? [],
			participants: body.participants ?? 0,
			byCategory: body.byCategory ?? { A: 0, B: 0, C: 0 }
		};
	}

	async function commitImport() {
		csvCommitting = true;
		try {
			const res = await fetch('/admin/participants/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows: csvParsedRows, commit: true })
			});
			const body = (await res.json()) as {
				ok: boolean;
				error?: string;
				created?: number;
				newSchools?: number;
			};
			if (!body.ok) {
				toasts.error(body.error ?? 'Import failed.');
				return;
			}
			toasts.success(
				`Imported ${body.created} participants` +
					(body.newSchools ? ` and created ${body.newSchools} new schools.` : '.')
			);
			importOpen = false;
			csvFile = null;
			csvParsedRows = [];
			csvPreview = null;
			csvErrors = [];
			await invalidateAll();
		} finally {
			csvCommitting = false;
		}
	}

	function openEdit(row: ParticipantRow) {
		editing = row;
		editName = row.fullName;
		editSchoolId = row.schoolId;
		editCategory = row.category;
		editTheme = row.theme ?? '';
		editOpen = true;
	}

	function openDq(row: ParticipantRow) {
		dqing = row;
		dqReason = 'tutorial_or_ai_use';
		dqNotes = '';
		dqOpen = true;
	}

	function openRequalify(row: ParticipantRow) {
		requalifying = row;
		requalifyOpen = true;
	}

	function openDelete(row: ParticipantRow) {
		deleting = row;
		deleteOpen = true;
	}

	async function submitRequalify() {
		if (!requalifying) return;
		const fd = new FormData();
		fd.set('id', requalifying.id);
		fd.set('dq', 'false');
		const res = await fetch('?/setDq', { method: 'POST', body: fd });
		await invalidateAll();
		requalifyOpen = false;
		requalifying = null;
		if (res.ok) toasts.success('Re-qualified.');
		else toasts.error('Failed.');
	}

	async function submitDelete() {
		if (!deleting) return;
		const fd = new FormData();
		fd.set('id', deleting.id);
		const res = await fetch('?/delete', { method: 'POST', body: fd });
		await invalidateAll();
		deleteOpen = false;
		deleting = null;
		if (res.ok) toasts.success('Participant deleted.');
		else toasts.error('Failed.');
	}
</script>

<svelte:head>
	<title>Participants · P3 Judging</title>
</svelte:head>

<PageHeader title="Participants" subtitle="Up to 45 per category, 135 total.">
	{#snippet actions()}
		<Button variant="secondary" onclick={() => (importOpen = true)}>
			{#snippet icon()}<Upload size={16} strokeWidth={1.5} />{/snippet}
			Import CSV
		</Button>
		<Button variant="primary" onclick={() => (createOpen = true)} disabled={data.schools.length === 0}>
			{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
			New participant
		</Button>
	{/snippet}
</PageHeader>

{#if form?.message}
	<div
		class="mb-4 rounded-[var(--radius)] border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-success); color: var(--color-success);"
	>
		{form.message}
	</div>
{:else if form?.error}
	<div
		class="mb-4 rounded-[var(--radius)] border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		{form.error}
	</div>
{/if}

{#if data.schools.length === 0}
	<EmptyState
		title="No schools yet"
		description="Add at least one school before creating participants."
	>
		{#snippet action()}
			<Button variant="primary" href="/admin/schools">Add schools</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="mb-4 flex items-center gap-2">
		<span class="text-xs tracking-wider uppercase" style="color: var(--color-text-2);">Filter:</span>
		{#each ['all', 'A', 'B', 'C'] as f (f)}
			<button
				type="button"
				class="rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-medium"
				style="background: {categoryFilter === f
					? 'var(--accent-soft)'
					: 'transparent'}; border-color: {categoryFilter === f
					? 'var(--color-accent)'
					: 'var(--border)'}; color: var(--color-text-1);"
				onclick={() => (categoryFilter = f as Category | 'all')}
			>
				{f === 'all' ? 'All' : `Cat ${f}`}
			</button>
		{/each}
		<span class="ml-auto text-xs" style="color: var(--color-text-3);">
			{filteredRows.length} of {data.rows.length}
		</span>
	</div>

	<div
		class="overflow-x-auto rounded-[var(--radius)] border"
		style="border-color: var(--border); background: var(--color-bg-1);"
	>
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr style="background: var(--color-bg-3);">
					{#each ['Name', 'School', 'Cat', 'Theme', 'Judge', 'Status', ''] as h, i (i)}
						<th
							class="px-3 py-2 text-[11px] font-medium tracking-wider uppercase whitespace-nowrap"
							style="color: var(--color-text-2); text-align: {h === '' ? 'right' : 'left'};"
						>
							{h || 'Actions'}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each filteredRows as row, i (row.id)}
					<tr
						class="border-t"
						style="border-color: var(--border); background: {i % 2 === 0
							? 'var(--color-bg-1)'
							: 'var(--color-bg-2)'};"
					>
						<td class="px-3 py-2.5 font-medium" style="color: var(--color-text-1);">
							{row.fullName}
						</td>
						<td class="px-3 py-2.5 text-xs" style="color: var(--color-text-2);">
							{row.schoolName}
						</td>
						<td class="px-3 py-2.5"><CategoryChip category={row.category} /></td>
						<td class="px-3 py-2.5 text-xs" style="color: var(--color-text-2);">
							{row.theme ?? '—'}
						</td>
						<td class="px-3 py-2.5 text-xs" style="color: var(--color-text-2);">
							{row.judgeName ?? '—'}
						</td>
						<td class="px-3 py-2.5">
							{#if row.qualified}
								<StatusPill status="submitted" label="Qualified" />
							{:else}
								<StatusPill status="dq" />
							{/if}
						</td>
						<td class="px-3 py-2.5 text-right">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
									style="color: var(--color-text-2);"
									onclick={() => openEdit(row)}
									aria-label="Edit"
									title="Edit"
								>
									<Pencil size={16} strokeWidth={1.5} />
								</button>
								{#if row.qualified}
									<button
										type="button"
										class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
										style="color: var(--color-danger);"
										onclick={() => openDq(row)}
										aria-label="Disqualify"
										title="Disqualify"
									>
										<Ban size={16} strokeWidth={1.5} />
									</button>
								{:else}
									<button
										type="button"
										class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
										style="color: var(--color-success);"
										onclick={() => openRequalify(row)}
										aria-label="Re-qualify"
										title="Re-qualify"
									>
										<CheckCircle2 size={16} strokeWidth={1.5} />
									</button>
								{/if}
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
									style="color: var(--color-danger);"
									onclick={() => openDelete(row)}
									aria-label="Delete"
									title="Delete"
								>
									<Trash2 size={16} strokeWidth={1.5} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
				{#if filteredRows.length === 0}
					<tr>
						<td colspan="7" class="px-6 py-10 text-center text-sm" style="color: var(--color-text-2);">
							No participants match.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
{/if}

<!-- Create -->
<Modal bind:open={createOpen} title="New participant" size="md">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				createOpen = false;
				newName = '';
				newSchoolId = '';
				newCategory = 'A';
				newTheme = '';
			};
		}}
		class="space-y-4"
	>
		<Input label="Full name" name="full_name" required bind:value={newName} />
		<Select label="School" name="school_id" required bind:value={newSchoolId}>
			<option value="" disabled>Choose…</option>
			{#each data.schools as s (s.id)}
				<option value={s.id}>{s.name}</option>
			{/each}
		</Select>
		<Select label="Category" name="category" required bind:value={newCategory}>
			<option value="A">A</option>
			<option value="B">B</option>
			<option value="C">C</option>
		</Select>
		<Select label="Theme (optional)" name="theme" bind:value={newTheme}>
			<option value="">— none —</option>
			<option value="Eco-Warriors">Eco-Warriors</option>
			<option value="Smart Cities">Smart Cities</option>
			<option value="Space Pioneers">Space Pioneers</option>
		</Select>
		<div class="flex justify-end gap-2 pt-2">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit">Add</Button>
		</div>
	</form>
</Modal>

<!-- Edit -->
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
			<Select label="School" name="school_id" required bind:value={editSchoolId}>
				{#each data.schools as s (s.id)}
					<option value={s.id}>{s.name}</option>
				{/each}
			</Select>
			<Select label="Category" name="category" required bind:value={editCategory}>
				<option value="A">A</option>
				<option value="B">B</option>
				<option value="C">C</option>
			</Select>
			<Select label="Theme (optional)" name="theme" bind:value={editTheme}>
				<option value="">— none —</option>
				<option value="Eco-Warriors">Eco-Warriors</option>
				<option value="Smart Cities">Smart Cities</option>
				<option value="Space Pioneers">Space Pioneers</option>
			</Select>
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button variant="primary" type="submit">Save</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- DQ (participant level) -->
<Modal bind:open={dqOpen} title="Disqualify participant" size="md">
	{#if dqing}
		<form
			method="POST"
			action="?/setDq"
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
			<input type="hidden" name="dq" value="true" />
			<p class="text-sm" style="color: var(--color-text-2);">
				<strong style="color: var(--color-text-1);">{dqing.fullName}</strong> will be excluded
				from the leaderboard. The reason is logged in the audit trail.
			</p>
			<Select label="Reason" name="reason" required bind:value={dqReason}>
				<option value="complete_on_arrival">Complete on arrival</option>
				<option value="tutorial_or_ai_use">Tutorial or AI use</option>
				<option value="parental_assistance">Parental assistance</option>
				<option value="unsportsmanlike_conduct">Unsportsmanlike conduct</option>
				<option value="other">Other</option>
			</Select>
			<Textarea
				label="Notes"
				name="notes"
				required
				bind:value={dqNotes}
				rows={3}
				placeholder="What was observed?"
			/>
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (dqOpen = false)}>Cancel</Button>
				<Button variant="danger" type="submit">Disqualify</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Re-qualify confirm -->
<ConfirmModal
	bind:open={requalifyOpen}
	title="Re-qualify participant?"
	message={requalifying
		? `${requalifying.fullName} will be eligible for ranking again.`
		: ''}
	confirmLabel="Yes, re-qualify"
	onconfirm={submitRequalify}
	oncancel={() => {
		requalifyOpen = false;
		requalifying = null;
	}}
/>

<!-- Delete confirm -->
<ConfirmModal
	bind:open={deleteOpen}
	title="Delete participant?"
	message={deleting ? `${deleting.fullName} and any related scoresheets will be deleted. This can't be undone.` : ''}
	confirmLabel="Delete"
	danger
	onconfirm={submitDelete}
	oncancel={() => {
		deleteOpen = false;
		deleting = null;
	}}
/>

<!-- CSV import (with preview) -->
<Modal bind:open={importOpen} title="Import participants from CSV" size="lg">
	<p class="mb-3 text-sm" style="color: var(--color-text-2);">
		Headers required:
		<span style="font-family: var(--font-mono);">full_name,school_name,category,theme</span>
		(theme optional). Missing schools are auto-created.
	</p>

	<div
		class="mb-3 flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed p-6 text-center"
		style="border-color: var(--border-strong); background: var(--color-bg-1);"
	>
		<p class="text-sm font-semibold" style="color: var(--color-text-1);">
			{csvFile ? csvFile.name : 'Choose a CSV file'}
		</p>
		<label
			class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium transition hover:opacity-90"
			style="background: var(--color-bg-3); color: var(--color-text-1); border: 1px solid var(--border-strong); min-height: 44px;"
		>
			<FileText size={16} strokeWidth={1.5} />
			{csvFile ? 'Choose another file' : 'Select file'}
			<input type="file" accept=".csv,text/csv" class="sr-only" onchange={onCsvFile} />
		</label>
	</div>

	{#if csvErrors.length > 0}
		<div
			class="mb-3 rounded-[var(--radius)] border p-3 text-sm"
			style="border-color: var(--color-danger); background: rgba(239, 68, 68, 0.06); color: var(--color-danger);"
		>
			<p class="mb-1 font-semibold">
				{csvErrors.length} problem{csvErrors.length === 1 ? '' : 's'} — no rows will be imported:
			</p>
			<ul class="space-y-0.5 text-xs">
				{#each csvErrors.slice(0, 8) as e (e.line)}
					<li>line {e.line}: {e.message}</li>
				{/each}
				{#if csvErrors.length > 8}
					<li>… and {csvErrors.length - 8} more</li>
				{/if}
			</ul>
		</div>
	{/if}

	{#if csvPreview && csvErrors.length === 0}
		<Card label="Preview">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div>
					<p class="text-[11px] tracking-wider uppercase" style="color: var(--color-text-2);">
						Participants
					</p>
					<p class="text-2xl font-semibold" style="font-family: var(--font-mono); color: var(--color-text-1);">
						{csvPreview.participants}
					</p>
				</div>
				<div>
					<p class="text-[11px] tracking-wider uppercase" style="color: var(--color-text-2);">
						By category
					</p>
					<p class="text-sm" style="font-family: var(--font-mono); color: var(--color-text-1);">
						A {csvPreview.byCategory.A} · B {csvPreview.byCategory.B} · C {csvPreview.byCategory.C}
					</p>
				</div>
				<div>
					<p class="text-[11px] tracking-wider uppercase" style="color: var(--color-text-2);">
						New schools
					</p>
					<p class="text-sm" style="font-family: var(--font-mono); color: var(--color-text-1);">
						{csvPreview.newSchools.length}
					</p>
				</div>
			</div>
			{#if csvPreview.newSchools.length > 0}
				<p class="mt-3 text-xs" style="color: var(--color-text-2);">
					Will be created: {csvPreview.newSchools.join(', ')}
				</p>
			{/if}
		</Card>

		<div class="mt-4 flex justify-end gap-2">
			<Button
				variant="ghost"
				onclick={() => {
					csvFile = null;
					csvParsedRows = [];
					csvPreview = null;
				}}
				disabled={csvCommitting}>Reset</Button
			>
			<Button variant="primary" onclick={commitImport} loading={csvCommitting}>
				Import {csvPreview.participants} participants
			</Button>
		</div>
	{/if}
</Modal>
