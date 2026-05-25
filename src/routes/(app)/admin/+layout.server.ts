// /admin/** guard — restricts the entire admin section to super_admin.
// The parent (app)/+layout.server.ts has already loaded the profile and
// confirmed the user is authenticated + active.

import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	if (profile.role !== 'super_admin') {
		throw error(403, 'Admin area is for super admins only.');
	}
	return {};
};
