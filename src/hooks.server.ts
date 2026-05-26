// Per-request server hook: attach a request-scoped Supabase client to event.locals,
// resolve session + user safely, expose them to page data via locals, and add
// hardening security headers to every response.

import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// @supabase/auth-js 2.106+ logs a long, scary warning every time you touch
// `session.user` from a session that wasn't first validated via getUser().
// In safeGetSession() below we DO validate immediately after — but the
// warning fires on the read inside the original getSession() destructure,
// so it spams the log on every request. Filter it out once at module load.
const _origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
	if (typeof args[0] === 'string' && args[0].includes('Using the user object as returned from supabase.auth.getSession()')) {
		return;
	}
	_origWarn(...args);
};

const supabaseHandle: Handle = async ({ event, resolve }) => {
	// Detect HTTPS via X-Forwarded-Proto only. SvelteKit's adapter-node
	// defaults `event.url.protocol` to `https:` regardless of the real
	// request scheme, so it can't be trusted. Cloudflare tunnel sets
	// `x-forwarded-proto: https`; direct LAN HTTP requests don't.
	const isHttps = event.request.headers.get('x-forwarded-proto') === 'https';

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				cookies.forEach(({ name, value, options }) => {
					// Force secure=false on plain HTTP — browsers reject Secure
					// cookies over HTTP and the session is lost on the next request.
					event.cookies.set(name, value, {
						...options,
						path: '/',
						secure: isHttps,
						sameSite: 'lax',
						httpOnly: true
					});
				});
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		// Validate the JWT against the auth server — getSession() trusts the cookie blindly,
		// getUser() re-checks with Supabase. This is the secure pattern.
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };

		return { session, user };
	};

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

// Hardening security headers. CSP itself is configured via svelte.config.js
// so SvelteKit can auto-nonce its inline bootstrap script.
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// CSP is configured via svelte.config.js so SvelteKit can auto-nonce its
	// own inline bootstrap script — setting it here would override that.
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// Only set HSTS when the request was actually over HTTPS (Cloudflare tunnel).
	// Sending it on plain HTTP poisons the browser for direct LAN access.
	if (event.request.headers.get('x-forwarded-proto') === 'https') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
	);
	// Cross-origin isolation for the app frame — we never need to be embedded
	// elsewhere and never embed third-party iframes.
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	return response;
};

export const handle: Handle = sequence(supabaseHandle, securityHeaders);
