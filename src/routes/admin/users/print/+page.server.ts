// /admin/users/print — printable login slips for venue handout.
//
// Workflow: Mohammad selects a set of active users on this page, clicks
// "Generate slips" — the server resets each user's password to a fresh temp
// value (audit-logged as a password change) and returns the list with the
// plaintext passwords on the next render. He prints the page, hands out slips,
// and the plaintext is never persisted server-side.
//
// We do NOT store passwords. The only place a temp password is visible is
// the one-shot response right after generation.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { tempPassword } from '$lib/utils/random';
import type { Role } from '$lib/types';

export type UserOption = {
	id: string;
	email: string;
	fullName: string;
	role: Role;
	pinLabel: string | null;
	isActive: boolean;
};

export const load: PageServerLoad = async () => {
	const { data, error: dbErr } = await supabaseAdmin
		.from('profiles')
		.select('id, email, full_name, role, pin_label, is_active')
		.eq('is_active', true)
		.order('role', { ascending: true })
		.order('full_name', { ascending: true });

	if (dbErr) throw error(500, dbErr.message);

	const users: UserOption[] = (data ?? []).map((p) => ({
		id: p.id as string,
		email: p.email as string,
		fullName: p.full_name as string,
		role: p.role as Role,
		pinLabel: (p.pin_label as string | null) ?? null,
		isActive: p.is_active as boolean
	}));

	// Pull event meta for the slip header.
	const { data: ev } = await supabaseAdmin
		.from('event_state')
		.select('event_name, event_date')
		.eq('id', 1)
		.single();

	return {
		users,
		eventName: (ev?.event_name as string) ?? 'P3 Future Coders Challenge 2026',
		eventDate: (ev?.event_date as string | null) ?? null
	};
};

export const actions: Actions = {
	generate: async ({ request, url }) => {
		const form = await request.formData();
		const ids = form.getAll('ids').map((v) => String(v));
		if (ids.length === 0) {
			return fail(400, { error: 'Pick at least one user.' });
		}

		// Look up the chosen users' emails / names.
		const { data: users, error: lookupErr } = await supabaseAdmin
			.from('profiles')
			.select('id, email, full_name, role, pin_label')
			.in('id', ids);

		if (lookupErr || !users) return fail(500, { error: lookupErr?.message ?? 'lookup failed' });

		// Reset each user's password.
		const slips: {
			id: string;
			email: string;
			fullName: string;
			role: Role;
			pinLabel: string | null;
			password: string;
		}[] = [];
		const failures: string[] = [];

		for (const u of users) {
			const pw = tempPassword(10);
			const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(u.id as string, {
				password: pw
			});
			if (pwErr) {
				failures.push(`${u.email}: ${pwErr.message}`);
				continue;
			}
			slips.push({
				id: u.id as string,
				email: u.email as string,
				fullName: u.full_name as string,
				role: u.role as Role,
				pinLabel: (u.pin_label as string | null) ?? null,
				password: pw
			});
		}

		return {
			ok: true,
			slips,
			loginUrl: `${url.origin}/login`,
			error: failures.length ? `Some users failed: ${failures.join('; ')}` : null
		};
	}
};
