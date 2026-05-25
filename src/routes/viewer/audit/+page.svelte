<!--
	/viewer/audit — read-only audit view.
	Same data as /admin/audit but no mutation affordances exist anywhere on the
	page (the audit log is read-only by design, so this is a no-op affordance
	difference — but we keep the CSV export available so observers can take
	the file with them).
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
	<title>Audit log · P3 Judging</title>
</svelte:head>

<AuditPage
	{data}
	subtitle="Live transparency log. Every mutation is recorded — append-only."
/>
