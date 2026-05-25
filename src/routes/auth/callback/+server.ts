// Magic-link callback. Supabase redirects here with ?code=... ; we exchange
// it for a session and route the user to their role's home.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next');
	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (error) {
			throw redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
		}
	}

	const { user } = await locals.safeGetSession();
	if (!user) throw redirect(303, '/login');

	if (next && next.startsWith('/')) throw redirect(303, next);

	const { data } = await supabaseAdmin
		.from('profiles')
		.select('role, is_active')
		.eq('id', user.id)
		.single();
	if (!data || !data.is_active) throw redirect(303, '/');
	if (data.role === 'super_admin') throw redirect(303, '/admin');
	if (data.role === 'judge') throw redirect(303, '/judge');
	if (data.role === 'viewer') throw redirect(303, '/viewer');
	throw redirect(303, '/');
};
