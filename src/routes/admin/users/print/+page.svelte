<!--
	/admin/users/print — generate + print login slips for venue handout.
	Two screens in one route:
	  1. Select active users (checkbox list)
	  2. After form action, show printable A4 layout + browser print button
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import RolePill from '$lib/components/RolePill.svelte';
	import PrintableSlips from '$lib/components/PrintableSlips.svelte';
	import { Printer, ArrowLeft } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selected = $state<Set<string>>(new Set(data.users.map((u) => u.id)));

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleAll(checked: boolean) {
		selected = checked ? new Set(data.users.map((u) => u.id)) : new Set();
	}

	function doPrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Print login slips · P3 Judging</title>
</svelte:head>

{#if form?.ok && form?.slips?.length}
	<!-- After generation: show slips + print toolbar -->
	<div class="no-print">
		<PageHeader
			title="Login slips ready"
			subtitle="Click print. Each user's password is shown ONCE — don't refresh."
		>
			{#snippet actions()}
				<Button variant="ghost" href="/admin/users/print">
					{#snippet icon()}<ArrowLeft size={16} strokeWidth={1.5} />{/snippet}
					Back
				</Button>
				<Button variant="primary" onclick={doPrint}>
					{#snippet icon()}<Printer size={16} strokeWidth={1.5} />{/snippet}
					Print
				</Button>
			{/snippet}
		</PageHeader>

		{#if form?.error}
			<div
				class="mb-4 rounded-(--radius) border p-3 text-sm"
				style="background: var(--color-bg-2); border-color: var(--color-warning); color: var(--color-warning);"
			>
				{form.error}
			</div>
		{/if}
	</div>

	<PrintableSlips
		slips={form.slips}
		event={data.eventName}
		eventDate={data.eventDate}
		url={form.loginUrl}
	/>
{:else}
	<!-- Selection screen -->
	<div class="no-print">
		<PageHeader
			title="Print login slips"
			subtitle="Reset selected users' passwords and print a slip sheet for venue handout."
		>
			{#snippet actions()}
				<Button variant="ghost" href="/admin/users">
					{#snippet icon()}<ArrowLeft size={16} strokeWidth={1.5} />{/snippet}
					Back
				</Button>
			{/snippet}
		</PageHeader>

		{#if form?.error}
			<div
				class="mb-4 rounded-(--radius) border p-3 text-sm"
				style="background: var(--color-bg-2); border-color: var(--color-danger); color: var(--color-danger);"
			>
				{form.error}
			</div>
		{/if}

		<form method="POST" action="?/generate" use:enhance>
			<Card label="Select users to print">
				<div class="mb-3 flex items-center justify-between">
					<label class="flex items-center gap-2 text-sm" style="color: var(--color-text-2);">
						<input
							type="checkbox"
							checked={selected.size === data.users.length && data.users.length > 0}
							onchange={(e) => toggleAll((e.currentTarget as HTMLInputElement).checked)}
						/>
						Select all
					</label>
					<span class="text-xs" style="color: var(--color-text-3);">
						{selected.size} of {data.users.length} selected
					</span>
				</div>

				<div class="divide-y" style="--tw-divide-opacity: 1;">
					{#each data.users as u (u.id)}
						<label
							class="flex cursor-pointer items-center gap-3 py-2.5"
							style="border-color: var(--border);"
						>
							<input
								type="checkbox"
								name="ids"
								value={u.id}
								checked={selected.has(u.id)}
								onchange={() => toggle(u.id)}
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium" style="color: var(--color-text-1);">
									{u.fullName}
								</p>
								<p class="truncate text-xs" style="color: var(--color-text-2);">{u.email}</p>
							</div>
							<RolePill role={u.role} />
						</label>
					{/each}
					{#if data.users.length === 0}
						<p class="py-6 text-center text-sm" style="color: var(--color-text-2);">
							No active users to print. Create some first.
						</p>
					{/if}
				</div>

				<div class="mt-4 flex items-center justify-between">
					<p class="max-w-md text-xs" style="color: var(--color-text-3);">
						Generating slips resets each selected user's password. The previous password stops
						working immediately.
					</p>
					<Button variant="primary" type="submit" disabled={selected.size === 0}>
						{#snippet icon()}<Printer size={16} strokeWidth={1.5} />{/snippet}
						Generate slips
					</Button>
				</div>
			</Card>
		</form>
	</div>
{/if}

<style>
	@media print {
		:global(header[aria-label='Primary']),
		:global(nav[aria-label='Primary']),
		:global(.no-print) {
			display: none !important;
		}
	}
</style>
