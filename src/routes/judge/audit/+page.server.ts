// /judge/audit — optional, lets a judge review what THEY did.
//
// We do role gating inline rather than via a /judge/+layout.server.ts so we
// don't conflict with Track 3 which will install its own layout guard for the
// scoring form. When Track 3 lands, this inline check still works — it just
// runs after Track 3's layout guard.
//
// RLS restricts SELECT to rows where actor_id = auth.uid() via the
// `audit_log_judge_self_read` policy, so a judge naturally sees only their own.

import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/guards';
import { loadAuditPage } from '$lib/audit/loader';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await requireRole(
		locals.supabase,
		locals.user,
		['judge', 'super_admin'],
		url.pathname
	);

	const audit = await loadAuditPage(locals.supabase, url, 'judge', session.user.id);
	return audit;
};
