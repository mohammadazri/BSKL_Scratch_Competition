// Per-request server hook: attach a request-scoped Supabase client to event.locals,
// resolve session + user safely, expose them to page data via locals, and add
// hardening security headers to every response.

import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	// Detect HTTPS — either direct or behind the Cloudflare tunnel (which
	// terminates TLS and forwards HTTP to localhost with X-Forwarded-Proto).
	const isHttps =
		event.url.protocol === 'https:' ||
		event.request.headers.get('x-forwarded-proto') === 'https';

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				cookies.forEach(({ name, value, options }) => {
					// Strip `secure` flag on plain-HTTP requests (LAN testing on
					// the Pi at http://<ip>:5999) — otherwise browsers reject
					// the Supabase session cookie and login appears to silently
					// fail. Over HTTPS the flag stays on as required.
					console.log(`[cookie] set ${name} secure=${isHttps} protocol=${event.url.protocol} xfp=${event.request.headers.get('x-forwarded-proto')}`);
					event.cookies.set(name, value, { ...options, path: '/', secure: isHttps });
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

/**
 * Append hardening security headers to every response.
 *
 *  - Content-Security-Policy: strict-ish — same-origin scripts/styles plus the
 *    Supabase project endpoint for fetch/websocket (realtime). Inline styles
 *    are allowed because Svelte 5 + Tailwind v4 inject scoped styles per
 *    component; inline scripts are NOT allowed.
 *  - X-Frame-Options DENY: defence-in-depth against clickjacking. CSP
 *    frame-ancestors covers modern browsers; XFO keeps older ones safe.
 *  - X-Content-Type-Options nosniff: prevents MIME-type confusion (e.g. an
 *    uploaded CSV being interpreted as HTML by older IE/Edge).
 *  - Referrer-Policy strict-origin-when-cross-origin: don't leak the full
 *    URL (including query strings like ?next=, ?actor=) to third parties.
 *  - Strict-Transport-Security: Cloudflare already adds this at the edge but
 *    re-asserting at the origin protects direct LAN access and is harmless.
 *  - Permissions-Policy: disable camera/mic/geolocation/payment which the
 *    app never uses.
 *
 * The Supabase URL is read from $env/static/public so it lands in the CSP
 * connect-src list automatically.
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const supabaseOrigin = (() => {
		try {
			return new URL(PUBLIC_SUPABASE_URL).origin;
		} catch {
			return '';
		}
	})();

	const csp = [
		"default-src 'self'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"object-src 'none'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		// Svelte 5 + Tailwind v4 emit inline style attributes / scoped styles.
		// 'unsafe-inline' for styles is the standard SvelteKit recommendation;
		// XSS is mitigated by Svelte's automatic templating escapes (no @html).
		"style-src 'self' 'unsafe-inline'",
		// No inline scripts. SvelteKit emits hashed module scripts only.
		"script-src 'self'",
		`connect-src 'self' ${supabaseOrigin} wss://${supabaseOrigin.replace(/^https?:\/\//, '')}`.trim(),
		"manifest-src 'self'"
	].join('; ');

	response.headers.set('Content-Security-Policy', csp);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// Only set HSTS on HTTPS requests — sending it on the Pi's plain-HTTP LAN
	// endpoint can cache "this host wants HTTPS" in the browser and break
	// subsequent HTTP testing.
	if (
		event.url.protocol === 'https:' ||
		event.request.headers.get('x-forwarded-proto') === 'https'
	) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains'
		);
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
