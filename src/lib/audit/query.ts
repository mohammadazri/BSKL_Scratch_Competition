// Shared audit_log query layer.
//
// Used by every audit route (/admin/audit, /viewer/audit, /judge/audit).
// RLS handles WHO sees WHAT — we just build the filter clauses.
//
//   • super_admin + viewer: see all rows (audit_log_read_all policy)
//   • judge: sees only rows where actor_id = auth.uid() (audit_log_judge_self_read)
//
// Filter parsing uses URLSearchParams so the page works without JS — filters
// survive a full page reload via the URL.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditAction } from '$lib/audit/types';

export type AuditFilters = {
	actorIds: string[];
	actions: AuditAction[];
	targetTypes: string[];
	fromIso: string | null; // ISO timestamp, inclusive lower bound
	toIso: string | null; // ISO timestamp, inclusive upper bound
	search: string | null; // free-text on reason / target_id
};

const DEFAULT_LIMIT = 200;

export function parseFilters(params: URLSearchParams): AuditFilters {
	const csv = (key: string) =>
		(params.get(key) ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

	return {
		actorIds: csv('actor'),
		actions: csv('action') as AuditAction[],
		targetTypes: csv('target'),
		fromIso: params.get('from') || null,
		toIso: params.get('to') || null,
		search: params.get('q')?.trim() || null
	};
}

export function serializeFilters(f: Partial<AuditFilters>): URLSearchParams {
	const out = new URLSearchParams();
	if (f.actorIds?.length) out.set('actor', f.actorIds.join(','));
	if (f.actions?.length) out.set('action', f.actions.join(','));
	if (f.targetTypes?.length) out.set('target', f.targetTypes.join(','));
	if (f.fromIso) out.set('from', f.fromIso);
	if (f.toIso) out.set('to', f.toIso);
	if (f.search) out.set('q', f.search);
	return out;
}

export function isEmpty(f: AuditFilters): boolean {
	return (
		f.actorIds.length === 0 &&
		f.actions.length === 0 &&
		f.targetTypes.length === 0 &&
		!f.fromIso &&
		!f.toIso &&
		!f.search
	);
}

// Default range: "today" in local-server timezone start-of-day → now.
// Server runs in UTC by default, but `at` is timestamptz so the comparison is
// correct regardless. We anchor "today" to the host's local clock.
export function defaultTodayRange(now = new Date()): { fromIso: string; toIso: string } {
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	return { fromIso: start.toISOString(), toIso: now.toISOString() };
}

// ─── DB row shape returned by the listing query ──────────────────────────────
// We hand-write this rather than reuse `AuditLog` because we join the actor's
// profile row to get name + role for display.
export type AuditRowWithActor = {
	id: string; // bigint as string for JSON-safety
	at: string;
	actor_id: string | null;
	actor_role: 'super_admin' | 'judge' | 'viewer' | null;
	actor: { full_name: string; role: 'super_admin' | 'judge' | 'viewer'; email?: string } | null;
	actor_ip: string | null;
	actor_ua: string | null;
	action: AuditAction;
	target_type: string | null;
	target_id: string | null;
	before_json: Record<string, unknown> | null;
	after_json: Record<string, unknown> | null;
	reason: string | null;
};

// Applies the parsed filters to a Supabase query builder.
// Returned builder is still chainable (order/limit happen at the call site).
// We accept `any` here because supabase-js generic signatures change between
// minor versions and the cost of fighting them in TS is not worth the safety
// gain for an internal helper. Callers re-narrow at the await site.
function applyFilters<T>(builder: T, f: AuditFilters): T {
	let q: any = builder;
	if (f.actorIds.length) q = q.in('actor_id', f.actorIds);
	if (f.actions.length) q = q.in('action', f.actions);
	if (f.targetTypes.length) q = q.in('target_type', f.targetTypes);
	if (f.fromIso) q = q.gte('at', f.fromIso);
	if (f.toIso) q = q.lte('at', f.toIso);
	if (f.search) {
		// reason ILIKE %term% OR target_id ILIKE %term% — Supabase .or syntax.
		// Strip comma/paren so a stray "(" doesn't blow up the OR parser.
		const safe = f.search.replace(/[,()]/g, ' ');
		q = q.or(`reason.ilike.%${safe}%,target_id.ilike.%${safe}%`);
	}
	return q as T;
}

// Fetch a page of audit rows with the actor profile joined.
export async function fetchAuditPage(
	supabase: SupabaseClient,
	f: AuditFilters,
	limit = DEFAULT_LIMIT
): Promise<{ rows: AuditRowWithActor[]; error: string | null }> {
	const base = supabase
		.from('audit_log')
		.select(
			'id, at, actor_id, actor_role, actor_ip, actor_ua, action, target_type, target_id, before_json, after_json, reason, actor:profiles!audit_log_actor_id_fkey(full_name, role)'
		);

	const { data, error } = await applyFilters(base, f)
		.order('at', { ascending: false })
		.limit(limit);

	if (error) {
		return { rows: [], error: error.message };
	}

	// Supabase returns the joined `actor` as either an object or a one-element
	// array depending on relationship inference; normalise to object|null.
	const rows: AuditRowWithActor[] = (data ?? []).map((r: any) => ({
		...r,
		id: String(r.id),
		actor: Array.isArray(r.actor) ? (r.actor[0] ?? null) : (r.actor ?? null)
	}));

	return { rows, error: null };
}

// Stream-friendly fetch for CSV export. Pulls in pages of `pageSize` rows so a
// 10k-row export doesn't try to allocate one giant array in JS memory upfront.
//
// Yields one row at a time via an async generator.
//
// Keyset pagination on (at DESC, id DESC) — every page asks for rows strictly
// "older" than the last row of the previous page in lexicographic (at, id)
// order. This avoids both re-yielding rows that share an exact `at` value
// (multiple audit rows from one transaction) and the classic OFFSET drift
// when new rows arrive mid-export.
export async function* streamAuditRows(
	supabase: SupabaseClient,
	f: AuditFilters,
	pageSize = 500
): AsyncGenerator<AuditRowWithActor> {
	let cursorAt: string | null = f.toIso;
	let cursorId: string | null = null; // bigserial returned as string

	while (true) {
		const base = supabase
			.from('audit_log')
			.select(
				'id, at, actor_id, actor_role, actor_ip, actor_ua, action, target_type, target_id, before_json, after_json, reason, actor:profiles!audit_log_actor_id_fkey(full_name, role, email)'
			);

		let q: any = applyFilters(base, { ...f, toIso: cursorAt });
		if (cursorId !== null) {
			// Within the same `at` we step strictly past the last id we yielded.
			// Outside that tied bucket, the existing `lte('at', cursorAt)` already
			// covers older timestamps.
			q = q.or(`at.lt.${cursorAt},and(at.eq.${cursorAt},id.lt.${cursorId})`);
		}

		const { data, error } = await q
			.order('at', { ascending: false })
			.order('id', { ascending: false })
			.limit(pageSize);

		if (error) throw new Error(error.message);
		if (!data || data.length === 0) return;

		for (const r of data) {
			yield {
				...r,
				id: String(r.id),
				actor: Array.isArray(r.actor) ? (r.actor[0] ?? null) : (r.actor ?? null)
			};
		}

		if (data.length < pageSize) return;
		const last = data[data.length - 1];
		cursorAt = last.at;
		cursorId = String(last.id);
	}
}

export const DEFAULT_AUDIT_LIMIT = DEFAULT_LIMIT;
