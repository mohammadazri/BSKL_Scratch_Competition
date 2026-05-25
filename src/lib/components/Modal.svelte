<!--
	Minimal accessible modal shell. Renders a fixed overlay with a centred
	dialog when `open` is true; clicking the overlay or pressing Escape closes
	via `onClose`. The body slot owns the inner layout entirely.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		onClose: () => void;
		children: Snippet;
	}

	let { open, title, onClose, children }: Props = $props();

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0, 0, 0, 0.6);"
	>
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default"
			aria-label="Close dialog"
			onclick={onClose}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative w-full max-w-md overflow-hidden rounded-lg border"
			style="background: var(--color-bg-2); border-color: var(--border-strong);"
		>
			<header
				class="flex items-center justify-between border-b px-4 py-3"
				style="border-color: var(--border);"
			>
				<h2 class="text-base font-medium" style="color: var(--color-text-1);">{title}</h2>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close"
					class="inline-flex h-9 w-9 items-center justify-center rounded-md text-lg"
					style="color: var(--color-text-2);"
				>
					×
				</button>
			</header>
			<div class="p-4">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
