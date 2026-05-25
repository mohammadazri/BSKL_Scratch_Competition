<!--
	Modal — base building block. Used by ConfirmModal, AutoAssignPreview, etc.
	Centered card with backdrop, ESC to close, click outside to dismiss.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title?: string;
		size?: 'sm' | 'md' | 'lg';
		onclose?: () => void;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		size = 'md',
		onclose,
		children,
		footer
	}: Props = $props();

	const width = $derived(
		size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-3xl' : 'max-w-lg'
	);

	function close() {
		open = false;
		onclose?.();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<!-- backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/60"
		role="presentation"
		onclick={close}
		aria-hidden="true"
	></div>

	<!-- dialog -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'modal-title' : undefined}
	>
		<div
			class="relative w-full {width} rounded-[var(--radius-lg)] border shadow-xl"
			style="background: var(--color-bg-2); border-color: var(--border-strong);"
		>
			{#if title}
				<header
					class="flex items-center justify-between gap-3 border-b px-5 py-4"
					style="border-color: var(--border);"
				>
					<h2
						id="modal-title"
						class="text-base font-semibold"
						style="font-family: var(--font-display); color: var(--color-text-1);"
					>
						{title}
					</h2>
					<button
						type="button"
						class="-mr-2 grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-white/5"
						style="color: var(--color-text-2);"
						onclick={close}
						aria-label="Close"
					>
						<X size={18} strokeWidth={1.5} />
					</button>
				</header>
			{/if}
			<div class="p-5">
				{#if children}{@render children()}{/if}
			</div>
			{#if footer}
				<footer
					class="flex items-center justify-end gap-2 border-t px-5 py-4"
					style="border-color: var(--border);"
				>
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
