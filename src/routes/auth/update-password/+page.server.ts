// /auth/update-password — set a new password after a recovery flow.
//
// Reached via the email link → /auth/callback → here. The callback has already
// exchanged the recovery code for a session, so `locals.user` must be set.
// If it isn't (link expired, token reused, direct visit), bounce to /login.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { appendAudit } from '$lib/server/audit-local';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login?error=reset_link_expired');
	}
	return { email: locals.user.email ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		if (!locals.user) {
			throw redirect(303, '/login?error=reset_link_expired');
		}

		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		// SECURITY: 10-char minimum matches our generated temp passwords. Cap
		// at 72 chars because bcrypt (Supabase's hasher) silently truncates at
		// 72 bytes, which would let an attacker brute-force a long-password
		// account by submitting only the first 72 bytes.
		if (password.length < 10) {
			return fail(400, { error: 'Password must be at least 10 characters.' });
		}
		if (password.length > 72) {
			return fail(400, { error: 'Password must be 72 characters or fewer.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) {
			return fail(400, { error: error.message });
		}

		// A self-service password reset counts as "first login completed" — if
		// the must-change-password flag was set, clear it so the user doesn't
		// also get bounced to /auth/change-password on next sign-in.
		const userId = locals.user.id;
		const userEmail = locals.user.email ?? null;
		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('full_name, role')
			.eq('id', userId)
			.single();

		await supabaseAdmin
			.from('profiles')
			.update({ must_change_password: false })
			.eq('id', userId);

		await appendAudit({
			actor: {
				id: userId,
				role: (profile?.role as 'super_admin' | 'judge' | 'viewer' | null) ?? null,
				fullName: (profile?.full_name as string) ?? null,
				email: userEmail
			},
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_update',
			targetType: 'user',
			targetId: userId,
			before: null,
			after: { password_changed: true, via: 'forgot-password' },
			reason: 'Self-service password reset.'
		});

		// Sign out so the recovery session can't be reused. Force a clean
		// sign-in with the new password.
		await locals.supabase.auth.signOut();
		throw redirect(303, '/login?info=password_updated');
	}
};
