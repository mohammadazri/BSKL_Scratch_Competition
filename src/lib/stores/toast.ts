// Toast store — global, single source. Push toasts from any component:
//   import { toasts } from '$lib/stores/toast';
//   toasts.success('Saved');

import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastEntry {
	id: number;
	kind: ToastKind;
	title?: string;
	message: string;
}

function createToastStore() {
	const { subscribe, update } = writable<ToastEntry[]>([]);
	let nextId = 1;

	function push(kind: ToastKind, message: string, title?: string, ttlMs = 4000) {
		const id = nextId++;
		update((arr) => [...arr, { id, kind, message, title }]);
		if (ttlMs > 0) {
			setTimeout(() => dismiss(id), ttlMs);
		}
		return id;
	}

	function dismiss(id: number) {
		update((arr) => arr.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		dismiss,
		success: (message: string, title?: string) => push('success', message, title),
		error: (message: string, title?: string) => push('error', message, title, 6000),
		info: (message: string, title?: string) => push('info', message, title)
	};
}

export const toasts = createToastStore();
