<!--
	/admin/users — list, create, edit role + categories, deactivate, reset.
	Custom table layout (avatar, role pill, category chips, status pill).
	Modal flow for create/edit; confirm modal for destructive actions.
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
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import RolePill from '$lib/components/RolePill.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Plus, Pencil, Power, KeyRound, Printer, Users as UsersIcon } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import type { UserRow } from './+page.server';
	import type { Category, Role } from '$lib/types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// ─── Modals state ────────────────────────────────────────────
	let createOpen = $state(false);
	let editOpen = $state(false);
	let confirmOpen = $state(false);
	let confirmConfig = $state<{
		title: string;
		message: string;
		action: string;
		id: string;
		danger: boolean;
	} | null>(null);

	// ─── Edit-modal local state ──────────────────────────────────
	let editing = $state<UserRow | null>(null);
	let editFullName = $state('');
	let editRole = $state<Role>('judge');
	let editCategories = $state<Set<Category>>(new Set());
	let editPinLabel = $state('');

	// ─── Create-modal local state ────────────────────────────────
	let newEmail = $state('');
	let newFullName = $state('');
	let newRole = $state<Role>('judge');
	let newCategories = $state<Set<Category>>(new Set(['A', 'B', 'C']));
	let newPinLabel = $state('');

	const allCats: Category[] = ['A', 'B', 'C'];

	function openEdit(row: UserRow) {
		editing = row;
		editFullName = row.fullName;
		editRole = row.role;
		editCategories = new Set(row.categories);
		editPinLabel = row.pinLabel ?? '';
		editOpen = true;
	}

	function toggleCategory(set: Set<Category>, c: Category): Set<Category> {
		const next = new Set(set);
		if (next.has(c)) next.delete(c);
		else next.add(c);
		return next;
	}

	function confirmDeactivate(row: UserRow) {
		confirmConfig = {
			title: 'Deactivate user?',
			message: `${row.fullName} will no longer be able to sign in. You can reactivate them later.`,
			action: '?/deactivate',
			id: row.id,
			danger: true
		};
		confirmOpen = true;
	}

	function confirmReactivate(row: UserRow) {
		confirmConfig = {
			title: 'Reactivate user?',
			message: `Re-enable sign-in for ${row.fullName}.`,
			action: '?/reactivate',
			id: row.id,
			danger: false
		};
		confirmOpen = true;
	}

	function confirmReset(row: UserRow) {
		confirmConfig = {
			title: 'Reset password?',
			message: `Generate a new temporary password for ${row.fullName}. Their current password stops working immediately. Print new login slips.`,
			action: '?/resetPassword',
			id: row.id,
			danger: true
		};
		confirmOpen = true;
	}

	async function submitConfirm() {
		if (!confirmConfig) return;
		const fd = new FormData();
		fd.set('id', confirmConfig.id);
		const res = await fetch(confirmConfig.action, { method: 'POST', body: fd });
		await invalidateAll();
		confirmOpen = false;
		confirmConfig = null;
		if (!res.ok) {
			alert('Action failed. Check the server log.');
		}
	}

	function fmtLastSeen(iso: string | null): string {
		if (!iso) return 'never';
		const d = new Date(iso);
		const diff = Date.now() - d.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 30) return `${days}d ago`;
		return d.toISOString().slice(0, 10);
	}
</script>

<svelte:head>
	<title>Users · P3 Judging</title>
</svelte:head>

<PageHeader title="Users" subtitle="Manage super-admin, judge, and viewer accounts.">
	{#snippet actions()}
		<Button variant="secondary" href="/admin/users/print">
			{#snippet icon()}<Printer size={16} strokeWidth={1.5} />{/snippet}
			Print login slips
		</Button>
		<Button variant="primary" onclick={() => (createOpen = true)}>
			{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
			New user
		</Button>
	{/snippet}
</PageHeader>

{#if form?.message}
	<div
		class="mb-4 rounded-(--radius) border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-success); color: var(--color-text-1);"
	>
		<p class="font-medium" style="color: var(--color-success);">{form.message}</p>
		{#if form?.created?.password}
			<p class="mt-1 text-xs" style="color: var(--color-text-2);">
				Print the slip from <a href="/admin/users/print" class="underline">login slips</a>
				or copy the password now — it's only shown once.
			</p>
		{/if}
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
		icon={UsersIcon}
		title="No users yet"
		description="Click 'New user' above to create your first judge."
	>
		{#snippet action()}
			<Button variant="primary" onclick={() => (createOpen = true)}>
				{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}
				New user
			</Button>
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
						style="color: var(--color-text-2);"
					>
						User
					</th>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Role
					</th>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Categories
					</th>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Status
					</th>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Last seen
					</th>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Actions
					</th>
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
						<td class="px-3 py-2.5">
							<div class="flex items-center gap-3">
								<UserAvatar name={row.fullName} size={32} />
								<div class="min-w-0">
									<p class="truncate font-medium" style="color: var(--color-text-1);">
										{row.fullName}
									</p>
									<p class="truncate text-xs" style="color: var(--color-text-2);">
										{row.email}
									</p>
								</div>
							</div>
						</td>
						<td class="px-3 py-2.5"><RolePill role={row.role} /></td>
						<td class="px-3 py-2.5">
							<div class="flex gap-1">
								{#each row.categories as c (c)}
									<CategoryChip category={c} />
								{/each}
								{#if row.categories.length === 0}
									<span class="text-xs" style="color: var(--color-text-3);">—</span>
								{/if}
							</div>
						</td>
						<td class="px-3 py-2.5">
							<span
								class="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px]"
								style="background: var(--color-bg-3); color: var(--color-text-1);"
							>
								<span
									class="h-2 w-2 rounded-full"
									style="background: {row.isActive
										? 'var(--color-success)'
										: 'var(--color-danger)'};"
								></span>
								{row.isActive ? 'active' : 'disabled'}
							</span>
						</td>
						<td
							class="px-3 py-2.5 text-xs"
							style="color: var(--color-text-2); font-family: var(--font-mono);"
						>
							{fmtLastSeen(row.lastSignInAt)}
						</td>
						<td class="px-3 py-2.5">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-(--radius-sm) transition hover:bg-white/5"
									style="color: var(--color-text-2);"
									onclick={() => openEdit(row)}
									aria-label="Edit"
									title="Edit"
								>
									<Pencil size={16} strokeWidth={1.5} />
								</button>
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-(--radius-sm) transition hover:bg-white/5"
									style="color: var(--color-text-2);"
									onclick={() => confirmReset(row)}
									aria-label="Reset password"
									title="Reset password"
								>
									<KeyRound size={16} strokeWidth={1.5} />
								</button>
								<button
									type="button"
									class="grid h-9 w-9 place-items-center rounded-(--radius-sm) transition hover:bg-white/5"
									style="color: {row.isActive ? 'var(--color-danger)' : 'var(--color-success)'};"
									onclick={() => (row.isActive ? confirmDeactivate(row) : confirmReactivate(row))}
									aria-label={row.isActive ? 'Deactivate' : 'Reactivate'}
									title={row.isActive ? 'Deactivate' : 'Reactivate'}
								>
									<Power size={16} strokeWidth={1.5} />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Edit modal -->
<Modal bind:open={editOpen} title="Edit user" size="md">
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
			<Input label="Full name" name="full_name" required bind:value={editFullName} />
			<Select label="Role" name="role" bind:value={editRole} required>
				<option value="super_admin">Super admin</option>
				<option value="judge">Judge</option>
				<option value="viewer">Viewer</option>
			</Select>

			{#if editRole === 'judge'}
				<fieldset>
					<legend
						class="mb-1 block text-xs font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);"
					>
						Categories <span style="color: var(--color-accent);">•</span>
					</legend>
					<div class="flex gap-3">
						{#each allCats as cat (cat)}
							<label
								class="flex h-11 min-w-12 cursor-pointer items-center gap-2 rounded-(--radius-sm) border px-3 text-sm"
								style="background: {editCategories.has(cat)
									? 'var(--accent-soft)'
									: 'var(--color-bg-3)'}; border-color: {editCategories.has(cat)
									? 'var(--color-accent)'
									: 'var(--border)'}; color: var(--color-text-1);"
							>
								<input
									type="checkbox"
									name="categories"
									value={cat}
									checked={editCategories.has(cat)}
									onchange={() => (editCategories = toggleCategory(editCategories, cat))}
									class="h-4 w-4"
								/>
								{cat}
							</label>
						{/each}
					</div>
				</fieldset>
			{/if}

			<Input
				label="PIN label (optional)"
				name="pin_label"
				bind:value={editPinLabel}
				hint="e.g. 'Sticky note #3'"
			/>

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button variant="primary" type="submit">Save changes</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Create modal -->
<Modal bind:open={createOpen} title="Create user" size="md">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				createOpen = false;
				newEmail = '';
				newFullName = '';
				newRole = 'judge';
				newCategories = new Set(['A', 'B', 'C']);
				newPinLabel = '';
			};
		}}
		class="space-y-4"
	>
		<Input
			label="Email"
			name="email"
			type="email"
			required
			bind:value={newEmail}
			autocomplete="off"
		/>
		<Input label="Full name" name="full_name" required bind:value={newFullName} />
		<Select label="Role" name="role" bind:value={newRole} required>
			<option value="super_admin">Super admin</option>
			<option value="judge">Judge</option>
			<option value="viewer">Viewer</option>
		</Select>

		{#if newRole === 'judge'}
			<fieldset>
				<legend
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);"
				>
					Categories <span style="color: var(--color-accent);">•</span>
				</legend>
				<div class="flex gap-3">
					{#each allCats as cat (cat)}
						<label
							class="flex h-11 min-w-12 cursor-pointer items-center gap-2 rounded-(--radius-sm) border px-3 text-sm"
							style="background: {newCategories.has(cat)
								? 'var(--accent-soft)'
								: 'var(--color-bg-3)'}; border-color: {newCategories.has(cat)
								? 'var(--color-accent)'
								: 'var(--border)'}; color: var(--color-text-1);"
						>
							<input
								type="checkbox"
								name="categories"
								value={cat}
								checked={newCategories.has(cat)}
								onchange={() => (newCategories = toggleCategory(newCategories, cat))}
								class="h-4 w-4"
							/>
							{cat}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<Input
			label="PIN label (optional)"
			name="pin_label"
			bind:value={newPinLabel}
			hint="e.g. 'Sticky note #3'"
		/>

		<p class="text-xs" style="color: var(--color-text-2);">
			A 10-character temporary password is generated automatically. Print the login slip after
			creation.
		</p>

		<div class="flex justify-end gap-2 pt-2">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit">Create</Button>
		</div>
	</form>
</Modal>

{#if confirmConfig}
	<ConfirmModal
		bind:open={confirmOpen}
		title={confirmConfig.title}
		message={confirmConfig.message}
		danger={confirmConfig.danger}
		confirmLabel={confirmConfig.danger ? 'Yes, proceed' : 'Confirm'}
		onconfirm={submitConfirm}
		oncancel={() => {
			confirmOpen = false;
			confirmConfig = null;
		}}
	/>
{/if}
