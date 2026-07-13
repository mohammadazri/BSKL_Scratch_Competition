<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import { EVENT_CATEGORIES } from '$lib/event-status';
	import {
		AlertTriangle,
		CheckCircle2,
		ClipboardCheck,
		KeyRound,
		School,
		UserSquare2
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function percent(value: number, total: number): number {
		return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
	}

	const attention = $derived.by(() => {
		let missingCredentials = 0;
		let missingCurrentAssignments = 0;
		for (const category of EVENT_CATEGORIES) {
			const metrics = data.categories[category];
			missingCredentials += Math.max(0, metrics.registered - metrics.credentialsReady);
			const phase = data.event?.phases[category] ?? 'setup';
			if (phase === 'section_a') {
				missingCurrentAssignments += Math.max(0, metrics.qualified - metrics.assignedA);
			} else if (phase === 'section_b') {
				missingCurrentAssignments += Math.max(0, metrics.qualified - metrics.assignedB);
			}
		}
		return { missingCredentials, missingCurrentAssignments };
	});

	onMount(() => {
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') invalidateAll();
		}, 30_000);
		return () => window.clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Registration · P3 Judging</title>
</svelte:head>

<PageHeader
	title="Welcome, {data.profile.fullName.split(' ')[0]}"
	subtitle="Registration readiness and live judging progress. Refreshes automatically every 30 seconds."
/>

<div class="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
	{#each [{ label: 'Schools', value: data.schoolCount, icon: School, color: 'var(--color-accent-2)' }, { label: 'Registered', value: data.totals.registered, icon: UserSquare2, color: 'var(--color-accent)' }, { label: 'Qualified', value: data.totals.qualified, icon: CheckCircle2, color: 'var(--color-success)' }, { label: 'Scratch ready', value: `${data.totals.credentialsReady}/${data.totals.registered}`, icon: KeyRound, color: 'var(--color-warning)' }] as item (item.label)}
		{@const Icon = item.icon}
		<div
			class="rounded-xl border p-4"
			style="background: var(--color-bg-2); border-color: var(--border);"
		>
			<div class="flex items-center justify-between gap-3">
				<div>
					<p
						class="text-[10px] font-semibold tracking-wider uppercase"
						style="color: var(--color-text-3);"
					>
						{item.label}
					</p>
					<p
						class="mt-1 text-2xl font-bold"
						style="color: var(--color-text-1); font-family: var(--font-mono);"
					>
						{item.value}
					</p>
				</div>
				<span
					class="grid h-10 w-10 place-items-center rounded-lg"
					style="background: {item.color}18; color: {item.color};"
				>
					<Icon size={20} strokeWidth={1.7} />
				</span>
			</div>
		</div>
	{/each}
</div>

{#if attention.missingCredentials > 0 || attention.missingCurrentAssignments > 0}
	<div
		class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
		style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.5);"
	>
		<div class="flex items-start gap-3">
			<AlertTriangle
				class="mt-0.5 shrink-0"
				size={19}
				strokeWidth={1.8}
				color="var(--color-warning)"
			/>
			<div>
				<p class="text-sm font-semibold" style="color: var(--color-warning);">Attention needed</p>
				<p class="mt-0.5 text-xs" style="color: var(--color-text-2);">
					{attention.missingCredentials} participant{attention.missingCredentials === 1 ? '' : 's'} missing
					Scratch access
					{#if attention.missingCurrentAssignments > 0}
						· {attention.missingCurrentAssignments} missing an assignment for the open section
					{/if}
				</p>
			</div>
		</div>
		<Button variant="secondary" href="/registration/participants"
			>Resolve participant details</Button
		>
	</div>
{/if}

<div class="mb-5 grid gap-4 xl:grid-cols-3">
	{#each EVENT_CATEGORIES as category (category)}
		{@const metrics = data.categories[category]}
		{@const phase = data.event?.phases[category] ?? 'setup'}
		<Card label="Category {category} · {phase.replace('_', ' ')}">
			<div class="space-y-4">
				<div>
					<div class="mb-1 flex justify-between text-xs" style="color: var(--color-text-2);">
						<span>Scratch access</span>
						<span style="font-family: var(--font-mono);"
							>{metrics.credentialsReady}/{metrics.registered}</span
						>
					</div>
					<div class="h-2 overflow-hidden rounded-full" style="background: var(--color-bg-3);">
						<div
							class="h-full rounded-full"
							style="width: {percent(
								metrics.credentialsReady,
								metrics.registered
							)}%; background: var(--color-warning);"
						></div>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div
						class="rounded-lg border p-3"
						style="border-color: var(--border); background: var(--color-bg-1);"
					>
						<p class="text-[10px] font-semibold uppercase" style="color: var(--color-text-3);">
							Section A
						</p>
						<p
							class="mt-1 text-lg font-semibold"
							style="font-family: var(--font-mono); color: var(--color-text-1);"
						>
							{metrics.submittedA}/{metrics.qualified}
						</p>
						<p class="text-[10px]" style="color: var(--color-text-3);">
							submitted · {metrics.assignedA} assigned
						</p>
					</div>
					<div
						class="rounded-lg border p-3"
						style="border-color: var(--border); background: var(--color-bg-1);"
					>
						<p class="text-[10px] font-semibold uppercase" style="color: var(--color-text-3);">
							Section B
						</p>
						<p
							class="mt-1 text-lg font-semibold"
							style="font-family: var(--font-mono); color: var(--color-text-1);"
						>
							{metrics.submittedB}/{metrics.qualified}
						</p>
						<p class="text-[10px]" style="color: var(--color-text-3);">
							submitted · {metrics.assignedB} assigned
						</p>
					</div>
				</div>
			</div>
		</Card>
	{/each}
</div>

<Card label="Registration desk shortcuts">
	<div class="flex flex-wrap gap-3">
		<Button variant="secondary" href="/registration/schools">
			{#snippet icon()}<School size={16} strokeWidth={1.5} />{/snippet}
			Manage schools
		</Button>
		<Button variant="primary" href="/registration/participants">
			{#snippet icon()}<UserSquare2 size={16} strokeWidth={1.5} />{/snippet}
			Manage participants
		</Button>
		<span
			class="ml-auto inline-flex items-center gap-1.5 text-[10px]"
			style="color: var(--color-text-3);"
		>
			<ClipboardCheck size={13} strokeWidth={1.6} />
			Last refreshed {new Date(data.refreshedAt).toLocaleTimeString()}
		</span>
	</div>
</Card>
