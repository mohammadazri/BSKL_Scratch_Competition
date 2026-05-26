<!--
	/auth/change-password — forced first-login change.
	Mirrors the visual style of /login.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let password = $state('');
	let confirm = $state('');
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Set your password · P3 Judging</title>
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
			{data.mustChange ? 'Set your password' : 'Change your password'}
		</h1>
		<p class="mb-5 text-xs" style="color: var(--color-text-2);">
			{#if data.mustChange}
				Welcome, {data.fullName}. Choose a new password to replace your temporary one before continuing.
			{:else}
				Update the password for {data.fullName}.
			{/if}
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
					required
					minlength="8"
					bind:value={password}
					class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:outline-none"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				/>
			</label>

			<label class="block">
				<span
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);">Confirm password</span
				>
				<input
					type="password"
					name="confirm"
					autocomplete="new-password"
					required
					minlength="8"
					bind:value={confirm}
					class="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm focus:outline-none"
					style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
				/>
			</label>

			<p class="text-xs" style="color: var(--color-text-3);">
				At least 8 characters. Use something memorable — there's no "forgot password" recovery on event day.
			</p>

			<button
				type="submit"
				disabled={submitting || password.length < 8 || password !== confirm}
				class="w-full rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
				style="background: var(--color-accent); color: white; min-height: 44px;"
			>
				{submitting ? 'Saving…' : 'Set password and continue'}
			</button>
		</form>
	</div>
</main>
