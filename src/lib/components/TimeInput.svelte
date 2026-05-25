<!--
	TimeInput — "MM : SS" stopwatch-style entry for `live_sprint_time_seconds`.

	Two numeric inputs joined by a visible colon, with the integer-seconds
	value mirrored into a hidden field so no-JS submits still work. Max is
	2700 (45:00) per SCHEMA.md.
-->
<script lang="ts">
	import { secondsToTime, timeToSeconds } from '$lib/scoring';

	interface Props {
		/** Field name used by the surrounding form for the integer-seconds value. */
		name: string;
		value: number | null;
		disabled?: boolean;
		onValue?: (v: number | null) => void;
		maxSeconds?: number;
	}

	let {
		name,
		value = $bindable(null),
		disabled = false,
		onValue,
		maxSeconds = 2700
	}: Props = $props();

	const initialParts = secondsToTime(value);
	let minStr = $state(String(initialParts.minutes).padStart(2, '0'));
	let secStr = $state(String(initialParts.seconds).padStart(2, '0'));

	// keep local strings in sync if external value changes
	$effect(() => {
		const p = secondsToTime(value);
		minStr = String(p.minutes).padStart(2, '0');
		secStr = String(p.seconds).padStart(2, '0');
	});

	function recompute() {
		const m = Number(minStr);
		const s = Number(secStr);
		const total = timeToSeconds(m, s);
		if (total === null) return;
		const clamped = Math.min(maxSeconds, total);
		value = clamped;
		onValue?.(clamped);
	}

	function onMinInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		minStr = el.value.replace(/[^0-9]/g, '').slice(0, 2);
		recompute();
	}

	function onSecInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		let v = el.value.replace(/[^0-9]/g, '').slice(0, 2);
		// Don't actively reject — clamp on blur so the user can type freely.
		secStr = v;
		recompute();
	}

	function onSecBlur() {
		let n = Number(secStr);
		if (!Number.isFinite(n) || n < 0) n = 0;
		if (n > 59) n = 59;
		secStr = String(n).padStart(2, '0');
		recompute();
	}

	function onMinBlur() {
		let n = Number(minStr);
		if (!Number.isFinite(n) || n < 0) n = 0;
		if (n > 45) n = 45;
		minStr = String(n).padStart(2, '0');
		recompute();
	}

	function onClear() {
		minStr = '00';
		secStr = '00';
		value = null;
		onValue?.(null);
	}
</script>

<div class="flex items-center gap-2">
	<div
		class="inline-flex items-center overflow-hidden rounded-md border"
		style="border-color: var(--border-strong); background: var(--color-bg-1);"
	>
		<input
			type="text"
			inputmode="numeric"
			aria-label="Minutes"
			value={minStr}
			oninput={onMinInput}
			onblur={onMinBlur}
			{disabled}
			maxlength="2"
			class="w-14 bg-transparent px-2 text-right text-2xl font-medium outline-none"
			style="font-family: var(--font-mono); color: var(--color-text-1); min-height: 44px;"
		/>
		<span
			class="px-1 text-2xl"
			style="font-family: var(--font-mono); color: var(--color-text-2);"
		>
			:
		</span>
		<input
			type="text"
			inputmode="numeric"
			aria-label="Seconds"
			value={secStr}
			oninput={onSecInput}
			onblur={onSecBlur}
			{disabled}
			maxlength="2"
			class="w-14 bg-transparent px-2 text-left text-2xl font-medium outline-none"
			style="font-family: var(--font-mono); color: var(--color-text-1); min-height: 44px;"
		/>
	</div>
	{#if value !== null && !disabled}
		<button
			type="button"
			onclick={onClear}
			aria-label="Clear time"
			class="text-xs underline"
			style="color: var(--color-text-2);"
		>
			clear
		</button>
	{/if}
	<!-- Hidden integer seconds field that progressive-enhancement / no-JS submits read. -->
	<input type="hidden" {name} value={value ?? ''} />
</div>
