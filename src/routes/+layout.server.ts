// Root layout server load — surfaces session + user to every page.
// Per-route guards (e.g. /judge, /admin) are layered on top.

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		session: locals.session,
		user: locals.user
	};
};
