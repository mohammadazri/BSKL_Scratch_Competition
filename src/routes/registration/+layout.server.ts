// Guard for everything under /registration — registration_committee OR
// super_admin can enter. Mirrors the /admin layout guard pattern.

import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/guards';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = await requireRole(
		locals.supabase,
		locals.user,
		['registration_committee', 'super_admin'],
		url.pathname
	);

	const { data: profile, error } = await locals.supabase
		.from('profiles')
		.select('id, email, full_name, role')
		.eq('id', locals.user!.id)
		.single();

	if (error || !profile) {
		throw redirect(303, '/login?error=profile-not-found');
	}

	return {
		session,
		profile: {
			id: profile.id as string,
			email: profile.email as string,
			fullName: profile.full_name as string,
			role: profile.role as 'super_admin' | 'registration_committee'
		}
	};
};
