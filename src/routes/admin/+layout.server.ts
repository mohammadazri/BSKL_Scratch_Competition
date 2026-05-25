// Guard for everything under /admin — super_admin only.
//
// Track 2 owns most admin routes; we install a tiny top-level guard here so
// the /admin/audit subroute is protected even if Track 2 doesn't add anything
// stricter. If Track 2 needs to add per-page guards, it can layer them inside
// the relevant subdirectory.

import type { LayoutServerLoad } from './$types';
import { requireRole } from '$lib/server/guards';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = await requireRole(
		locals.supabase,
		locals.user,
		['super_admin'],
		url.pathname
	);

	return { session };
};
