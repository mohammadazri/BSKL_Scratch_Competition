// Root index — route by role. Unauthenticated users go to /login.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const { data, error } = await supabaseAdmin
		.from('profiles')
		.select('role, is_active')
		.eq('id', locals.user.id)
		.single();

	console.log(`[/] user=${locals.user.id} profile=${JSON.stringify(data)} error=${error?.message ?? 'none'}`);

	if (!data || !data.is_active) throw redirect(303, '/login');
	if (data.role === 'super_admin') throw redirect(303, '/admin');
	if (data.role === 'judge') throw redirect(303, '/judge');
	if (data.role === 'viewer') throw redirect(303, '/viewer');
	throw redirect(303, '/login');
};
