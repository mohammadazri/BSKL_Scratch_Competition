// Audit filter types + URL parsing/serialisation. Storage backend lives in
// `src/lib/server/audit-local.ts` (JSONL on the Pi). This module is shared
// by both server and client code — keep it dependency-free.

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

export function defaultTodayRange(now = new Date()): { fromIso: string; toIso: string } {
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	return { fromIso: start.toISOString(), toIso: now.toISOString() };
}

// ─── View row shape ──────────────────────────────────────────────────────────
// Returned by `fetchAuditPage` / `streamAuditRows` in `$lib/server/audit-local`.
// Kept identical to the old Supabase-joined shape so the UI components didn't
// need to change.
export type AuditRowWithActor = {
	id: string;
	at: string;
	actor_id: string | null;
	actor_role: 'super_admin' | 'judge' | 'viewer' | 'registration_committee' | null;
	actor: {
		full_name: string;
		role: 'super_admin' | 'judge' | 'viewer' | 'registration_committee';
		email?: string;
	} | null;
	actor_ip: string | null;
	actor_ua: string | null;
	action: AuditAction;
	target_type: string | null;
	target_id: string | null;
	before_json: Record<string, unknown> | null;
	after_json: Record<string, unknown> | null;
	reason: string | null;
};

export const DEFAULT_AUDIT_LIMIT = DEFAULT_LIMIT;
