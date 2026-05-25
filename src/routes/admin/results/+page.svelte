<!-- /admin/results — body lives in <LeaderboardPage>. -->
<script lang="ts">
	import LeaderboardPage from '$lib/components/results/LeaderboardPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<LeaderboardPage {data} />
