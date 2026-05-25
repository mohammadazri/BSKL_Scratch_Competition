<!--
	Root page — once auth lands (Track 2), this redirects users by role:
	  super_admin → /admin
	  judge       → /judge
	  viewer      → /viewer
	  unauth      → /login
	For now (Track 0 scaffold), it's a static placeholder.
-->

<main class="mx-auto max-w-2xl px-6 py-16 text-center">
	<p
		class="text-text-2 mb-2 text-xs font-medium tracking-[0.18em] uppercase"
		style="color: var(--color-text-2); font-family: var(--font-sans);"
	>
		P3 Robotics &amp; Coding · BSKL
	</p>
	<h1
		class="mb-4 text-4xl font-semibold"
		style="font-family: var(--font-display); color: var(--color-text-1);"
	>
		P3 Judging
	</h1>
	<p style="color: var(--color-text-2);">
		Future Coders Challenge 2026 — judges' marking platform.
	</p>
	<p class="mt-8 text-sm" style="color: var(--color-text-3);">
		Scaffold ready. Auth, scoring, and admin tracks land next.
	</p>
</main>
