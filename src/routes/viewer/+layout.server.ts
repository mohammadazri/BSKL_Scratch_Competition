// Guard for everything under /viewer.
// Allowed roles: viewer (the primary occupant) AND super_admin (always
// allowed everywhere). Loads the user's profile once and forwards it to
// the +layout.svelte so the AppShell top bar can render their name/email.

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireRole } from '$lib/server/guards';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = await requireRole(
		locals.supabase,
		locals.user,
		['viewer', 'super_admin'],
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
			role: profile.role as 'viewer' | 'super_admin'
		}
	};
};
