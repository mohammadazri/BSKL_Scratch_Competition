// Canonical public URL of the deployed app.
//
// SvelteKit's `url.origin` reflects whatever Host header the request arrived
// with — so a /forgot-password POST from the dev server (localhost:5173) or
// the Tailscale IP (100.x.y.z:5173) would put THAT origin into the
// Supabase reset email, sending judges to a URL they can't reach.
//
// This helper reads `PUBLIC_APP_URL` from the environment so every email
// link points at the production domain regardless of where the request came
// from. Set it in `.env`:
//
//     PUBLIC_APP_URL=https://p3.sentrizk.me
//
// Falls back to `url.origin` only if the env var is unset (dev convenience).
// In production, ALSO add the same URL to Supabase Dashboard →
// Authentication → URL Configuration → Site URL (and Redirect URLs).

import { env as publicEnv } from '$env/dynamic/public';

export function appUrl(requestOrigin: string): string {
	const configured = publicEnv.PUBLIC_APP_URL?.trim();
	if (configured) {
		return configured.replace(/\/+$/, '');
	}
	return requestOrigin;
}
