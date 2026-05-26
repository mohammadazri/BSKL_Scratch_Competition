// Browser-side Supabase Realtime helpers.
//
// Wraps the channel subscription boilerplate so route components can do:
//
//   onMount(() =>
//     subscribeTable('edit_requests', {
//       onInsert: (row) => { ... },
//       onUpdate: (row) => { ... },
//       filter: 'requested_by=eq.<uuid>'
//     })
//   );
//
// The returned function is the cleanup — wire it into onMount's return value
// so the subscription is torn down on navigation.

import { createSupabaseBrowser } from './supabase';

export interface SubscribeOpts<T = Record<string, unknown>> {
	/** Postgres filter expression, e.g. `status=eq.pending`. Optional. */
	filter?: string;
	onInsert?: (row: T) => void;
	onUpdate?: (newRow: T, oldRow: T) => void;
	onDelete?: (oldRow: T) => void;
}

export function subscribeTable<T = Record<string, unknown>>(
	table: string,
	opts: SubscribeOpts<T>
): () => void {
	const sb = createSupabaseBrowser();
	// Each call creates its own channel so multiple components can subscribe
	// to the same table with different filters without interfering.
	const channelName = `${table}:${opts.filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;
	const channel = sb.channel(channelName);

	type PgPayload = {
		eventType: 'INSERT' | 'UPDATE' | 'DELETE';
		new: T;
		old: T;
	};

	const config: { event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'; schema: string; table: string; filter?: string } = {
		event: '*',
		schema: 'public',
		table
	};
	if (opts.filter) config.filter = opts.filter;

	// supabase-js typings for `on('postgres_changes', ...)` are loose — use
	// any internally and re-narrow in the callback.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(channel as any).on('postgres_changes', config, (payload: PgPayload) => {
		if (payload.eventType === 'INSERT' && opts.onInsert) opts.onInsert(payload.new);
		else if (payload.eventType === 'UPDATE' && opts.onUpdate)
			opts.onUpdate(payload.new, payload.old);
		else if (payload.eventType === 'DELETE' && opts.onDelete) opts.onDelete(payload.old);
	});

	channel.subscribe();

	return () => {
		sb.removeChannel(channel);
	};
}
