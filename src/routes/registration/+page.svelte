<!--
	/registration dashboard — minimal landing page so registration_committee
	logins have somewhere to go and the redirect chain terminates.
	Full Schools + Participants pages land in Phase 2.
-->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import { School, UserSquare2 } from '@lucide/svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Registration · P3 Judging</title>
</svelte:head>

<PageHeader
	title="Welcome, {data.profile.fullName.split(' ')[0]}"
	subtitle="Manage schools and participants for the P3 Future Coders Challenge 2026."
/>

<div class="grid gap-4 md:grid-cols-2">
	<Card label="Schools">
		<p class="text-sm" style="color: var(--color-text-2);">
			Add, edit, or remove the schools competing in the event.
		</p>
		<div class="mt-4">
			<Button variant="primary" href="/registration/schools">
				{#snippet icon()}<School size={16} strokeWidth={1.5} />{/snippet}
				Open schools
			</Button>
		</div>
	</Card>

	<Card label="Participants">
		<p class="text-sm" style="color: var(--color-text-2);">
			Register students per school and category. CSV import supported.
		</p>
		<div class="mt-4">
			<Button variant="primary" href="/registration/participants">
				{#snippet icon()}<UserSquare2 size={16} strokeWidth={1.5} />{/snippet}
				Open participants
			</Button>
		</div>
	</Card>
</div>

<p class="mt-8 text-xs" style="color: var(--color-text-3);">
	Need to log a judge or run scoring? Ask Mohammad to give you super_admin access for the event day.
</p>
