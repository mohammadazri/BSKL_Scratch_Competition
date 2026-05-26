// Root layout server load — surfaces session + user to every page and
// enforces the "must change password" gate so users with a temp password
// can't reach anything else until they pick a new one.

import { redirect, isRedirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

// Paths exempted from the must-change-password gate so users can actually
// reach the change-password page (and sign out / log back in).
// Prefixes must NOT end with `/` — matching is `=== p` OR startsWith(`p + '/'`).
const EXEMPT_PREFIXES = ['/auth', '/login', '/logout'];

function isExempt(pathname: string): boolean {
	return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (locals.user && !isExempt(url.pathname)) {
		try {
			const { data: profile, error } = await supabaseAdmin
				.from('profiles')
				.select('must_change_password')
				.eq('id', locals.user.id)
				.maybeSingle();
			// `maybeSingle()` returns `{ data: null, error: null }` for 0 rows,
			// which is fine. Any other error (network, missing column) we log
			// and skip the gate — failing open is better than locking everyone
			// out of every page if the column doesn't exist yet.
			if (error) {
				console.error('[layout] profile lookup failed:', error.message);
			} else if (profile?.must_change_password) {
				throw redirect(303, '/auth/change-password');
			}
		} catch (err) {
			// Re-throw redirects so SvelteKit handles them. Anything else gets
			// logged and swallowed — don't 500 the whole site over a gate check.
			if (isRedirect(err)) throw err;
			console.error('[layout] must-change-password gate threw:', err);
		}
	}

	return {
		session: locals.session,
		user: locals.user
	};
};
