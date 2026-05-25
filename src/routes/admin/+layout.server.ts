// Guard for everything under /admin — super_admin only.
// Loads the current user's profile row (camelCase-mapped) so the layout can
// render <AppShell> with the user chip and the role-aware sidebar nav.

import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/guards';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = await requireRole(
		locals.supabase,
		locals.user,
		['super_admin'],
		url.pathname
	);

	const { data: profile, error } = await locals.supabase
		.from('profiles')
		.select('id, email, full_name, role, categories, is_active')
		.eq('id', locals.user!.id)
		.single();

	if (error || !profile) {
		throw redirect(303, '/login?error=profile-not-found');
	}

	return {
		session,
		profile: {
			id: profile.id,
			email: profile.email,
			fullName: profile.full_name,
			role: profile.role,
			categories: profile.categories,
			isActive: profile.is_active
		}
	};
};
