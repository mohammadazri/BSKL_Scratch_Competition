<script lang="ts">
	import { Copy, ExternalLink, Eye, EyeOff, KeyRound, TriangleAlert } from '@lucide/svelte';
	import { toasts } from '$lib/stores/toast';

	interface Props {
		credentials: { username: string; password: string } | null;
	}

	let { credentials }: Props = $props();
	let revealed = $state(false);

	async function copyValue(value: string, label: string) {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(value);
			} else {
				const field = document.createElement('textarea');
				field.value = value;
				field.style.position = 'fixed';
				field.style.opacity = '0';
				document.body.appendChild(field);
				field.select();
				const copied = document.execCommand('copy');
				field.remove();
				if (!copied) throw new Error('copy failed');
			}
			toasts.success(`${label} copied.`);
		} catch {
			toasts.error(`Could not copy ${label.toLowerCase()}.`);
		}
	}
</script>

{#if credentials}
	<section
		class="mb-4 overflow-hidden rounded-xl border"
		style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.10), rgba(236, 72, 153, 0.06)); border-color: rgba(56, 189, 248, 0.45);"
		aria-labelledby="scratch-access-heading"
	>
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
			style="border-color: var(--border);"
		>
			<div class="flex items-center gap-2">
				<span
					class="grid h-9 w-9 place-items-center rounded-lg"
					style="background: rgba(56, 189, 248, 0.15); color: var(--color-accent-2);"
				>
					<KeyRound size={18} strokeWidth={1.8} />
				</span>
				<div>
					<h2
						id="scratch-access-heading"
						class="text-sm font-semibold"
						style="color: var(--color-text-1);"
					>
						Scratch access
					</h2>
					<p class="text-[11px]" style="color: var(--color-text-2);">
						Competition account for this participant
					</p>
				</div>
			</div>
			<a
				href="https://scratch.mit.edu/"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
				style="background: var(--color-accent-2); color: #06111a;"
			>
				Open Scratch
				<ExternalLink size={15} strokeWidth={1.8} />
			</a>
		</div>

		<div class="grid gap-3 p-4 sm:grid-cols-2">
			<div
				class="rounded-lg border p-3"
				style="background: var(--color-bg-1); border-color: var(--border);"
			>
				<p
					class="mb-1 text-[10px] font-semibold tracking-wider uppercase"
					style="color: var(--color-text-3);"
				>
					Username
				</p>
				<div class="flex items-center justify-between gap-2">
					<code class="min-w-0 truncate text-sm font-semibold" style="color: var(--color-text-1);">
						{credentials.username}
					</code>
					<button
						type="button"
						class="grid h-10 w-10 shrink-0 place-items-center rounded-md transition hover:bg-white/5"
						style="color: var(--color-accent-2);"
						onclick={() => copyValue(credentials.username, 'Username')}
						aria-label="Copy Scratch username"
						title="Copy username"
					>
						<Copy size={16} strokeWidth={1.8} />
					</button>
				</div>
			</div>

			<div
				class="rounded-lg border p-3"
				style="background: var(--color-bg-1); border-color: var(--border);"
			>
				<p
					class="mb-1 text-[10px] font-semibold tracking-wider uppercase"
					style="color: var(--color-text-3);"
				>
					Password
				</p>
				<div class="flex items-center justify-between gap-1">
					<code
						class="min-w-0 flex-1 truncate text-sm font-semibold"
						style="color: var(--color-text-1);"
					>
						{revealed ? credentials.password : '••••••••••••'}
					</code>
					<button
						type="button"
						class="grid h-10 w-10 shrink-0 place-items-center rounded-md transition hover:bg-white/5"
						style="color: var(--color-text-2);"
						onclick={() => (revealed = !revealed)}
						aria-label={revealed ? 'Hide Scratch password' : 'Reveal Scratch password'}
						title={revealed ? 'Hide password' : 'Reveal password'}
					>
						{#if revealed}<EyeOff size={16} strokeWidth={1.8} />{:else}<Eye
								size={16}
								strokeWidth={1.8}
							/>{/if}
					</button>
					<button
						type="button"
						class="grid h-10 w-10 shrink-0 place-items-center rounded-md transition hover:bg-white/5"
						style="color: var(--color-accent-2);"
						onclick={() => copyValue(credentials.password, 'Password')}
						aria-label="Copy Scratch password"
						title="Copy password"
					>
						<Copy size={16} strokeWidth={1.8} />
					</button>
				</div>
			</div>
		</div>
	</section>
{:else}
	<section
		class="mb-4 flex items-start gap-3 rounded-xl border p-4"
		style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.5);"
		role="status"
	>
		<TriangleAlert
			class="mt-0.5 shrink-0"
			size={18}
			strokeWidth={1.8}
			color="var(--color-warning)"
		/>
		<div>
			<p class="text-sm font-semibold" style="color: var(--color-warning);">
				Scratch access missing
			</p>
			<p class="mt-0.5 text-xs" style="color: var(--color-text-2);">
				Ask the registration committee to add this participant's Scratch username and password.
			</p>
		</div>
	</section>
{/if}
