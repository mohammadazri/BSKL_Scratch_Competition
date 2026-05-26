// /judge/audit — lets a judge review what THEY did.
// Storage moved to the Pi (migration 013). The local module restricts
// non-admins to actor_id = current user, so we pass it down explicitly.

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

	return loadAuditPage(url, 'judge', session.user.id);
};
