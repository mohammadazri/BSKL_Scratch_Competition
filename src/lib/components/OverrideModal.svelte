<!--
	OverrideModal — super_admin overrides a single criterion score.
	  • Choose a new level (from that criterion's bands).
	  • Stepper clamps points to the chosen band.
	  • Reason required (UI + server enforce).
	  • Submits via a form POST (use:enhance) to ?/override on the parent page.

	The form lives inside the modal body but the submit button is in the footer;
	we wire them up via the standard `form="override-form"` attribute so HTML
	submission still works the same way.
-->
<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Select from './Select.svelte';
	import Textarea from './Textarea.svelte';
	import { ShieldAlert } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { toasts } from '$lib/stores/toast';
	import type { PerfLevel } from '$lib/types';
	import type { RubricLevel } from '$lib/scoring';

	interface Props {
		open: boolean;
		criterionId: string;
		criterionName: string;
		maxPoints: number;
		levels: RubricLevel[];
		currentLevel: PerfLevel | null;
		currentPoints: number | null;
		currentJudgeName: string;
		onclose?: () => void;
		onsuccess?: () => void;
	}

	let {
		open = $bindable(false),
		criterionId,
		criterionName,
		maxPoints,
		levels,
		currentLevel,
		currentPoints,
		currentJudgeName,
		onclose,
		onsuccess
	}: Props = $props();

	// Working state — re-seeded from props every time the modal opens (the
	// $effect below tracks `open` + the criterion props and rewrites these).
	let newLevel = $state<PerfLevel>('Proficient');
	let newPoints = $state<number>(0);
	let reason = $state('');
	let submitting = $state(false);
	let errorMsg = $state<string | null>(null);

	// Re-seed when modal opens with new context (clicking a different criterion).
	$effect(() => {
		if (open) {
			newLevel = currentLevel ?? levels[0]?.level ?? 'Proficient';
			newPoints =
				currentPoints ??
				Math.round(((levels[0]?.minPts ?? 0) + (levels[0]?.maxPts ?? 0)) / 2);
			reason = '';
			errorMsg = null;
		}
	});

	const activeBand = $derived(levels.find((l) => l.level === newLevel) ?? levels[0]);

	function handleLevelChange(level: PerfLevel) {
		newLevel = level;
		const band = levels.find((l) => l.level === level);
		if (band) {
			newPoints = Math.round((band.minPts + band.maxPts) / 2);
		}
	}

	function clampPoints() {
		if (!activeBand) return;
		if (newPoints < activeBand.minPts) newPoints = activeBand.minPts;
		if (newPoints > activeBand.maxPts) newPoints = activeBand.maxPts;
	}

	function close() {
		if (submitting) return;
		open = false;
		onclose?.();
	}
</script>

<Modal bind:open size="md" title="Override score — {criterionName}" onclose={close}>
	<form
		id="override-form"
		method="POST"
		action="?/override"
		use:enhance={({ formData, cancel }) => {
			const trimmed = String(formData.get('reason') ?? '').trim();
			if (!trimmed) {
				errorMsg = 'A reason is required.';
				cancel();
				return;
			}
			submitting = true;
			errorMsg = null;
			return async ({ result, update }) => {
				submitting = false;
				if (result.type === 'failure') {
					errorMsg =
						(result.data as { overrideError?: string } | undefined)?.overrideError ??
						'Override failed.';
					return;
				}
				if (result.type === 'error') {
					errorMsg = result.error?.message ?? 'Override failed.';
					return;
				}
				toasts.success('Score override saved.');
				open = false;
				onsuccess?.();
				await update();
			};
		}}
	>
		<input type="hidden" name="criterion_id" value={criterionId} />
		<input type="hidden" name="level" value={newLevel} />
		<input type="hidden" name="points" value={newPoints} />

		<div class="space-y-4">
			<div
				class="rounded-[var(--radius)] border p-3 text-xs"
				style="background: var(--color-bg-1); border-color: var(--border);"
			>
				<div class="flex items-start gap-2">
					<ShieldAlert
						size={16}
						strokeWidth={1.5}
						style="color: var(--color-warning); flex-shrink: 0;"
					/>
					<div style="color: var(--color-text-2);">
						<span style="color: var(--color-text-1);">Current:</span>
						{currentLevel ?? '—'} · {currentPoints ?? '—'} / {maxPoints}
						(by {currentJudgeName})
						<p class="mt-1">
							The judge's comment is preserved. The original score remains in the
							audit log.
						</p>
					</div>
				</div>
			</div>

			<Select
				label="New level"
				required
				value={newLevel}
				onchange={(e) => handleLevelChange((e.target as HTMLSelectElement).value as PerfLevel)}
			>
				{#each levels as l (l.level)}
					<option value={l.level}>
						{l.level} — {l.minPts}–{l.maxPts} pts
					</option>
				{/each}
			</Select>

			<div>
				<label
					for="override-points"
					class="mb-1 block text-xs font-medium tracking-wider uppercase"
					style="color: var(--color-text-2);"
				>
					New points <span style="color: var(--color-accent);">•</span>
					<span class="ml-1 normal-case opacity-75">
						(band: {activeBand?.minPts}–{activeBand?.maxPts})
					</span>
				</label>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] border text-lg"
						style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
						onclick={() => {
							newPoints -= 1;
							clampPoints();
						}}
						aria-label="Decrement"
					>
						−
					</button>
					<input
						id="override-points"
						type="number"
						bind:value={newPoints}
						min={activeBand?.minPts ?? 0}
						max={activeBand?.maxPts ?? maxPoints}
						class="w-24 rounded-[var(--radius-sm)] border px-3 py-2 text-center font-mono text-base"
						style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1); min-height: 44px;"
						onblur={clampPoints}
					/>
					<span class="text-sm" style="color: var(--color-text-2);">
						/ {maxPoints}
					</span>
					<button
						type="button"
						class="grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] border text-lg"
						style="background: var(--color-bg-3); border-color: var(--border); color: var(--color-text-1);"
						onclick={() => {
							newPoints += 1;
							clampPoints();
						}}
						aria-label="Increment"
					>
						+
					</button>
				</div>
			</div>

			<Textarea
				label="Reason"
				name="reason"
				required
				bind:value={reason}
				rows={3}
				placeholder="Why is this score being changed? (visible in audit log)"
				hint="Captured in audit_log.after_json.override_reason."
				error={errorMsg ?? undefined}
			/>
		</div>
	</form>

	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={close} disabled={submitting}>
			Cancel
		</Button>
		<button
			type="submit"
			form="override-form"
			disabled={submitting}
			class="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			style="background: var(--color-danger); color: white; border: 1px solid var(--color-danger);"
		>
			{#if submitting}
				<svg
					class="h-4 w-4 animate-spin"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
				</svg>
			{:else}
				<ShieldAlert size={16} strokeWidth={1.5} />
			{/if}
			Override
		</button>
	{/snippet}
</Modal>
