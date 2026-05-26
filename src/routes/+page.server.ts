// Root index — route by role. Unauthenticated users go to /login.
// IMPORTANT: any "I don't know what to do with this user" path here MUST go
// to /login?error=... so the login load can sign the broken session out and
// show a normal form. Sending an unauthenticated-equivalent state back to
// /login without clearing cookies creates an infinite redirect loop.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const { data } = await supabaseAdmin
		.from('profiles')
		.select('role, is_active')
		.eq('id', locals.user.id)
		.single();

	if (!data) throw redirect(303, '/login?error=account-disabled');
	if (!data.is_active) throw redirect(303, '/login?error=account-disabled');
	if (data.role === 'super_admin') throw redirect(303, '/admin');
	if (data.role === 'judge') throw redirect(303, '/judge');
	if (data.role === 'viewer') throw redirect(303, '/viewer');
	if (data.role === 'registration_committee') throw redirect(303, '/registration');
	throw redirect(303, '/login?error=unknown-role');
};
