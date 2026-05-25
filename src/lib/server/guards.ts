// Role guards used by +layout.server.ts files across the app.
//
// We do two checks:
//   1. Is the request authenticated at all? If not -> redirect to /login.
//   2. Does the user's profile.role belong to the allowed set? If not -> 403.
//
// RLS still enforces row-level access in the DB, but page-level role gating
// gives the user a clean redirect instead of an empty table.
//
// These helpers are shared so multiple tracks can wire the same guard.

import { redirect, error } from '@sveltejs/kit';
import type { Role } from '$lib/types';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface GuardedSession {
	user: User;
	role: Role;
	fullName: string;
	email: string;
}

export async function requireRole(
	supabase: SupabaseClient,
	user: User | null,
	allowed: Role[],
	urlPath: string
): Promise<GuardedSession> {
	if (!user) {
		throw redirect(303, `/login?redirectTo=${encodeURIComponent(urlPath)}`);
	}

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('role, full_name, email, is_active')
		.eq('id', user.id)
		.single();

	if (profileError || !profile) {
		throw error(403, 'Profile not found — contact the event admin.');
	}

	if (!profile.is_active) {
		throw error(403, 'Account is disabled.');
	}

	const role = profile.role as Role;
	if (!allowed.includes(role)) {
		throw error(403, `This page requires one of: ${allowed.join(', ')}.`);
	}

	return {
		user,
		role,
		fullName: profile.full_name,
		email: profile.email
	};
}
