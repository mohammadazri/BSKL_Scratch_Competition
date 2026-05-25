// Judge area access guard.
// All /judge/** routes require the requesting user to have role 'judge' or
// 'super_admin' (super_admin can be assigned scoring like any judge). Anyone
// else is bounced to /login.
//
// The user's profile (role, full_name) is loaded once here and forwarded to
// every page in the judge tree via $page.data.profile.

import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	}

	const { data: profile, error: profileErr } = await locals.supabase
		.from('profiles')
		.select('id, email, full_name, role, is_active')
		.eq('id', locals.user.id)
		.single();

	if (profileErr || !profile) {
		throw error(403, 'No profile found for this account.');
	}

	if (!profile.is_active) {
		throw error(403, 'Your account is disabled. Contact the event admin.');
	}

	if (profile.role !== 'judge' && profile.role !== 'super_admin') {
		throw error(403, 'Judge area is for judges and super admins only.');
	}

	return {
		profile: {
			id: profile.id as string,
			email: profile.email as string,
			fullName: profile.full_name as string,
			role: profile.role as 'judge' | 'super_admin'
		}
	};
};
