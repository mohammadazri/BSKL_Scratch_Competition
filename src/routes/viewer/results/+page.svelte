<!--
	/viewer/results — read-only leaderboard.
	The viewer route group has no AppShell wrapper yet (Track 4 owns the broader
	viewer layout). We render <BrandHeader> + a <main> container here so the
	page works on its own. If/when a shared viewer +layout.svelte lands, this
	scaffolding can be deleted.
-->
<script lang="ts">
	import BrandHeader from '$lib/components/BrandHeader.svelte';
	import LeaderboardPage from '$lib/components/results/LeaderboardPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<BrandHeader />

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
	<LeaderboardPage {data} />
</main>
