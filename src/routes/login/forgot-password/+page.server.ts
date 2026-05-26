// /login/forgot-password — request a password reset email.
//
// Privacy: we DO NOT reveal whether the email exists. Same success message
// whether or not the email is in auth.users — strangers can't probe for
// valid accounts via this endpoint.

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) {
			return fail(400, { error: 'Email is required.', email });
		}

		// After clicking the email link the user lands at /auth/callback with the
		// PKCE code; callback exchanges it for a session and forwards to
		// /auth/update-password where they pick a new password.
		const redirectTo = `${url.origin}/auth/callback?next=${encodeURIComponent('/auth/update-password')}`;

		// Ignore success/failure deliberately — never confirm whether the email
		// exists. Supabase returns no error for unknown emails by default anyway,
		// but we belt-and-suspender this.
		await locals.supabase.auth.resetPasswordForEmail(email, { redirectTo });

		return {
			info: `If an account exists for ${email}, a password reset link has been sent. Check your inbox (and spam folder).`,
			email,
			sent: true
		};
	}
};
