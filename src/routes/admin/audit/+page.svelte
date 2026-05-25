<!-- /admin/audit — see TRACK_4_AUDIT.md.  Body lives in <AuditPage>. -->
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

<AuditPage {data} />
