<!--
	ConfirmModal — DESIGN.md § 5. Danger variant for irreversible actions.
-->
<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		onconfirm?: () => void;
		oncancel?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		onconfirm,
		oncancel
	}: Props = $props();

	function cancel() {
		open = false;
		oncancel?.();
	}

	function confirm() {
		open = false;
		onconfirm?.();
	}
</script>

<Modal bind:open {title} size="sm" onclose={cancel}>
	<p class="text-sm" style="color: var(--color-text-2);">{message}</p>

	{#snippet footer()}
		<Button variant="ghost" onclick={cancel}>{cancelLabel}</Button>
		<Button variant={danger ? 'danger' : 'primary'} onclick={confirm}>{confirmLabel}</Button>
	{/snippet}
</Modal>
