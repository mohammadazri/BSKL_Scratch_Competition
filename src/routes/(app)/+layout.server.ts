// (app) group guard — every page inside requires an authenticated user.
// Resolves the profile once and forwards it to nested loads via parent().
// Per-role gating is layered on in nested `+layout.server.ts` files
// (e.g. (app)/admin/+layout.server.ts checks role === 'super_admin').

import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	}

	const { data: profile, error: profileErr } = await locals.supabase
		.from('profiles')
		.select('id, email, full_name, role, is_active, categories')
		.eq('id', locals.user.id)
		.single();

	if (profileErr || !profile) {
		throw error(403, 'No profile found for this account.');
	}
	if (!profile.is_active) {
		throw error(403, 'Your account is disabled. Contact the event admin.');
	}

	return {
		profile: {
			id: profile.id as string,
			email: profile.email as string,
			fullName: profile.full_name as string,
			role: profile.role as 'super_admin' | 'judge' | 'viewer',
			categories: (profile.categories ?? []) as ('A' | 'B' | 'C')[]
		}
	};
};
