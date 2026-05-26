<!--
	/admin/event — single-card page for event_state.
	Editable: event name, sprint minutes (and event_date if not yet set).
	Lock toggle freezes all scoresheets via RLS at the DB level.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Input from '$lib/components/Input.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { Lock, Unlock } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Seed locally-editable form fields from the initial server payload.
	// `untrack` keeps the $state() call non-reactive (silences
	// `state_referenced_locally`); the $effect below handles resync on
	// navigation / form submit reloads.
	let eventName = $state(untrack(() => data.event.eventName));
	let sprintMinutes = $state(untrack(() => data.event.sprintMinutes));
	let eventDate = $state(untrack(() => data.event.eventDate ?? ''));

	$effect(() => {
		eventName = data.event.eventName;
		sprintMinutes = data.event.sprintMinutes;
		eventDate = data.event.eventDate ?? '';
	});

	let lockConfirmOpen = $state(false);
	let unlockConfirmOpen = $state(false);

	function fmtLockedAt(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleString();
	}

	const phase = $derived(data.event.phase);
	const phaseLabel = $derived(
		phase === 'setup'
			? 'Setup'
			: phase === 'section_a'
				? 'Section A — pre-event scoring open'
				: phase === 'section_b'
					? 'Section B — event-day scoring open'
					: 'Finalised'
	);
</script>

<svelte:head>
	<title>Event · P3 Judging</title>
</svelte:head>

<PageHeader title="Event" subtitle="Master event configuration and global lock." />

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

<!-- Phase control — the main super-admin lever. Section A is scored before
     the event, Section B on event day, then finalised. Judges only see the
     criteria for the currently-open phase. -->
<div class="mb-4">
	<Card label="Current phase: {phaseLabel}">
		<p class="mb-3 text-sm" style="color: var(--color-text-2);">
			Judges can only enter scores for the criteria belonging to the current section.
			Section A scores remain visible (read-only) during Section B.
		</p>

		<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
			<form method="POST" action="?/setPhase" use:enhance>
				<input type="hidden" name="phase" value="section_a" />
				<Button variant={phase === 'section_a' ? 'primary' : 'secondary'} type="submit">
					Open Section A
				</Button>
			</form>
			<form method="POST" action="?/setPhase" use:enhance>
				<input type="hidden" name="phase" value="section_b" />
				<Button variant={phase === 'section_b' ? 'primary' : 'secondary'} type="submit">
					Open Section B
				</Button>
			</form>
			<form method="POST" action="?/setPhase" use:enhance>
				<input type="hidden" name="phase" value="finalised" />
				<Button variant={phase === 'finalised' ? 'primary' : 'secondary'} type="submit">
					Finalise scoring
				</Button>
			</form>
			<form method="POST" action="?/setPhase" use:enhance>
				<input type="hidden" name="phase" value="setup" />
				<Button variant="ghost" type="submit">Back to setup</Button>
			</form>
		</div>

		<p class="mt-3 text-xs" style="color: var(--color-text-3);">
			Phase changes are audit-logged. Use <strong>Back to setup</strong> only if you need to
			re-open scoring for everyone before the event.
		</p>
	</Card>
</div>

<div class="grid gap-4 lg:grid-cols-2">
	<Card label="Event details">
		<form method="POST" action="?/updateMeta" use:enhance class="space-y-4">
			<Input label="Event name" name="event_name" required bind:value={eventName} />
			<Input
				label="Sprint minutes"
				name="sprint_minutes"
				type="number"
				min="1"
				max="240"
				bind:value={sprintMinutes}
				hint="Live Sprint duration in minutes (default 45)."
			/>
			<Input
				label="Event date"
				name="event_date"
				type="date"
				bind:value={eventDate}
				disabled={!!data.event.eventDate}
				hint={data.event.eventDate
					? 'Date is set and locked. Contact the developer to change it.'
					: 'Pick the event day. Cannot be changed after saving.'}
			/>
			<div class="flex justify-end">
				<Button variant="primary" type="submit">Save</Button>
			</div>
		</form>
	</Card>

	<Card
		label={data.event.locked ? 'Event is LOCKED' : 'Event is unlocked'}
	>
		{#if data.event.locked}
			<div
				class="mb-3 rounded-(--radius) border p-3 text-sm"
				style="background: rgba(239, 68, 68, 0.08); border-color: var(--color-danger); color: var(--color-text-1);"
			>
				<p class="font-semibold" style="color: var(--color-danger);">
					Scoresheets are read-only across the app.
				</p>
				{#if data.event.lockedAt}
					<p class="mt-1 text-xs" style="color: var(--color-text-2);">
						Locked at <span style="font-family: var(--font-mono);"
							>{fmtLockedAt(data.event.lockedAt)}</span
						>
						{#if data.event.lockedByName}
							by {data.event.lockedByName}
						{/if}
					</p>
				{/if}
			</div>
			<p class="mb-3 text-sm" style="color: var(--color-text-2);">
				Unlocking lets judges and admins edit scoresheets again. Use only if you need to correct
				something after the event.
			</p>
			<div class="flex justify-end">
				<Button variant="secondary" onclick={() => (unlockConfirmOpen = true)}>
					{#snippet icon()}<Unlock size={16} strokeWidth={1.5} />{/snippet}
					Unlock event
				</Button>
			</div>
		{:else}
			<p class="mb-3 text-sm" style="color: var(--color-text-2);">
				Locking freezes all scoresheets across the app. Judges cannot edit drafts; super-admin
				cannot override. Lock at the end of the event to finalise results.
			</p>
			<div class="flex justify-end">
				<Button variant="danger" onclick={() => (lockConfirmOpen = true)}>
					{#snippet icon()}<Lock size={16} strokeWidth={1.5} />{/snippet}
					Lock event
				</Button>
			</div>
		{/if}
	</Card>
</div>

<form method="POST" action="?/lock" id="lock-form" use:enhance class="hidden"></form>
<form method="POST" action="?/unlock" id="unlock-form" use:enhance class="hidden"></form>

<ConfirmModal
	bind:open={lockConfirmOpen}
	title="Lock the event?"
	message="All judges' forms become read-only. Use at end of event."
	danger
	confirmLabel="Yes, lock"
	onconfirm={() => {
		(document.getElementById('lock-form') as HTMLFormElement)?.requestSubmit();
	}}
	oncancel={() => (lockConfirmOpen = false)}
/>

<ConfirmModal
	bind:open={unlockConfirmOpen}
	title="Unlock the event?"
	message="Scoresheets become editable again. Only do this if you need to correct something."
	confirmLabel="Yes, unlock"
	onconfirm={() => {
		(document.getElementById('unlock-form') as HTMLFormElement)?.requestSubmit();
	}}
	oncancel={() => (unlockConfirmOpen = false)}
/>
