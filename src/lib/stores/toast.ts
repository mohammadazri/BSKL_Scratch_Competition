// Toast store — global, single source. Push toasts from any component:
//   import { toasts } from '$lib/stores/toast';
//   toasts.success('Saved');
//   toasts.warning('Heads up', 'Title', { actionLabel: 'Review', onAction: () => goto(...) });

import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastEntry {
	id: number;
	kind: ToastKind;
	title?: string;
	message: string;
	actionLabel?: string;
	onAction?: () => void;
}

interface PushOpts {
	title?: string;
	ttlMs?: number;
	actionLabel?: string;
	onAction?: () => void;
}

function createToastStore() {
	const { subscribe, update } = writable<ToastEntry[]>([]);
	let nextId = 1;

	function push(kind: ToastKind, message: string, opts: PushOpts = {}) {
		const id = nextId++;
		const ttlMs = opts.ttlMs ?? 4000;
		update((arr) => [
			...arr,
			{
				id,
				kind,
				message,
				title: opts.title,
				actionLabel: opts.actionLabel,
				onAction: opts.onAction
			}
		]);
		if (ttlMs > 0) setTimeout(() => dismiss(id), ttlMs);
		return id;
	}

	function dismiss(id: number) {
		update((arr) => arr.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		dismiss,
		success: (message: string, title?: string) => push('success', message, { title }),
		error: (message: string, title?: string) =>
			push('error', message, { title, ttlMs: 6000 }),
		info: (message: string, title?: string) => push('info', message, { title }),
		/**
		 * Warning toast for things needing attention but not errors. 12s default,
		 * optionally renders an action button (label + callback).
		 */
		warning: (
			message: string,
			title?: string,
			opts: { actionLabel?: string; onAction?: () => void } = {}
		) =>
			push('warning', message, {
				title,
				ttlMs: 12000,
				actionLabel: opts.actionLabel,
				onAction: opts.onAction
			})
	};
}

export const toasts = createToastStore();
