<!-- /admin/results — see TRACK_5_RESULTS.md. Body lives in <LeaderboardPage>. -->
<script lang="ts">
	import LeaderboardPage from '$lib/components/results/LeaderboardPage.svelte';
	import type { PageData } from './$types';
	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Leaderboard · P3 Judging</title>
</svelte:head>

<LeaderboardPage {data} />
