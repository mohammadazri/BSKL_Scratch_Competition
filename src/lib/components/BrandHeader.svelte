<!--
	BrandHeader — top-of-app branding bar (DESIGN.md § 1).
	Renders P3 Robotics & Coding (host) and BSKL (venue) logos either side of
	the app title. Logos are official assets fetched into static/brand/ at setup
	time — never redraw or restyle. If the assets are placeholders (see
	static/brand/TODO_BRAND_ASSETS.md), the visual placement still works.
-->
<script lang="ts">
	interface Props {
		subtitle?: string;
	}
	let { subtitle = 'Future Coders Challenge 2026' }: Props = $props();
</script>

<header
	class="flex h-14 w-full items-center justify-between gap-4 border-b px-6"
	style="background: var(--color-bg-1); border-color: var(--border, rgba(255,255,255,0.08));"
>
	<div class="flex items-center gap-3">
		<img src="/brand/p3-logo.svg" alt="P3 Robotics &amp; Coding" class="h-8 w-auto" />
		<div class="flex flex-col leading-tight">
			<span
				class="text-sm font-semibold"
				style="font-family: var(--font-display); color: var(--color-text-1);"
			>
				P3 Judging
			</span>
			<span class="text-[11px]" style="color: var(--color-text-2);">{subtitle}</span>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<span class="hidden text-[11px] sm:inline" style="color: var(--color-text-2);">
			hosted at
		</span>
		<img src="/brand/bskl-logo.svg" alt="British International School of Kuala Lumpur" class="h-8 w-auto" />
	</div>
</header>

<style>
	@media (max-width: 640px) {
		img {
			height: 28px;
		}
	}
</style>
