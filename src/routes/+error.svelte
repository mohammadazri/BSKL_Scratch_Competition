<!--
	Top-level error boundary. Any unhandled error in a `load`, `+page.server.ts`
	action, or component render falls through to this page instead of showing
	SvelteKit's default white screen. Keeps the user out of a dead end on event
	day and always offers a way back.

	Rules:
	  - Never expose raw stack traces.
	  - Always offer at least one navigation action.
	  - Use design tokens — no hard-coded colors.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import { AlertTriangle, Home, LogIn } from '@lucide/svelte';

	let status = $derived(page.status);

	let title = $derived(
		status === 404
			? 'Page not found'
			: status === 403
				? 'Access denied'
				: status === 401
					? 'You need to sign in'
					: status >= 500
						? 'Server error'
						: 'Something went wrong'
	);

	let hint = $derived(
		status === 404
			? "The page you're looking for doesn't exist."
			: status === 403
				? "You're signed in but don't have permission to view this page."
				: status === 401
					? 'Your session expired. Sign in again to continue.'
					: status >= 500
						? 'A server-side error occurred. If this keeps happening, contact the event admin.'
						: (page.error?.message ?? 'Please try going back home.')
	);
</script>

<svelte:head>
	<title>{title} · P3 Judging</title>
</svelte:head>

<main
	class="flex min-h-screen flex-col items-center justify-center px-6 py-12"
	style="background: var(--color-bg-0);"
>
	<div
		class="w-full max-w-md rounded-[var(--radius-lg)] border p-8 text-center"
		style="background: var(--color-bg-1); border-color: var(--border-strong);"
	>
		<div
			class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full"
			style="background: var(--color-bg-3); color: var(--color-warning);"
		>
			<AlertTriangle size={22} strokeWidth={1.5} />
		</div>
		<p
			class="mb-1 text-xs font-medium tracking-wider uppercase"
			style="color: var(--color-text-3); font-family: var(--font-mono);"
		>
			Error {status}
		</p>
		<h1
			class="mb-2 text-xl font-semibold"
			style="font-family: var(--font-display); color: var(--color-text-1);"
		>
			{title}
		</h1>
		<p class="mb-6 text-sm" style="color: var(--color-text-2);">{hint}</p>

		<div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
			<Button variant="primary" href="/">
				{#snippet icon()}<Home size={16} strokeWidth={1.5} />{/snippet}
				Back home
			</Button>
			{#if status === 401 || status === 403}
				<Button variant="ghost" href="/login">
					{#snippet icon()}<LogIn size={16} strokeWidth={1.5} />{/snippet}
					Sign in
				</Button>
			{/if}
		</div>
	</div>
</main>
