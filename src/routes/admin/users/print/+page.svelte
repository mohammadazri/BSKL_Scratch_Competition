<!--
	/admin/users/print — printable A4 login slips (TRACK_2_ADMIN.md gotchas).
	Mohammad selects which active users to issue slips for, server regenerates
	a temp password per user (audit-logged), then the printable sheet is shown
	and `window.print()` is triggered.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import PrintableSlips, { type Slip } from '$lib/components/PrintableSlips.svelte';
	import RolePill from '$lib/components/RolePill.svelte';
	import { enhance } from '$app/forms';
	import { Printer, RefreshCw, CheckSquare, Square } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Default to "all users selected" but allow the operator to toggle locally;
	// `untrack` silences `state_referenced_locally` on the initial seed.
	let selected = $state<Set<string>>(new Set(untrack(() => data.users.map((u) => u.id))));

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleAll() {
		selected =
			selected.size === data.users.length ? new Set() : new Set(data.users.map((u) => u.id));
	}

	const slipsForPrint = $derived<Slip[]>(
		(form?.slips ?? []).map((s) => ({
			fullName: s.fullName,
			email: s.email,
			role: s.role,
			password: s.password,
			pinLabel: s.pinLabel,
			categories: s.categories,
			qrSvg: s.qrSvg
		}))
	);

	$effect(() => {
		if (form?.ok && form.slips && form.slips.length > 0) {
			// Auto-trigger print once slips are ready.
			queueMicrotask(() => window.print());
		}
	});
</script>

<svelte:head>
	<title>Print login slips · P3 Judging</title>
</svelte:head>

<div class="print-hide">
	<PageHeader
		title="Print login slips"
		subtitle="Generate temporary passwords for active judges, viewers, and registration committee, then print one slip per user."
	>
		{#snippet actions()}
			<Button variant="ghost" href="/admin/users">Back to users</Button>
		{/snippet}
	</PageHeader>

	{#if form?.error}
		<div
			class="mb-4 rounded-[var(--radius)] border p-3 text-sm"
			style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
		>
			{form.error}
		</div>
	{/if}

	{#if !form?.slips}
		<Card label="Select users">
			<form method="POST" action="?/regenerate" use:enhance class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<Button variant="ghost" size="sm" onclick={toggleAll}>
						{#snippet icon()}{#if selected.size === data.users.length}<CheckSquare
									size={14}
									strokeWidth={1.5}
								/>{:else}<Square size={14} strokeWidth={1.5} />{/if}{/snippet}
						{selected.size === data.users.length ? 'Deselect all' : 'Select all'}
					</Button>
					<span class="text-xs" style="color: var(--color-text-2);">
						{selected.size} of {data.users.length} selected
					</span>
				</div>

				<ul class="flex flex-col">
					{#each data.users as u (u.id)}
						<li
							class="flex items-center gap-3 border-b py-2 last:border-0"
							style="border-color: var(--border);"
						>
							<label class="flex flex-1 items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									name="id"
									value={u.id}
									checked={selected.has(u.id)}
									onchange={() => toggle(u.id)}
									class="h-4 w-4"
								/>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium" style="color: var(--color-text-1);">
										{u.fullName}
									</p>
									<p
										class="text-xs"
										style="color: var(--color-text-2); font-family: var(--font-mono);"
									>
										{u.email}
									</p>
								</div>
								<RolePill role={u.role} />
							</label>
						</li>
					{/each}
					{#if data.users.length === 0}
						<li class="py-6 text-center text-sm" style="color: var(--color-text-2);">
							No active judges or viewers yet.
						</li>
					{/if}
				</ul>

				<p class="text-xs" style="color: var(--color-text-3);">
					Generating slips will reset each selected user's password. They will need the printed
					credentials to sign in.
				</p>

				<div class="flex justify-end">
					<Button variant="primary" type="submit" disabled={selected.size === 0}>
						{#snippet icon()}<RefreshCw size={16} strokeWidth={1.5} />{/snippet}
						Generate {selected.size} slip{selected.size === 1 ? '' : 's'}
					</Button>
				</div>
			</form>
		</Card>
	{:else}
		<Card label="Ready to print">
			<div class="flex items-center justify-between gap-3">
				<p class="text-sm" style="color: var(--color-text-1);">
					Generated {form.count} slip{form.count === 1 ? '' : 's'}. Print should open
					automatically — if not, click the button.
				</p>
				<Button variant="primary" onclick={() => window.print()}>
					{#snippet icon()}<Printer size={16} strokeWidth={1.5} />{/snippet}
					Print now
				</Button>
			</div>
			<p class="mt-2 text-xs" style="color: var(--color-text-2);">
				After printing, keep the slips secure. Anyone with one can sign into the app as that user.
			</p>
		</Card>
	{/if}
</div>

{#if form?.slips && form.slips.length > 0}
	<PrintableSlips
		event={data.event.eventName ?? 'P3 Future Coders Challenge 2026'}
		eventDate={data.event.eventDate}
		url={data.appUrl}
		slips={slipsForPrint}
	/>
{/if}

<style>
	@media print {
		:global(.print-hide) {
			display: none !important;
		}
	}
</style>
