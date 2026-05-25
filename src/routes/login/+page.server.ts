// /login — Supabase auth: password + magic link.
// If a user already has a session, redirect them to their role's home.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

async function homeForUserId(userId: string): Promise<string> {
	const { data } = await supabaseAdmin
		.from('profiles')
		.select('role, is_active')
		.eq('id', userId)
		.single();
	if (!data || !data.is_active) return '/';
	if (data.role === 'super_admin') return '/admin';
	if (data.role === 'judge') return '/judge';
	if (data.role === 'viewer') return '/viewer';
	return '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		const dest = await homeForUserId(locals.user.id);
		throw redirect(303, dest);
	}
	return {
		next: url.searchParams.get('next') ?? null
	};
};

export const actions: Actions = {
	password: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const { data, error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error || !data.user) {
			return fail(400, { error: error?.message ?? 'Invalid email or password.', email });
		}

		const next = url.searchParams.get('next');
		const dest = next && next.startsWith('/') ? next : await homeForUserId(data.user.id);
		throw redirect(303, dest);
	},

	magic: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) {
			return fail(400, { error: 'Email is required for a magic link.', email });
		}
		const redirectTo = `${url.origin}/auth/callback`;
		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: redirectTo }
		});
		if (error) {
			return fail(400, { error: error.message, email });
		}
		return {
			info: `Magic link sent to ${email}. Check your inbox.`,
			email
		};
	}
};
