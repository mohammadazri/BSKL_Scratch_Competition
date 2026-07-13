<!--
	/admin/users — list, create, edit role + categories, deactivate, reset.
	DataTable with action buttons; Modal for create/edit; ConfirmModal for
	destructive actions.
-->
<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import DataTable, { type Column } from '$lib/components/DataTable.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import RolePill from '$lib/components/RolePill.svelte';
	import CategoryChip from '$lib/components/CategoryChip.svelte';
	import { toasts } from '$lib/stores/toast';
	import { Plus, Pencil, Power, KeyRound, Printer, Trash2 } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';
	import type { UserRow } from './+page.server';
	import type { Category, Role } from '$lib/types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let createOpen = $state(false);
	let editOpen = $state(false);
	let confirmOpen = $state(false);
	let confirmConfig = $state<{
		title: string;
		message: string;
		action: string;
		fields: Record<string, string>;
		danger: boolean;
	} | null>(null);

	let editing = $state<UserRow | null>(null);
	let editFullName = $state('');
	let editRole = $state<Role>('judge');
	let editCategories = $state<Set<Category>>(new Set());
	let editPinLabel = $state('');

	let newEmail = $state('');
	let newFullName = $state('');
	let newRole = $state<Role>('judge');
	let newCategories = $state<Set<Category>>(new Set(['A', 'B', 'C']));
	let newPinLabel = $state('');

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
			action: '?/setActive',
			fields: { id: row.id, active: 'false' },
			danger: true
		};
		confirmOpen = true;
	}

	function confirmReactivate(row: UserRow) {
		confirmConfig = {
			title: 'Reactivate user?',
			message: `Re-enable sign-in for ${row.fullName}.`,
			action: '?/setActive',
			fields: { id: row.id, active: 'true' },
			danger: false
		};
		confirmOpen = true;
	}

	function confirmReset(row: UserRow) {
		confirmConfig = {
			title: 'Reset password?',
			message: `Generate a new temporary password for ${row.fullName}. Their current password stops working immediately. Print new login slips after.`,
			action: '?/resetPassword',
			fields: { id: row.id },
			danger: true
		};
		confirmOpen = true;
	}

	function confirmDelete(row: UserRow) {
		confirmConfig = {
			title: 'Delete user permanently?',
			message: `${row.fullName} (${row.email}) will be permanently removed. This cannot be undone. If they have any assignments or scoresheets on record, the delete will be blocked — deactivate instead to preserve scoring history.`,
			action: '?/deleteUser',
			fields: { id: row.id },
			danger: true
		};
		confirmOpen = true;
	}

	// New-credentials modal — opened after create or reset password so the
	// admin sees the temp password ONCE (it's never stored anywhere it can
	// be retrieved later — they need to copy it now or print the slip).
	let credsModal = $state<{
		email: string;
		password: string;
		fullName: string;
		mode: 'created' | 'reset';
	} | null>(null);
	let copyState = $state<'idle' | 'copied'>('idle');

	async function copyPassword() {
		if (!credsModal) return;
		try {
			await navigator.clipboard.writeText(credsModal.password);
			copyState = 'copied';
			setTimeout(() => (copyState = 'idle'), 1500);
		} catch {
			toasts.error('Could not copy. Long-press the password to select it manually.');
		}
	}

	async function submitConfirm() {
		if (!confirmConfig) return;
		const fd = new FormData();
		for (const [k, v] of Object.entries(confirmConfig.fields)) fd.set(k, v);
		const action = confirmConfig.action;
		const targetUserId = confirmConfig.fields.id;
		const res = await fetch(action, {
			method: 'POST',
			body: fd,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await res.text());
		await invalidateAll();
		confirmOpen = false;
		confirmConfig = null;
		if (result.type === 'failure') {
			const failureData = result.data as { error?: string } | undefined;
			toasts.error(failureData?.error ?? 'Action failed.');
			return;
		}
		if (result.type === 'error') {
			toasts.error(result.error?.message ?? 'Server error.');
			return;
		}
		if (result.type !== 'success') {
			toasts.error('Unexpected redirect while completing the action.');
			return;
		}

		// Success. If this was a password reset, surface the new temp password
		// in a modal so the admin can copy / print it. Otherwise just toast.
		if (action === '?/resetPassword') {
			const successData = result.data as
				| { created?: { password?: string }; message?: string }
				| undefined;
			const newPassword = successData?.created?.password;
			if (newPassword) {
				const row = data.rows.find((r) => r.id === targetUserId);
				credsModal = {
					email: row?.email ?? '',
					fullName: row?.fullName ?? 'this user',
					password: newPassword,
					mode: 'reset'
				};
				return;
			}
		}
		toasts.success('Done.');
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

	const columns: Column<UserRow>[] = [
		{ key: 'user', label: 'User', get: (r) => r.fullName },
		{ key: 'role', label: 'Role' },
		{ key: 'categories', label: 'Categories' },
		{ key: 'status', label: 'Status' },
		{
			key: 'lastSignIn',
			label: 'Last seen',
			mono: true,
			get: (r) => r.lastSignInAt ?? ''
		}
	];
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
		class="mb-4 rounded-[var(--radius)] border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-success); color: var(--color-text-1);"
	>
		<p class="font-medium" style="color: var(--color-success);">{form.message}</p>
		{#if form?.created?.password}
			<p class="mt-1 text-xs" style="color: var(--color-text-2);">
				Temp password: <span style="font-family: var(--font-mono);">{form.created.password}</span>
				— print the
				<a href="/admin/users/print" class="underline" style="color: var(--color-accent-2);"
					>login slips</a
				> now (it won't be shown again).
			</p>
		{/if}
	</div>
{:else if form?.error}
	<div
		class="mb-4 rounded-[var(--radius)] border p-3 text-sm"
		style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
	>
		{form.error}
	</div>
{/if}

<!--
	Users table — rendered inline (not via the generic <DataTable>) so we can
	render avatars, role pills, and category chips per row exactly as DESIGN.md
	mocks them. The generic <DataTable> remains for simpler lists elsewhere.
-->
<div
	class="overflow-x-auto rounded-[var(--radius)] border"
	style="border-color: var(--border); background: var(--color-bg-1);"
>
	<table class="w-full border-collapse text-sm">
		<thead class="sticky top-0 z-10">
			<tr style="background: var(--color-bg-3);">
				{#each ['User', 'Role', 'Categories', 'Status', 'Last seen', ''] as h, i (i)}
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
								<p
									class="truncate text-xs"
									style="color: var(--color-text-2); font-family: var(--font-mono);"
								>
									{row.email}
								</p>
							</div>
						</div>
					</td>
					<td class="px-3 py-2.5"><RolePill role={row.role} /></td>
					<td class="px-3 py-2.5">
						{#if row.role === 'judge'}
							<div class="flex gap-1">
								{#each row.categories as c (c)}
									<CategoryChip category={c} />
								{/each}
							</div>
						{:else}
							<span class="text-xs" style="color: var(--color-text-3);">—</span>
						{/if}
					</td>
					<td class="px-3 py-2.5">
						{#if row.isActive}
							<span
								class="inline-flex items-center gap-1.5 text-xs"
								style="color: var(--color-success);"
							>
								<span
									class="inline-block h-2 w-2 rounded-full"
									style="background: var(--color-success);"
								></span>
								Active
							</span>
						{:else}
							<span
								class="inline-flex items-center gap-1.5 text-xs"
								style="color: var(--color-text-3);"
							>
								<span
									class="inline-block h-2 w-2 rounded-full"
									style="background: var(--color-text-3);"
								></span>
								Disabled
							</span>
						{/if}
					</td>
					<td
						class="px-3 py-2.5 text-xs"
						style="color: var(--color-text-2); font-family: var(--font-mono);"
					>
						{fmtLastSeen(row.lastSignInAt)}
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
								class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
								style="color: var(--color-text-2);"
								onclick={() => confirmReset(row)}
								aria-label="Reset password"
								title="Reset password"
							>
								<KeyRound size={16} strokeWidth={1.5} />
							</button>
							<button
								type="button"
								class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
								style="color: {row.isActive ? 'var(--color-danger)' : 'var(--color-success)'};"
								onclick={() => (row.isActive ? confirmDeactivate(row) : confirmReactivate(row))}
								aria-label={row.isActive ? 'Deactivate' : 'Reactivate'}
								title={row.isActive ? 'Deactivate' : 'Reactivate'}
							>
								<Power size={16} strokeWidth={1.5} />
							</button>
							<button
								type="button"
								class="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
								style="color: var(--color-danger);"
								onclick={() => confirmDelete(row)}
								aria-label="Delete permanently"
								title="Delete permanently"
							>
								<Trash2 size={16} strokeWidth={1.5} />
							</button>
						</div>
					</td>
				</tr>
			{/each}
			{#if data.rows.length === 0}
				<tr>
					<td colspan="6" class="px-6 py-10 text-center">
						<p class="text-sm" style="color: var(--color-text-2);">
							No users yet. Click <strong>New user</strong> to add your first judge.
						</p>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

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
				<option value="registration_committee">Registration committee</option>
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
						{#each ['A', 'B', 'C'] as Category[] as cat (cat)}
							<label
								class="flex h-11 min-w-12 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-3 text-sm"
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
			const submittedEmail = newEmail;
			const submittedName = newFullName;
			return async ({ result, update }) => {
				await update();
				createOpen = false;
				newEmail = '';
				newFullName = '';
				newRole = 'judge';
				newCategories = new Set(['A', 'B', 'C']);
				newPinLabel = '';
				// If the server returned a temp password (success path), surface
				// it in the credentials modal so the admin can copy / print it.
				if (result.type === 'success') {
					const successData = result.data as { created?: { password?: string } } | undefined;
					const pw = successData?.created?.password;
					if (pw) {
						credsModal = {
							email: submittedEmail,
							fullName: submittedName,
							password: pw,
							mode: 'created'
						};
					}
				}
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
			<option value="registration_committee">Registration committee</option>
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
					{#each ['A', 'B', 'C'] as Category[] as cat (cat)}
						<label
							class="flex h-11 min-w-12 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-3 text-sm"
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

<!-- Credentials modal: shown ONCE after create-user or reset-password.
     The temp password is never stored in retrievable form, so the admin
     must copy / print it now. The target user has must_change_password=true
     set server-side so they'll be redirected to /auth/change-password on
     their next sign-in. -->
{#if credsModal}
	<Modal
		open={!!credsModal}
		title={credsModal.mode === 'created' ? 'User created' : 'Password reset'}
		size="md"
		onClose={() => {
			credsModal = null;
			copyState = 'idle';
		}}
	>
		<div class="flex flex-col gap-4">
			<p class="text-sm" style="color: var(--color-text-2);">
				{#if credsModal.mode === 'created'}
					Hand <strong style="color: var(--color-text-1);">{credsModal.fullName}</strong> the credentials
					below. They'll be required to choose a new password on first sign-in.
				{:else}
					New temporary password for
					<strong style="color: var(--color-text-1);">{credsModal.fullName}</strong>. Their old
					password no longer works. They'll be required to choose a new password on next sign-in.
				{/if}
			</p>

			<div
				class="flex flex-col gap-2 rounded-md border p-3"
				style="background: var(--color-bg-3); border-color: var(--border-strong);"
			>
				<div class="flex items-center justify-between gap-2">
					<span class="text-[11px] tracking-wider uppercase" style="color: var(--color-text-2);">
						Email
					</span>
					<span
						class="truncate text-sm"
						style="font-family: var(--font-mono); color: var(--color-text-1);"
					>
						{credsModal.email}
					</span>
				</div>
				<div
					class="flex items-center justify-between gap-2 border-t pt-2"
					style="border-color: var(--border);"
				>
					<span class="text-[11px] tracking-wider uppercase" style="color: var(--color-text-2);">
						Temp password
					</span>
					<span
						class="select-all text-lg font-semibold"
						style="font-family: var(--font-mono); color: var(--color-text-1); letter-spacing: 0.04em;"
					>
						{credsModal.password}
					</span>
				</div>
			</div>

			<div
				class="rounded-md border-l-2 p-2 text-xs"
				style="border-color: var(--color-warning); background: rgba(217, 119, 6, 0.08); color: var(--color-text-1);"
			>
				This password is only shown <strong>once</strong>. Copy it now or print the login slip — you
				can't get it back later.
			</div>

			<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
				<Button variant="ghost" href="/admin/users/print">
					{#snippet icon()}<Printer size={16} strokeWidth={1.5} />{/snippet}
					Print login slips
				</Button>
				<Button variant="secondary" onclick={copyPassword}>
					{copyState === 'copied' ? 'Copied ✓' : 'Copy password'}
				</Button>
				<Button
					variant="primary"
					onclick={() => {
						credsModal = null;
						copyState = 'idle';
					}}
				>
					Done
				</Button>
			</div>
		</div>
	</Modal>
{/if}
