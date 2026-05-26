// Server-side loader shared between /admin/audit, /viewer/audit, /judge/audit.
//
// Storage moved off Supabase in migration 013 — audit events now live in a
// JSON Lines file on the Pi. Reads go through `$lib/server/audit-local`.
//
// Per-role visibility (used to be RLS):
//   • super_admin + viewer:        full read
//   • judge / registration_committee: only their own actions
//
// The filter parsing/serialisation lives in `$lib/audit/query` and is shared
// with the client-side <FilterBar>.

import { parseFilters, DEFAULT_AUDIT_LIMIT, type AuditRowWithActor } from './query';
import { fetchAuditPage, distinctActors } from '$lib/server/audit-local';
import type { Role } from '$lib/types';

export interface ActorOption {
	id: string;
	label: string;
}

export interface AuditPageData {
	rows: AuditRowWithActor[];
	truncated: boolean;
	limit: number;
	loadError: string | null;
	filters: ReturnType<typeof parseFilters>;
	actorOptions: ActorOption[];
	role: Role;
	currentUserId: string | null;
	subscribeKey: string;
}

export async function loadAuditPage(
	url: URL,
	role: Role,
	currentUserId: string | null
): Promise<AuditPageData> {
	const filters = parseFilters(url.searchParams);

	// Non-admins only see their own actions.
	const restrict = role === 'super_admin' || role === 'viewer' ? null : currentUserId;

	const { rows, error } = await fetchAuditPage(filters, DEFAULT_AUDIT_LIMIT, restrict);

	// Actor dropdown: distinct actors observed in the log. For judges and
	// registration_committee it's a one-item list (themselves), so we hide it.
	let actorOptions: ActorOption[] = [];
	if (role === 'super_admin' || role === 'viewer') {
		const actors = await distinctActors();
		actorOptions = actors.map((a) => ({
			id: a.id,
			label: `${a.fullName} (${a.role ?? 'unknown'})`
		}));
	}

	return {
		rows,
		truncated: rows.length >= DEFAULT_AUDIT_LIMIT,
		limit: DEFAULT_AUDIT_LIMIT,
		loadError: error,
		filters,
		actorOptions,
		role,
		currentUserId,
		subscribeKey: url.search
	};
}
