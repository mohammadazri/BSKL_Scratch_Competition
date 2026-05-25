<!--
	/judge/audit — judge view of own actions.
	Hide the actor filter because RLS pins the actor to themselves anyway.
-->
<script lang="ts">
	import AuditPage from '$lib/components/audit/AuditPage.svelte';
	import type { PageData } from './$types';
	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<svelte:head>
	<title>My activity · P3 Judging</title>
</svelte:head>

<AuditPage
	{data}
	title="My activity"
	subtitle="A read-only log of every action you've taken in this app."
	showActorFilter={false}
	canExport={false}
/>
