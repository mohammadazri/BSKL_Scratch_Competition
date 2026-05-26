// /login — Supabase auth: password + magic link.
// If a user already has a session, redirect them to their role's home.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { safeNextPath } from '$lib/server/guards';
import { appUrl } from '$lib/app-url';

type HomeResult =
	| { kind: 'redirect'; to: string }
	| { kind: 'signout'; message: string };

async function homeForUserId(userId: string): Promise<HomeResult> {
	const { data } = await supabaseAdmin
		.from('profiles')
		.select('role, is_active')
		.eq('id', userId)
		.single();

	// No profile or disabled account → sign them out so they don't get stuck
	// in a redirect loop where /login keeps bouncing them somewhere broken.
	if (!data) return { kind: 'signout', message: 'Profile not found.' };
	if (!data.is_active) return { kind: 'signout', message: 'Account is disabled.' };

	if (data.role === 'super_admin') return { kind: 'redirect', to: '/admin' };
	if (data.role === 'judge') return { kind: 'redirect', to: '/judge' };
	if (data.role === 'viewer') return { kind: 'redirect', to: '/viewer' };
	if (data.role === 'registration_committee') return { kind: 'redirect', to: '/registration' };

	return { kind: 'signout', message: 'Unknown role.' };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		const home = await homeForUserId(locals.user.id);
		if (home.kind === 'signout') {
			// Tear down the session BEFORE re-rendering /login so we never loop.
			await locals.supabase.auth.signOut();
			return {
				next: url.searchParams.get('next') ?? null,
				flash: home.message
			};
		}
		throw redirect(303, home.to);
	}
	return {
		next: url.searchParams.get('next') ?? null,
		flash: url.searchParams.get('error') === 'account-disabled' ? 'Account is disabled.' : null
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

		// SECURITY: `safeNextPath` rejects protocol-relative URLs (//evil.com)
		// and any other open-redirect tricks. A bare `startsWith('/')` is not
		// enough — `//evil.com/x` also starts with `/`.
		const next = safeNextPath(url.searchParams.get('next'));
		if (next) throw redirect(303, next);

		const home = await homeForUserId(data.user.id);
		if (home.kind === 'signout') {
			await locals.supabase.auth.signOut();
			return fail(403, { error: home.message, email });
		}
		throw redirect(303, home.to);
	},

	magic: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) {
			return fail(400, { error: 'Email is required for a magic link.', email });
		}
		// Use the configured PUBLIC_APP_URL (production domain) so the magic
		// link in the email points at https://p3.sentrizk.me even when
		// the request came from dev/Tailscale.
		const redirectTo = `${appUrl(url.origin)}/auth/callback`;
		// Fire and forget. We DELIBERATELY ignore the result — surfacing the real
		// error (e.g. "Signups not allowed for otp" when the email isn't a known
		// user) would let an attacker probe which emails are registered judges.
		// `signInWithOtp` with public signups disabled = no-op for unknown emails,
		// magic link for known ones. Either way, same generic success message.
		await locals.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
		});
		return {
			info: `If an account exists for ${email}, a magic link has been sent. Check your inbox (and spam folder).`,
			email
		};
	}
};
