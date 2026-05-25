<!-- /admin/scoresheets/[id] — see TRACK_5_RESULTS.md. Body in <ScoresheetDetailPage>. -->
<script lang="ts">
	import ScoresheetDetailPage from '$lib/components/results/ScoresheetDetailPage.svelte';
	import type { PageData } from './$types';
	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<svelte:head>
	<title>
		{data.detail?.participantName ?? 'Scoresheet'} · P3 Judging
	</title>
</svelte:head>

<ScoresheetDetailPage {data} />
