// Server-side loader shared between /admin/audit, /viewer/audit, /judge/audit.
//
// The only difference between roles is:
//   • Who can SELECT which rows (handled by RLS, not here).
//   • Whether the actor filter dropdown shows other people (judge only sees
//     their own actions, so no point listing other actors).
//
// All three pages call this loader; RLS does the rest.

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAuditPage, parseFilters, DEFAULT_AUDIT_LIMIT } from './query';
import type { Role } from '$lib/types';

export interface ActorOption {
	id: string;
	label: string;
}

export interface AuditPageData {
	rows: Awaited<ReturnType<typeof fetchAuditPage>>['rows'];
	truncated: boolean;
	limit: number;
	loadError: string | null;
	filters: ReturnType<typeof parseFilters>;
	actorOptions: ActorOption[];
	role: Role;
	currentUserId: string | null;
	subscribeKey: string; // bumps when filters change so the client re-subscribes
}

export async function loadAuditPage(
	supabase: SupabaseClient,
	url: URL,
	role: Role,
	currentUserId: string | null
): Promise<AuditPageData> {
	const filters = parseFilters(url.searchParams);
	const { rows, error } = await fetchAuditPage(supabase, filters, DEFAULT_AUDIT_LIMIT);

	// Actor list: empty for judge (they see one actor, themselves — pointless).
	// For super_admin and viewer, populate from profiles. RLS allows both to
	// SELECT all profiles, so this just works.
	let actorOptions: ActorOption[] = [];
	if (role === 'super_admin' || role === 'viewer') {
		const { data: profs } = await supabase
			.from('profiles')
			.select('id, full_name, role')
			.eq('is_active', true)
			.order('full_name', { ascending: true });
		actorOptions = (profs ?? []).map((p: any) => ({
			id: p.id,
			label: `${p.full_name} (${p.role})`
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
		subscribeKey: url.search // identifies the current filter set
	};
}
