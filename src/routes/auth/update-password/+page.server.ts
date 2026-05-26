// /auth/update-password — set a new password after a recovery flow.
//
// Reached via the email link → /auth/callback → here. The callback has already
// exchanged the recovery code for a session, so `locals.user` must be set.
// If it isn't (link expired, token reused, direct visit), bounce to /login.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?error=reset_link_expired');
	}
	return { email: locals.user.email ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login?error=reset_link_expired');
		}

		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) {
			return fail(400, { error: error.message });
		}

		// Sign out so the recovery session can't be reused. Force a clean
		// sign-in with the new password.
		await locals.supabase.auth.signOut();
		throw redirect(303, '/login?info=password_updated');
	}
};
