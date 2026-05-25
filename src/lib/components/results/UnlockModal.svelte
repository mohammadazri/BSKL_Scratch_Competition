<!--
	UnlockModal — super_admin sends a scoresheet back to draft.

	  • Reason field required (UI + server enforce).
	  • Submits via use:enhance to ?/unlock on the parent page.
	  • On success, toast + close. The page invalidates and the status pill
	    updates to "draft".

	Triggers a real form POST so the audit_log trigger captures the
	scoresheets.status transition automatically (no manual audit write).
-->
<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import { Unlock } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { toasts } from '$lib/stores/toast';

	interface Props {
		open: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	let reason = $state('');
	let submitting = $state(false);
	let errorMsg = $state<string | null>(null);

	$effect(() => {
		if (open) {
			reason = '';
			errorMsg = null;
		}
	});

	function close() {
		if (submitting) return;
		open = false;
	}
</script>

<Modal bind:open size="sm" title="Unlock scoresheet" onclose={close}>
	<form
		id="unlock-form"
		method="POST"
		action="?/unlock"
		use:enhance={({ formData, cancel }) => {
			const r = String(formData.get('reason') ?? '').trim();
			if (!r) {
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
						(result.data as { unlockError?: string } | undefined)?.unlockError ??
						'Unlock failed.';
					return;
				}
				if (result.type === 'error') {
					errorMsg = result.error?.message ?? 'Unlock failed.';
					return;
				}
				toasts.success('Scoresheet unlocked. Judge can re-edit and resubmit.');
				open = false;
				await update();
			};
		}}
	>
		<p class="mb-3 text-sm" style="color: var(--color-text-2);">
			The scoresheet returns to <strong>draft</strong> state. The original judge
			can re-edit and re-submit. The action is recorded in the audit log.
		</p>
		<Textarea
			label="Reason"
			name="reason"
			required
			bind:value={reason}
			rows={3}
			placeholder="Why is this scoresheet being unlocked?"
			error={errorMsg ?? undefined}
		/>
	</form>

	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={close} disabled={submitting}>
			Cancel
		</Button>
		<button
			type="submit"
			form="unlock-form"
			disabled={submitting}
			class="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			style="background: var(--color-warning); color: #1A1300; border: 1px solid var(--color-warning);"
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
				<Unlock size={14} strokeWidth={1.5} />
			{/if}
			Unlock to draft
		</button>
	{/snippet}
</Modal>
