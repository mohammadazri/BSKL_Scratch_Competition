<!--
	/login/forgot-password — request a password reset email.
	Same visual shell as /login (centered card + brand logos + DESIGN.md tokens).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
	let email = $state(untrack(() => (form as { email?: string } | null)?.email ?? ''));
</script>

<svelte:head>
	<title>Reset password · P3 Judging</title>
</svelte:head>

<main
	class="flex min-h-screen flex-col items-center justify-center px-6 py-12"
	style="background: var(--color-bg-0);"
>
	<div class="mb-8 flex items-center gap-4">
		<img src="/brand/p3-logo.png" alt="P3 Robotics & Coding" class="h-9 w-auto" />
		<span style="color: var(--color-text-3);">·</span>
		<img src="/brand/bskl-logo.png" alt="BSKL" class="h-9 w-auto" />
	</div>

	<div
		class="w-full max-w-sm rounded-[var(--radius-lg)] border p-8"
		style="background: var(--color-bg-1); border-color: var(--border-strong);"
	>
		<h1
			class="mb-1 text-2xl font-semibold"
			style="font-family: var(--font-display); color: var(--color-text-1);"
		>
			Reset password
		</h1>
		<p class="mb-7 text-sm" style="color: var(--color-text-2);">
			Enter your email and we'll send you a link to set a new password.
		</p>

		{#if form?.error}
			<div
				class="mb-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
				style="border-color: var(--color-danger); color: var(--color-danger); background: rgba(239, 68, 68, 0.08);"
				role="alert"
			>
				{form.error}
			</div>
		{/if}
		{#if form?.info}
			<div
				class="mb-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
				style="border-color: var(--color-success); color: var(--color-success); background: rgba(16, 185, 129, 0.08);"
				role="status"
			>
				{form.info}
			</div>
		{/if}

		{#if !form?.sent}
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
				class="space-y-4"
			>
				<label class="block">
					<span
						class="mb-1 block text-xs font-medium tracking-wider uppercase"
						style="color: var(--color-text-2);">Email</span
					>
					<input
						type="email"
						name="email"
						autocomplete="email"
						required
						bind:value={email}
						class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:outline-none"
						style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
					/>
				</label>

				<button
					type="submit"
					disabled={submitting}
					class="w-full rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
					style="background: var(--color-accent); color: white; min-height: 44px;"
				>
					{submitting ? 'Sending…' : 'Send reset link'}
				</button>
			</form>
		{/if}

		<div class="mt-5 text-center text-xs" style="color: var(--color-text-2);">
			<a
				href="/login"
				class="underline-offset-4 hover:underline"
				style="color: var(--color-accent-2);"
			>
				← Back to sign in
			</a>
		</div>
	</div>

	<p class="mt-8 text-center text-xs" style="color: var(--color-text-3);">
		Trouble signing in? Speak to Mohammad.
	</p>
</main>
