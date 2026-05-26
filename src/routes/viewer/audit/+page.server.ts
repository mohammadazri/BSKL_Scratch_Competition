// /viewer/audit — read-only audit log for viewers (principals, sponsors).
// Role guard runs in src/routes/viewer/+layout.server.ts. Storage moved to
// the Pi (migration 013).

import type { PageServerLoad } from './$types';
import { loadAuditPage } from '$lib/audit/loader';

export const load: PageServerLoad = async ({ locals, url }) => {
	return loadAuditPage(url, 'viewer', locals.user?.id ?? null);
};
