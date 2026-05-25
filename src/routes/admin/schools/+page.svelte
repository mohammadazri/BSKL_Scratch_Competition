<!--
	/admin/schools — list, create, edit, delete-if-empty, CSV import.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Input from '$lib/components/Input.svelte';
	import CsvUpload from '$lib/components/CsvUpload.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Plus, Pencil, Trash2, Upload, School as SchoolIcon } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import type { SchoolRow } from './+page.server';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let createOpen = $state(false);
	let editOpen = $state(false);
	let importOpen = $state(false);
	let confirmOpen = $state(false);
	let confirmRow = $state<SchoolRow | null>(null);
	let committing = $state(false);

	let editing = $state<SchoolRow | null>(null);
	let editName = $state('');
	let editShort = $state('');
	let newName = $state('');
	let newShort = $state('');

	function openEdit(row: SchoolRow) {
		editing = row;
		editName = row.name;
		editShort = row.shortCode ?? '';
		editOpen = true;
	}

	function askDelete(row: SchoolRow) {
		confirmRow = row;
		confirmOpen = true;
	}

	async function doDelete() {
		if (!confirmRow) return;
		const fd = new FormData();
		fd.set('id', confirmRow.id);
		await fetch('?/delete', { method: 'POST', body: fd });
		await invalidateAll();
		confirmOpen = false;
		confirmRow = null;
	}

	async function importRows(rows: Record<string, string>[]) {
		// We submit the CSV back as a `csv` field for server-side re-parse + insert.
		// Re-stringify only the columns we accept.
		const headers = ['name', 'short_code'];
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
		await fetch('?/import', { method: 'POST', body: fd });
		await invalidateAll();
		committing = false;
		importOpen = false;
	}
</script>

<svelte:head>
	<title>Schools · P3 Judging</title>
</svelte:head>

<PageHeader title="Schools" subtitle="Manage participating schools.">
	{#snippet actions()}
		<Button variant="secondary" onclick={() => (importOpen = true)}>
			{#snippet icon()}<Upload size={16} strokeWidth={1.5} />{/snippet}
			Import CSV
		</Button>
		<Button variant="primary" onclick={() => (createOpen = true)}>
			{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
			Add school
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

{#if data.rows.length === 0}
	<EmptyState
		icon={SchoolIcon}
		title="No schools yet"
		description="Add a school manually, or import a CSV of school names."
	>
		{#snippet action()}
			<div class="flex gap-2">
				<Button variant="secondary" onclick={() => (importOpen = true)}>
					{#snippet icon()}<Upload size={16} strokeWidth={1.5} />{/snippet}
					Import CSV
				</Button>
				<Button variant="primary" onclick={() => (createOpen = true)}>
					{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
					Add school
				</Button>
			</div>
		{/snippet}
	</EmptyState>
{:else}
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
						style="color: var(--color-text-2);">Short code</th
					>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Participants</th
					>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Actions</th
					>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as row, i (row.id)}
					<tr
						class="border-t"
						style="border-color: var(--border); background: {i % 2 === 0
							? 'var(--color-bg-1)'
							: 'var(--color-bg-2)'};"
					>
						<td class="px-3 py-2.5 font-medium" style="color: var(--color-text-1);">{row.name}</td>
						<td
							class="px-3 py-2.5"
							style="color: var(--color-text-2); font-family: var(--font-mono);"
						>
							{row.shortCode ?? '—'}
						</td>
						<td
							class="px-3 py-2.5 text-right"
							style="color: var(--color-text-1); font-family: var(--font-mono);"
						>
							{row.participantCount}
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
									class="grid h-9 w-9 place-items-center rounded-sm transition hover:bg-white/5 disabled:opacity-30"
									style="color: var(--color-danger);"
									onclick={() => askDelete(row)}
									disabled={row.participantCount > 0}
									aria-label="Delete"
									title={row.participantCount > 0
										? 'Cannot delete — has participants'
										: 'Delete'}
								>
									<Trash2 size={16} strokeWidth={1.5} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Create modal -->
<Modal bind:open={createOpen} title="Add school" size="sm">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				createOpen = false;
				newName = '';
				newShort = '';
			};
		}}
		class="space-y-4"
	>
		<Input label="Name" name="name" required bind:value={newName} />
		<Input
			label="Short code (optional)"
			name="short_code"
			bind:value={newShort}
			hint="e.g. BSKL"
		/>
		<div class="flex justify-end gap-2 pt-2">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit">Add</Button>
		</div>
	</form>
</Modal>

<!-- Edit modal -->
<Modal bind:open={editOpen} title="Edit school" size="sm">
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
			<Input label="Name" name="name" required bind:value={editName} />
			<Input label="Short code" name="short_code" bind:value={editShort} />
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button variant="primary" type="submit">Save</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Import modal -->
<Modal bind:open={importOpen} title="Import schools (CSV)" size="lg">
	<p class="mb-3 text-sm" style="color: var(--color-text-2);">
		Upload a CSV with a <code>name</code> column (and optional <code>short_code</code>). Duplicates by
		name are skipped automatically.
	</p>
	<CsvUpload
		headersExpected={['name', 'short_code']}
		oncommit={importRows}
		{committing}
	/>
</Modal>

{#if confirmRow}
	<ConfirmModal
		bind:open={confirmOpen}
		title="Delete school?"
		message="Delete '{confirmRow.name}'? This cannot be undone."
		danger
		confirmLabel="Delete"
		onconfirm={doDelete}
		oncancel={() => {
			confirmOpen = false;
			confirmRow = null;
		}}
	/>
{/if}
