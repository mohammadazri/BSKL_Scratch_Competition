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
import QRCode from 'qrcode';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireSuperAdmin } from '$lib/server/guards';
import { tempPassword } from '$lib/utils/random';
import { appUrl } from '$lib/app-url';
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
	/** Inline SVG of the QR code that encodes the sign-in URL. */
	qrSvg: string;
};

async function svgQr(text: string): Promise<string> {
	// Solid white background, not transparent — printers commonly strip
	// transparent backgrounds under "save ink" mode and the QR ends up blank.
	return QRCode.toString(text, {
		type: 'svg',
		errorCorrectionLevel: 'M',
		margin: 1,
		color: { dark: '#0f172a', light: '#ffffff' }
	});
}

export const load: PageServerLoad = async ({ url }) => {
	// On initial load we show a "click to generate" pre-print screen — we
	// don't auto-reset every active user just because someone navigated here.
	// Include every non-admin role so the super_admin can also hand a slip
	// to registration_committee users they create. Super admins are excluded
	// because they're expected to set their own passwords during bootstrap
	// (scripts/seed-superadmin.ts).
	const { data: rows } = await supabaseAdmin
		.from('profiles')
		.select('id, email, full_name, role, categories, pin_label')
		.eq('is_active', true)
		.in('role', ['judge', 'viewer', 'registration_committee'])
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
		appUrl: appUrl(url.origin),
		slips: null as PrintSlip[] | null
	};
};

export const actions: Actions = {
	// SECURITY: regenerate calls supabaseAdmin.auth.admin.updateUserById which
	// can reset ANY user's password including super_admin accounts. The parent
	// layout guard does NOT run before form actions — without this inline check
	// any authenticated user could POST here and take over arbitrary accounts.
	regenerate: async ({ request, locals, url }) => {
		await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const ids = form.getAll('id').map((v) => String(v));
		if (ids.length === 0) return fail(400, { error: 'No users selected.' });

		const { data: rows } = await supabaseAdmin
			.from('profiles')
			.select('id, email, full_name, role, categories, pin_label')
			.in('id', ids);

		const signInUrl = `${appUrl(url.origin)}/login`;
		const qr = await svgQr(signInUrl);

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
				password,
				qrSvg: qr
			});
		}

		return { ok: true, slips, count: slips.length, signInUrl };
	}
};
