// Root layout server load — surfaces session + user to every page and
// enforces the "must change password" gate so users with a temp password
// can't reach anything else until they pick a new one.

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

// Paths exempted from the must-change-password gate so users can actually
// get to the change-password page and out of it via logout.
const EXEMPT = new Set<string>(['/auth/change-password', '/logout', '/login']);

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (locals.user && !EXEMPT.has(url.pathname)) {
		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('must_change_password')
			.eq('id', locals.user.id)
			.single();
		if (profile?.must_change_password) {
			throw redirect(303, '/auth/change-password');
		}
	}

	return {
		session: locals.session,
		user: locals.user
	};
};
