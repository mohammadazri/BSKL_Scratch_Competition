// /viewer/audit — read-only audit log for viewers (principals, sponsors).
// Role guard runs in src/routes/viewer/+layout.server.ts (viewer or super_admin).
// RLS lets viewers SELECT all audit rows; we just don't render export/edit
// controls that they couldn't use.

import type { PageServerLoad } from './$types';
import { loadAuditPage } from '$lib/audit/loader';

export const load: PageServerLoad = async ({ locals, url }) => {
	return loadAuditPage(locals.supabase, url, 'viewer', locals.user?.id ?? null);
};
