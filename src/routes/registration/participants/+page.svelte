<!-- Placeholder. Real participants UI lands in Phase 2. -->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
</script>

<svelte:head>
	<title>Participants · Registration</title>
</svelte:head>

<PageHeader title="Participants" subtitle="Coming soon — Phase 2 build">
	{#snippet actions()}
		<Button variant="ghost" href="/registration">Back to dashboard</Button>
	{/snippet}
</PageHeader>

<Card label="Not yet available">
	<p class="text-sm" style="color: var(--color-text-2);">
		The registration committee's Participants page hasn't been built yet. In
		the meantime ask Mohammad (super_admin) to add or edit participants at
		<code style="font-family: var(--font-mono);">/admin/participants</code>.
	</p>
</Card>
