<!--
	/admin — dashboard.
	Full progress + judge load + activity feed land in checkpoint 11.
	For checkpoint 2 this is just the shell stub that the role guard protects.
-->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
</script>

<svelte:head>
	<title>Dashboard · P3 Judging</title>
</svelte:head>

<PageHeader title="Dashboard" subtitle="Event setup and live progress." />

<div class="grid gap-4 md:grid-cols-2">
	<Card label="Event Progress">
		<p class="text-sm" style="color: var(--color-text-2);">
			Per-category scoring progress lands in the dashboard build.
		</p>
	</Card>
	<Card label="Judge Load">
		<p class="text-sm" style="color: var(--color-text-2);">
			Per-judge counts and progress dots land in the dashboard build.
		</p>
	</Card>
</div>
