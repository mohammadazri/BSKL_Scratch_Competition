// /admin/users/print — generates a printable A4 sheet of login slips for
// every active judge + viewer. Passwords are NOT stored in the DB; this page
// supports two modes:
//   (a) After resetting passwords, the caller can stash the latest password
//       for each user in a session cookie (not implemented here — out of scope).
//   (b) Generate fresh temporary passwords on the fly (super_admin can do
//       this from /admin/users via "Reset password" → reload print page).
//
// For the printable view we generate ephemeral placeholders by default; the
// real workflow is: on /admin/users click Reset → password shown inline →
// admin types it onto the printable slip OR copies via the "Print after reset"
// flow. For Track 2 we render the page with the active users + a "regenerate"
// button that batch-resets and prints in one go.

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { tempPassword } from '$lib/utils/random';
import type { Category, Role } from '$lib/types';

export type PrintSlip = {
	id: string;
	email: string;
	fullName: string;
	role: Role;
	categories: Category[];
	pinLabel: string | null;
	/** Plain-text password only present after the regenerate action runs. */
	password: string;
};

export const load: PageServerLoad = async () => {
	// On initial load we show a "click to generate" pre-print screen — we
	// don't auto-reset every active user just because someone navigated here.
	const { data: rows } = await supabaseAdmin
		.from('profiles')
		.select('id, email, full_name, role, categories, pin_label')
		.eq('is_active', true)
		.in('role', ['judge', 'viewer'])
		.order('role')
		.order('full_name');

	const { data: ev } = await supabaseAdmin
		.from('event_state')
		.select('event_name, event_date')
		.eq('id', 1)
		.single();

	return {
		users: (rows ?? []).map((r) => ({
			id: r.id as string,
			email: r.email as string,
			fullName: r.full_name as string,
			role: r.role as Role,
			categories: (r.categories ?? []) as Category[],
			pinLabel: (r.pin_label as string | null) ?? null
		})),
		event: {
			eventName: ev?.event_name as string | undefined,
			eventDate: (ev?.event_date as string | null) ?? null
		},
		slips: null as PrintSlip[] | null
	};
};

export const actions: Actions = {
	regenerate: async ({ request }) => {
		const form = await request.formData();
		const ids = form.getAll('id').map((v) => String(v));
		if (ids.length === 0) return fail(400, { error: 'No users selected.' });

		const { data: rows } = await supabaseAdmin
			.from('profiles')
			.select('id, email, full_name, role, categories, pin_label')
			.in('id', ids);

		const slips: PrintSlip[] = [];
		for (const r of rows ?? []) {
			const password = tempPassword(10);
			const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(r.id as string, {
				password
			});
			if (pwErr) {
				return fail(500, { error: `Failed to reset ${r.email}: ${pwErr.message}` });
			}
			slips.push({
				id: r.id as string,
				email: r.email as string,
				fullName: r.full_name as string,
				role: r.role as Role,
				categories: (r.categories ?? []) as Category[],
				pinLabel: (r.pin_label as string | null) ?? null,
				password
			});
		}

		return { ok: true, slips, count: slips.length };
	}
};
