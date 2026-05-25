<!--
	NumberStepper — touch-friendly +/− stepper with a big mono numeric display.

	Used inside <CriterionCard> to enter the exact points value within the
	current level's band. min / max are the band bounds. Clamps to [min, max].
	Buttons are ≥ 44px (tablet rule). A hidden <input> mirrors the value so the
	surrounding <form> still submits without JS (progressive enhancement).
-->
<script lang="ts">
	interface Props {
		name: string;
		value: number | null;
		min: number;
		max: number;
		disabled?: boolean;
		onValue?: (v: number) => void;
	}

	let { name, value = $bindable(null), min, max, disabled = false, onValue }: Props = $props();

	function clamp(v: number): number {
		if (Number.isNaN(v)) return min;
		if (v < min) return min;
		if (v > max) return max;
		return v;
	}

	function bump(delta: number) {
		if (disabled) return;
		const next = clamp((value ?? min) + delta);
		value = next;
		onValue?.(next);
	}

	function onInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const n = Number(el.value);
		if (!Number.isFinite(n)) return;
		const c = clamp(n);
		value = c;
		onValue?.(c);
	}

	function onBlur(e: FocusEvent) {
		const el = e.currentTarget as HTMLInputElement;
		const n = Number(el.value);
		const c = clamp(n);
		value = c;
		onValue?.(c);
	}
</script>

<div
	class="inline-flex items-stretch overflow-hidden rounded-md border"
	style="border-color: var(--border-strong); background: var(--color-bg-1);"
>
	<button
		type="button"
		aria-label="Decrease"
		onclick={() => bump(-1)}
		disabled={disabled || (value ?? min) <= min}
		class="flex items-center justify-center text-xl font-semibold transition-colors disabled:opacity-40"
		style="min-width: 44px; min-height: 44px; background: var(--color-bg-2); color: var(--color-text-1); border-right: 1px solid var(--border);"
	>
		−
	</button>
	<input
		type="number"
		{name}
		inputmode="numeric"
		{min}
		{max}
		value={value ?? ''}
		oninput={onInput}
		onblur={onBlur}
		{disabled}
		aria-label="Points"
		class="w-20 bg-transparent px-2 text-center text-2xl font-medium outline-none"
		style="font-family: var(--font-mono); color: var(--color-text-1); min-height: 44px;"
	/>
	<button
		type="button"
		aria-label="Increase"
		onclick={() => bump(1)}
		disabled={disabled || (value ?? min) >= max}
		class="flex items-center justify-center text-xl font-semibold transition-colors disabled:opacity-40"
		style="min-width: 44px; min-height: 44px; background: var(--color-bg-2); color: var(--color-text-1); border-left: 1px solid var(--border);"
	>
		+
	</button>
</div>
