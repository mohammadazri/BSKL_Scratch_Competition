<!--
	BrandHeader — top-of-app branding bar (DESIGN.md § 1).
	Renders P3 Robotics & Coding (host) and BSKL (venue) logos either side of
	the app title. Logos are official assets fetched into static/brand/ at setup
	time — never redraw or restyle. If the assets are placeholders (see
	static/brand/TODO_BRAND_ASSETS.md), the visual placement still works.

	Optional `right` snippet (e.g. user menu) sits at the far right.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		subtitle?: string;
		right?: Snippet;
	}
	let { subtitle = 'Future Coders Challenge 2026', right }: Props = $props();
</script>

<header
	class="flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6"
	style="background: var(--color-bg-1); border-color: var(--border, rgba(255,255,255,0.08));"
>
	<a href="/" class="flex items-center gap-3" aria-label="P3 Judging home">
		<img src="/brand/p3-logo.png" alt="P3 Robotics &amp; Coding" class="h-8 w-auto" />
		<div class="flex flex-col leading-tight">
			<span
				class="text-sm font-semibold"
				style="font-family: var(--font-display); color: var(--color-text-1);"
			>
				P3 Judging
			</span>
			<span class="text-[11px]" style="color: var(--color-text-2);">{subtitle}</span>
		</div>
	</a>

	<div class="flex items-center gap-3">
		<!-- Hide "hosted at BSKL" on screens under lg because the user menu +
		     hamburger compete for the same right side and the labels overlap.
		     The BSKL logo still appears as the second avatar in the header on
		     desktop (lg+); on tablet/mobile we drop it to keep the user info
		     legible. -->
		<div class="hidden items-center gap-2 lg:flex">
			<span class="text-[11px]" style="color: var(--color-text-2);">hosted at</span>
			<img
				src="/brand/bskl-logo.png"
				alt="British International School of Kuala Lumpur"
				class="h-8 w-auto"
			/>
		</div>
		{#if right}{@render right()}{/if}
	</div>
</header>

<style>
	@media (max-width: 640px) {
		img {
			height: 28px;
		}
	}
</style>
