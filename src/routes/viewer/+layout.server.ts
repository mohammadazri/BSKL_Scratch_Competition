// Guard for everything under /viewer.
// Allowed roles: viewer (the primary occupant) AND super_admin (always allowed
// everywhere — a super_admin can drop into the viewer view without re-login).
//
// Shared with Track 5 (results, leaderboard). If Track 5 wants different
// allowed roles for a subroute, it can layer its own +layout.server.ts further
// down — this top-level guard sets the minimum bar.

import type { LayoutServerLoad } from './$types';
import { requireRole } from '$lib/server/guards';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = await requireRole(
		locals.supabase,
		locals.user,
		['viewer', 'super_admin'],
		url.pathname
	);

	return { session };
};
