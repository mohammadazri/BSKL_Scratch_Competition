<!--
	/admin/schools — list with name + short code + participant count, plus
	a "New school" modal, edit/delete actions, and a CSV import card.
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
	import CsvUpload from '$lib/components/CsvUpload.svelte';
	import { toasts } from '$lib/stores/toast';
	import { Plus, Pencil, Trash2, Upload } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';
	import type { SchoolRow } from './+page.server';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let createOpen = $state(false);
	let editOpen = $state(false);
	let importOpen = $state(false);
	let confirmOpen = $state(false);
	let editing = $state<SchoolRow | null>(null);
	let editName = $state('');
	let editCode = $state('');
	let newName = $state('');
	let newCode = $state('');
	let deletingId = $state<string | null>(null);
	let deletingName = $state('');
	let committing = $state(false);

	function openEdit(row: SchoolRow) {
		editing = row;
		editName = row.name;
		editCode = row.shortCode ?? '';
		editOpen = true;
	}

	function openDelete(row: SchoolRow) {
		if (row.participantCount > 0) {
			toasts.error(
				`${row.name} has ${row.participantCount} participants — remove them first.`,
				'Cannot delete'
			);
			return;
		}
		deletingId = row.id;
		deletingName = row.name;
		confirmOpen = true;
	}

	async function confirmDelete() {
		if (!deletingId) return;
		const fd = new FormData();
		fd.set('id', deletingId);
		const res = await fetch('?/delete', { method: 'POST', body: fd });
		await invalidateAll();
		confirmOpen = false;
		deletingId = null;
		if (res.ok) toasts.success('School deleted.');
		else toasts.error('Failed to delete school.');
	}

	async function commitImport(rows: Record<string, string>[]) {
		committing = true;
		try {
			// Relative path so the same component works under /admin and /registration.
			const res = await fetch('./import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows })
			});
			const body = (await res.json()) as {
				ok: boolean;
				created?: number;
				skipped?: number;
				error?: string;
			};
			if (!body.ok) {
				toasts.error(body.error ?? 'Import failed.');
				return;
			}
			toasts.success(
				`Imported ${body.created ?? 0} new schools` +
					(body.skipped ? ` (${body.skipped} duplicates skipped)` : '')
			);
			importOpen = false;
			await invalidateAll();
		} finally {
			committing = false;
		}
	}
</script>

<svelte:head>
	<title>Schools · P3 Judging</title>
</svelte:head>

<PageHeader title="Schools" subtitle="Add the schools sending participants to the event.">
	{#snippet actions()}
		<Button variant="secondary" onclick={() => (importOpen = true)}>
			{#snippet icon()}<Upload size={16} strokeWidth={1.5} />{/snippet}
			Import CSV
		</Button>
		<Button variant="primary" onclick={() => (createOpen = true)}>
			{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
			New school
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

<div
	class="overflow-x-auto rounded-[var(--radius)] border"
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
					<td class="px-3 py-2.5 font-medium" style="color: var(--color-text-1);">
						{row.name}
					</td>
					<td
						class="px-3 py-2.5 text-xs"
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
							<button
								type="button"
								class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5 disabled:opacity-30"
								style="color: var(--color-danger);"
								onclick={() => openDelete(row)}
								disabled={row.participantCount > 0}
								aria-label="Delete"
								title={row.participantCount > 0
									? 'Has participants — cannot delete'
									: 'Delete'}
							>
								<Trash2 size={16} strokeWidth={1.5} />
							</button>
						</div>
					</td>
				</tr>
			{/each}
			{#if data.rows.length === 0}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm" style="color: var(--color-text-2);">
						No schools yet. Click <strong>Import CSV</strong> or <strong>New school</strong>.
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<!-- New school -->
<Modal bind:open={createOpen} title="New school" size="sm">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				createOpen = false;
				newName = '';
				newCode = '';
			};
		}}
		class="space-y-4"
	>
		<Input label="Name" name="name" required bind:value={newName} />
		<Input label="Short code (optional)" name="short_code" bind:value={newCode} hint="e.g. BSKL" />
		<div class="flex justify-end gap-2 pt-2">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit">Add school</Button>
		</div>
	</form>
</Modal>

<!-- Edit school -->
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
			<Input label="Short code (optional)" name="short_code" bind:value={editCode} />
			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button variant="primary" type="submit">Save</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- CSV import -->
<Modal bind:open={importOpen} title="Import schools from CSV" size="lg">
	<p class="mb-4 text-sm" style="color: var(--color-text-2);">
		Upload a CSV with a <span style="font-family: var(--font-mono);">name</span> column (and
		optional <span style="font-family: var(--font-mono);">short_code</span>). Existing schools
		with the same name are skipped.
	</p>
	<CsvUpload
		headersExpected={['name', 'short_code']}
		oncommit={commitImport}
		{committing}
	/>
</Modal>

<ConfirmModal
	bind:open={confirmOpen}
	title="Delete school?"
	message="{deletingName} will be permanently removed. This can't be undone."
	confirmLabel="Delete"
	danger
	onconfirm={confirmDelete}
	oncancel={() => {
		confirmOpen = false;
		deletingId = null;
	}}
/>
