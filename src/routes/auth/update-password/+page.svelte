<!--
	/auth/update-password — pick a new password after clicking the reset link.
	The recovery session is already in place by the time this renders.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
	let password = $state('');
	let confirm = $state('');
</script>

<svelte:head>
	<title>Set a new password · P3 Judging</title>
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
			Set new password
		</h1>
		<p class="mb-6 text-sm" style="color: var(--color-text-2);">
			Signed in as <span style="color: var(--color-text-1);">{data.email}</span>. Choose a new
			password to use from now on.
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
					style="color: var(--color-text-2);">New password</span
				>
				<input
					type="password"
					name="password"
					autocomplete="new-password"
					minlength="8"
					required
					bind:value={password}
					class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:outline-none"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				/>
				<span class="mt-1 block text-[11px]" style="color: var(--color-text-3);">
					At least 8 characters.
				</span>
			</label>

			<label class="block">
				<span
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);">Confirm new password</span
				>
				<input
					type="password"
					name="confirm"
					autocomplete="new-password"
					minlength="8"
					required
					bind:value={confirm}
					class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:outline-none"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				/>
			</label>

			<button
				type="submit"
				disabled={submitting || password.length < 8 || password !== confirm}
				class="w-full rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
				style="background: var(--color-accent); color: white; min-height: 44px;"
			>
				{submitting ? 'Updating…' : 'Update password'}
			</button>
		</form>
	</div>
</main>
