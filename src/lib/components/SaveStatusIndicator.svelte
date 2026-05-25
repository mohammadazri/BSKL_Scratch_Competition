<!--
	SaveStatusIndicator — small status line for the autosave state machine.

	Five states: idle (no save yet), pending (dirty), saving (in flight),
	saved (with a relative timestamp), failed (with an optional retry button).

	The parent owns the actual save status; this component just renders.
	Note: the prop is called `status` (not `state`) because `state` would
	shadow the `$state` rune in Svelte 5.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'pending';

	interface Props {
		status: SaveState;
		savedAt: number | null; // epoch ms
		errorMessage?: string | null;
		onRetry?: () => void;
	}

	let { status, savedAt, errorMessage = null, onRetry }: Props = $props();

	let now = $state(Date.now());
	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		timer = setInterval(() => (now = Date.now()), 1000);
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	function relative(ms: number): string {
		const sec = Math.max(0, Math.floor((now - ms) / 1000));
		if (sec < 5) return 'just now';
		if (sec < 60) return `${sec}s ago`;
		const mins = Math.floor(sec / 60);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ago`;
	}
</script>

<div class="flex items-center justify-between gap-2 text-xs" aria-live="polite">
	{#if status === 'saving'}
		<span class="inline-flex items-center gap-2" style="color: var(--color-text-2);">
			<span
				class="inline-block h-2 w-2 animate-pulse rounded-full"
				style="background: var(--color-warning);"
			></span>
			saving…
		</span>
	{:else if status === 'failed'}
		<span class="inline-flex items-center gap-2" style="color: var(--color-danger);">
			<span
				class="inline-block h-2 w-2 rounded-full"
				style="background: var(--color-danger);"
			></span>
			save failed{errorMessage ? `: ${errorMessage}` : ''}
		</span>
		{#if onRetry}
			<button
				type="button"
				onclick={onRetry}
				class="underline"
				style="color: var(--color-accent);"
			>
				retry
			</button>
		{/if}
	{:else if status === 'pending'}
		<span class="inline-flex items-center gap-2" style="color: var(--color-text-2);">
			<span
				class="inline-block h-2 w-2 rounded-full"
				style="background: var(--color-text-3);"
			></span>
			unsaved changes
		</span>
	{:else if savedAt}
		<span class="inline-flex items-center gap-2" style="color: var(--color-text-2);">
			<span
				class="inline-block h-2 w-2 rounded-full"
				style="background: var(--color-success);"
			></span>
			saved {relative(savedAt)}
		</span>
	{:else}
		<span style="color: var(--color-text-3);">not saved yet</span>
	{/if}
</div>
