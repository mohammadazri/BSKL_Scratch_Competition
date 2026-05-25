<!--
	/viewer/scoresheets/[id] — read-only drill-in.
	Same scaffolding rationale as /viewer/results — wraps in BrandHeader + main
	because the viewer route group has no AppShell layout yet.
-->
<script lang="ts">
	import BrandHeader from '$lib/components/BrandHeader.svelte';
	import ScoresheetDetailPage from '$lib/components/results/ScoresheetDetailPage.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<BrandHeader />

<main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
	<ScoresheetDetailPage {data} />
</main>
