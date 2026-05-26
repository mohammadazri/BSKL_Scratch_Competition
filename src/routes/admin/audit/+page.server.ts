// /admin/audit — super_admin view of the full audit log.
// Storage moved to the Pi (migration 013). Role guard runs in the parent
// /admin layout (super_admin only).

import type { PageServerLoad } from './$types';
import { loadAuditPage } from '$lib/audit/loader';

export const load: PageServerLoad = async ({ locals, url }) => {
	return loadAuditPage(url, 'super_admin', locals.user?.id ?? null);
};
