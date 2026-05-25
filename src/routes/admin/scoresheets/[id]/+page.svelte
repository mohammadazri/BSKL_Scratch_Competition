<!-- /admin/scoresheets/[id] — drill-in. Body in <ScoresheetDetailPage>. -->
<script lang="ts">
	import ScoresheetDetailPage from '$lib/components/results/ScoresheetDetailPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<ScoresheetDetailPage {data} />
