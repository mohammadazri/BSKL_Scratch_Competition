// /auth/change-password — the forced first-login password change page.
//
// Auth-gated (any logged-in user can land here); used as a redirect target
// from the root layout when `profiles.must_change_password` is true.
//
// We allow the user to set ANY password length >= 8. The bcrypt hashing
// itself happens server-side via the Supabase Admin API.

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { appendAudit } from '$lib/server/audit-local';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	}

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('full_name, role, must_change_password')
		.eq('id', locals.user.id)
		.single();

	return {
		fullName: (profile?.full_name as string) ?? locals.user.email ?? '',
		role: (profile?.role as string) ?? 'judge',
		mustChange: Boolean(profile?.must_change_password)
	};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		if (!locals.user) throw error(401, 'Sign in required.');

		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(locals.user.id, {
			password
		});
		if (pwErr) {
			return fail(400, { error: pwErr.message });
		}

		const { error: profErr } = await supabaseAdmin
			.from('profiles')
			.update({ must_change_password: false })
			.eq('id', locals.user.id);

		if (profErr) {
			return fail(500, { error: `Password changed but profile flag not cleared: ${profErr.message}` });
		}

		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('full_name, role, email')
			.eq('id', locals.user.id)
			.single();

		await appendAudit({
			actor: {
				id: locals.user.id,
				role: (profile?.role as 'super_admin' | 'judge' | 'viewer' | null) ?? null,
				fullName: (profile?.full_name as string) ?? null,
				email: (profile?.email as string) ?? locals.user.email ?? null
			},
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_update',
			targetType: 'user',
			targetId: locals.user.id,
			before: null,
			after: { password_changed: true },
			reason: 'First-login password change.'
		});

		// Redirect to their role-aware home. Unknown roles fall through to /
		// which routes them itself; / now handles every valid role and sends
		// anything broken to /login?error=... (no loops).
		const role = profile?.role as string | undefined;
		const dest =
			role === 'super_admin'
				? '/admin'
				: role === 'judge'
					? '/judge'
					: role === 'viewer'
						? '/viewer'
						: role === 'registration_committee'
							? '/registration'
							: '/';
		throw redirect(303, dest);
	}
};
