// /admin/audit — super_admin view of the full audit log.
// Role guard runs in src/routes/admin/+layout.server.ts (super_admin only).
// RLS additionally guarantees super_admin sees everything.

import type { PageServerLoad } from './$types';
import { loadAuditPage } from '$lib/audit/loader';

export const load: PageServerLoad = async ({ locals, url }) => {
	return loadAuditPage(locals.supabase, url, 'super_admin', locals.user?.id ?? null);
};
