<!--
	/admin/event — single-card page editing event_state.
	Event name + date + sprint minutes form, plus a separate Lock/Unlock action.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { Lock, Unlock, Save } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toast';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let eventName = $state(data.event.eventName);
	let eventDate = $state(data.event.eventDate ?? '');
	let sprintMinutes = $state(data.event.sprintMinutes);

	let confirmOpen = $state(false);
	let confirmIsLock = $state(true);

	function openLockConfirm() {
		confirmIsLock = !data.event.locked;
		confirmOpen = true;
	}

	async function submitLock() {
		const fd = new FormData();
		fd.set('lock', String(confirmIsLock));
		const res = await fetch('?/lock', { method: 'POST', body: fd });
		await invalidateAll();
		confirmOpen = false;
		if (res.ok) {
			toasts.success(
				confirmIsLock
					? 'Event locked — scoresheets are read-only.'
					: 'Event unlocked.'
			);
		} else {
			toasts.error('Failed to update lock.');
		}
	}

	function fmtTime(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleString();
	}
</script>

<svelte:head>
	<title>Event · P3 Judging</title>
</svelte:head>

<PageHeader title="Event" subtitle="Top-level event settings and the master lock." />

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

<div class="grid gap-6 lg:grid-cols-3">
	<div class="lg:col-span-2">
		<Card label="Event settings">
			<form
				method="POST"
				action="?/update"
				use:enhance
				class="space-y-4"
			>
				<Input label="Event name" name="event_name" required bind:value={eventName} />
				<Input
					label="Event date"
					name="event_date"
					type="date"
					bind:value={eventDate}
					hint={data.event.eventDate ? 'Set once. Edit only if needed.' : 'Not yet set.'}
				/>
				<Input
					label="Sprint minutes"
					name="sprint_minutes"
					type="number"
					min="1"
					max="240"
					required
					bind:value={sprintMinutes}
					hint="Default 45. Used by the judge scoring form's timer."
				/>
				<div class="flex justify-end gap-2 pt-2">
					<Button variant="primary" type="submit">
						{#snippet icon()}<Save size={16} strokeWidth={1.5} />{/snippet}
						Save changes
					</Button>
				</div>
			</form>
		</Card>
	</div>

	<div>
		<Card label="Master lock">
			{#if data.event.locked}
				<div class="flex items-center gap-3">
					<span
						class="grid h-10 w-10 place-items-center rounded-full"
						style="background: rgba(239, 68, 68, 0.1); color: var(--color-danger);"
					>
						<Lock size={18} strokeWidth={1.5} />
					</span>
					<div>
						<p class="text-sm font-semibold" style="color: var(--color-text-1);">Event locked</p>
						<p class="text-xs" style="color: var(--color-text-2);">
							All scoresheets are read-only.
						</p>
					</div>
				</div>
				<dl class="mt-4 space-y-1 text-xs" style="color: var(--color-text-2);">
					{#if data.event.lockedAt}
						<div class="flex justify-between gap-2">
							<dt>Locked at</dt>
							<dd style="font-family: var(--font-mono); color: var(--color-text-1);">
								{fmtTime(data.event.lockedAt)}
							</dd>
						</div>
					{/if}
					{#if data.event.lockedByName}
						<div class="flex justify-between gap-2">
							<dt>By</dt>
							<dd style="color: var(--color-text-1);">{data.event.lockedByName}</dd>
						</div>
					{/if}
				</dl>
				<Button variant="secondary" onclick={openLockConfirm} fullWidth>
					{#snippet icon()}<Unlock size={16} strokeWidth={1.5} />{/snippet}
					Unlock event
				</Button>
			{:else}
				<div class="flex items-center gap-3">
					<span
						class="grid h-10 w-10 place-items-center rounded-full"
						style="background: rgba(16, 185, 129, 0.1); color: var(--color-success);"
					>
						<Unlock size={18} strokeWidth={1.5} />
					</span>
					<div>
						<p class="text-sm font-semibold" style="color: var(--color-text-1);">Open</p>
						<p class="text-xs" style="color: var(--color-text-2);">
							Judges can still edit drafts and submit scoresheets.
						</p>
					</div>
				</div>
				<p class="my-4 text-xs" style="color: var(--color-text-2);">
					Locking freezes the entire event — no judge can edit or submit. Use this at the end
					of the day to finalise results before exporting.
				</p>
				<Button variant="danger" onclick={openLockConfirm} fullWidth>
					{#snippet icon()}<Lock size={16} strokeWidth={1.5} />{/snippet}
					Lock event
				</Button>
			{/if}
		</Card>
	</div>
</div>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmIsLock ? 'Lock event?' : 'Unlock event?'}
	message={confirmIsLock
		? 'Every judge will lose the ability to edit or submit. You can unlock later.'
		: 'Judges will be able to edit drafts again. Make sure rankings are final before unlocking.'}
	confirmLabel={confirmIsLock ? 'Yes, lock' : 'Yes, unlock'}
	danger={confirmIsLock}
	onconfirm={submitLock}
	oncancel={() => (confirmOpen = false)}
/>
