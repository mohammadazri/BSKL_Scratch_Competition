<!--
	LiveIndicator — pulsing dot + status text for the realtime subscription.

	States (per DESIGN.md § 4 D):
	  • subscribed   → ◐ live    (green dot, soft pulse)
	  • connecting   → ◐ live    (yellow dot, faster pulse)
	  • disconnected → ○ paused  (red dot, no pulse)
	  • disabled     → ○ paused  (grey dot, no pulse — JS off / unmounted)

	Pulse animation respects prefers-reduced-motion (app.css globally disables it).
-->
<script lang="ts" module>
	export type LiveStatus = 'subscribed' | 'connecting' | 'disconnected' | 'disabled';
</script>

<script lang="ts">
	interface Props {
		status: LiveStatus;
	}
	let { status }: Props = $props();

	const labels: Record<LiveStatus, string> = {
		subscribed: 'live',
		connecting: 'connecting',
		disconnected: 'reconnecting',
		disabled: 'paused'
	};

	const dotColors: Record<LiveStatus, string> = {
		subscribed: 'var(--color-success)',
		connecting: 'var(--color-warning)',
		disconnected: 'var(--color-danger)',
		disabled: 'var(--color-text-3)'
	};
</script>

<span
	class="inline-flex items-center gap-2 text-xs font-medium tracking-wider uppercase"
	style="color: var(--color-text-2);"
	role="status"
	aria-live="polite"
>
	<span
		class="block h-2 w-2 rounded-full"
		class:pulse={status === 'subscribed' || status === 'connecting'}
		style="background: {dotColors[status]};"
		aria-hidden="true"
	></span>
	<span>{labels[status]}</span>
</span>

<style>
	.pulse {
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.55;
			transform: scale(1.4);
		}
	}
</style>
