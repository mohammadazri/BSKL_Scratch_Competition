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

	const phases = $derived({
		A: data.event.phaseA,
		B: data.event.phaseB,
		C: data.event.phaseC
	});
	
	function phaseLabel(phase: 'setup' | 'section_a' | 'section_b' | 'finalised') {
		return phase === 'setup'
			? 'Setup'
			: phase === 'section_a'
				? 'Section A — pre-event scoring'
				: phase === 'section_b'
					? 'Section B — event-day scoring'
					: 'Finalised';
	}
	
	const sprintStarts = $derived({
		A: data.event.sprintStartA,
		B: data.event.sprintStartB,
		C: data.event.sprintStartC
	});
	
	// Create local states for the datetime pickers so they don't jump while typing
	let localTimerA = $state(untrack(() => data.event.sprintStartA ? new Date(data.event.sprintStartA).toISOString().slice(0, 16) : ''));
	let localTimerB = $state(untrack(() => data.event.sprintStartB ? new Date(data.event.sprintStartB).toISOString().slice(0, 16) : ''));
	let localTimerC = $state(untrack(() => data.event.sprintStartC ? new Date(data.event.sprintStartC).toISOString().slice(0, 16) : ''));

	$effect(() => {
		localTimerA = data.event.sprintStartA ? new Date(data.event.sprintStartA).toISOString().slice(0, 16) : '';
		localTimerB = data.event.sprintStartB ? new Date(data.event.sprintStartB).toISOString().slice(0, 16) : '';
		localTimerC = data.event.sprintStartC ? new Date(data.event.sprintStartC).toISOString().slice(0, 16) : '';
	});
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

<!-- Phase controls — per category. -->
<div class="mb-4 flex flex-col gap-4">
	{#each ['A', 'B', 'C'] as category}
		{@const catPhase = phases[category]}
		{@const catTimer = category === 'A' ? localTimerA : category === 'B' ? localTimerB : localTimerC}
		
		<Card label="Category {category} Phase: {phaseLabel(catPhase)}">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<form method="POST" action="?/setPhase" use:enhance>
						<input type="hidden" name="category" value={category} />
						<input type="hidden" name="phase" value="section_a" />
						<Button variant={catPhase === 'section_a' ? 'primary' : 'secondary'} type="submit">
							Open Section A
						</Button>
					</form>
					<form method="POST" action="?/setPhase" use:enhance>
						<input type="hidden" name="category" value={category} />
						<input type="hidden" name="phase" value="section_b" />
						<Button variant={catPhase === 'section_b' ? 'primary' : 'secondary'} type="submit">
							Open Section B
						</Button>
					</form>
					<form method="POST" action="?/setPhase" use:enhance>
						<input type="hidden" name="category" value={category} />
						<input type="hidden" name="phase" value="finalised" />
						<Button variant={catPhase === 'finalised' ? 'primary' : 'secondary'} type="submit">
							Finalise
						</Button>
					</form>
					<form method="POST" action="?/setPhase" use:enhance>
						<input type="hidden" name="category" value={category} />
						<input type="hidden" name="phase" value="setup" />
						<Button variant="ghost" type="submit">Back to setup</Button>
					</form>
				</div>
				
				<div class="flex flex-col items-end gap-2 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0" style="border-color: var(--border);">
					<label class="text-xs font-semibold" style="color: var(--color-text-2);">Section B Start Timer</label>
					<form method="POST" action="?/setTimer" use:enhance class="flex items-center gap-2">
						<input type="hidden" name="category" value={category} />
						<input 
							type="datetime-local" 
							name="datetime" 
							class="rounded border px-2 py-1 text-sm" 
							style="background: var(--color-bg-1); border-color: var(--border); color: var(--color-text-1);"
							value={catTimer}
						/>
						<Button variant="secondary" type="submit">Set</Button>
					</form>
					<span class="text-[10px] text-zinc-500 max-w-[200px] text-right">Displays a countdown to judges if Section B has not started.</span>
				</div>
			</div>
		</Card>
	{/each}
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
