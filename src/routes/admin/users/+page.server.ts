// /admin/users — list, create, edit role + categories, deactivate, reset password.
// All mutations go through supabaseAdmin (service role) because creating a user
// requires admin.auth API access. RLS on profiles still applies to anything
// going through locals.supabase.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireSuperAdmin } from '$lib/server/guards';
import { appendAudit, type AuditActor } from '$lib/server/audit-local';
import { tempPassword } from '$lib/utils/random';
import type { Category, Role } from '$lib/types';

function guardActor(session: { user: { id: string }; role: Role; fullName: string; email: string }): AuditActor {
	return {
		id: session.user.id,
		role: session.role,
		fullName: session.fullName,
		email: session.email
	};
}

export type UserRow = {
	id: string;
	email: string;
	fullName: string;
	role: Role;
	categories: Category[];
	isActive: boolean;
	pinLabel: string | null;
	createdAt: string;
	lastSignInAt: string | null;
};

export const load: PageServerLoad = async () => {
	const { data: profiles, error: profErr } = await supabaseAdmin
		.from('profiles')
		.select('id, email, full_name, role, categories, is_active, pin_label, created_at')
		.order('created_at', { ascending: false });

	if (profErr) throw error(500, profErr.message);

	// Last sign-in is purely informational; pulled from auth.users.
	const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
		page: 1,
		perPage: 200
	});
	const lastSignInByUser = new Map<string, string | null>();
	for (const u of authList?.users ?? []) {
		lastSignInByUser.set(u.id, u.last_sign_in_at ?? null);
	}

	const rows: UserRow[] = (profiles ?? []).map((p) => ({
		id: p.id as string,
		email: p.email as string,
		fullName: p.full_name as string,
		role: p.role as Role,
		categories: (p.categories ?? []) as Category[],
		isActive: p.is_active as boolean,
		pinLabel: (p.pin_label as string | null) ?? null,
		createdAt: p.created_at as string,
		lastSignInAt: lastSignInByUser.get(p.id as string) ?? null
	}));

	return { rows };
};

function parseCategories(form: FormData): Category[] {
	const all = form.getAll('categories').map((c) => String(c));
	const allowed: Category[] = ['A', 'B', 'C'];
	return allowed.filter((c) => all.includes(c));
}

function parseRole(form: FormData): Role {
	const raw = String(form.get('role') ?? 'judge');
	if (
		raw === 'super_admin' ||
		raw === 'judge' ||
		raw === 'viewer' ||
		raw === 'registration_committee'
	) {
		return raw;
	}
	return 'judge';
}

export const actions: Actions = {
	// SECURITY: Every action below uses the service-role Supabase client which
	// bypasses RLS. The parent layout's role guard does NOT run before form
	// actions, so each action MUST call requireSuperAdmin() inline. Without
	// these checks, any authenticated user (or in some configs, anyone) could
	// POST here and create/promote/reset arbitrary accounts.
	create: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const fullName = String(form.get('full_name') ?? '').trim();
		const role = parseRole(form);
		const categories =
			role === 'judge' ? parseCategories(form) : (['A', 'B', 'C'] as Category[]);
		const pinLabel = String(form.get('pin_label') ?? '').trim() || null;

		if (!email || !fullName) {
			return fail(400, { error: 'Email and full name are required.' });
		}
		if (role === 'judge' && categories.length === 0) {
			return fail(400, { error: 'Judges must be assigned at least one category.' });
		}

		const password = tempPassword(10);

		// Create the auth user. The `handle_new_user` trigger inserts a
		// profile row with role='judge'; we then UPDATE to apply real fields.
		const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: { full_name: fullName }
		});

		if (createErr || !created.user) {
			return fail(400, { error: createErr?.message ?? 'Failed to create user.' });
		}

		const { error: updateErr } = await supabaseAdmin
			.from('profiles')
			.update({
				full_name: fullName,
				role,
				categories,
				pin_label: pinLabel,
				is_active: true,
				must_change_password: true
			})
			.eq('id', created.user.id);

		if (updateErr) {
			return fail(400, {
				error: `Created auth user but failed to set profile: ${updateErr.message}`
			});
		}

		await appendAudit({
			actor: guardActor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_create',
			targetType: 'user',
			targetId: created.user.id,
			before: null,
			after: { email, full_name: fullName, role, categories, pin_label: pinLabel, must_change_password: true },
			reason: null
		});

		return {
			ok: true,
			message: `Created ${email}. Temp password: ${password}`,
			created: { id: created.user.id, email, password }
		};
	},

	update: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const fullName = String(form.get('full_name') ?? '').trim();
		const role = parseRole(form);
		const categories =
			role === 'judge' ? parseCategories(form) : (['A', 'B', 'C'] as Category[]);
		const pinLabel = String(form.get('pin_label') ?? '').trim() || null;

		if (!id || !fullName) return fail(400, { error: 'Missing id or full name.' });
		if (role === 'judge' && categories.length === 0) {
			return fail(400, { error: 'Judges must be assigned at least one category.' });
		}

		const { data: before } = await supabaseAdmin
			.from('profiles')
			.select('full_name, role, categories, pin_label')
			.eq('id', id)
			.single();

		const { error: updateErr } = await supabaseAdmin
			.from('profiles')
			.update({ full_name: fullName, role, categories, pin_label: pinLabel })
			.eq('id', id);

		if (updateErr) return fail(400, { error: updateErr.message });

		await appendAudit({
			actor: guardActor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_update',
			targetType: 'user',
			targetId: id,
			before: (before as Record<string, unknown>) ?? null,
			after: { full_name: fullName, role, categories, pin_label: pinLabel },
			reason: null
		});

		return { ok: true, message: 'User updated.' };
	},

	setRole: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const role = parseRole(form);
		if (!id) return fail(400, { error: 'Missing id.' });

		const { data: before } = await supabaseAdmin
			.from('profiles')
			.select('role')
			.eq('id', id)
			.single();

		const { error: updateErr } = await supabaseAdmin
			.from('profiles')
			.update({ role })
			.eq('id', id);
		if (updateErr) return fail(400, { error: updateErr.message });

		await appendAudit({
			actor: guardActor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_role_change',
			targetType: 'user',
			targetId: id,
			before: (before as Record<string, unknown>) ?? null,
			after: { role },
			reason: null
		});

		return { ok: true, message: `Role set to ${role}.` };
	},

	setActive: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const active = String(form.get('active') ?? 'true') === 'true';
		if (!id) return fail(400, { error: 'Missing id.' });

		const { error: updateErr } = await supabaseAdmin
			.from('profiles')
			.update({ is_active: active })
			.eq('id', id);
		if (updateErr) return fail(400, { error: updateErr.message });

		await appendAudit({
			actor: guardActor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: active ? 'user_update' : 'user_disable',
			targetType: 'user',
			targetId: id,
			before: { is_active: !active },
			after: { is_active: active },
			reason: null
		});

		return {
			ok: true,
			message: active ? 'User reactivated.' : 'User deactivated.'
		};
	},

	deleteUser: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });

		// You can't delete your own account — that would lock you out.
		if (id === locals.user!.id) {
			return fail(400, {
				error: 'You cannot delete your own account. Ask another super_admin to do it.'
			});
		}

		// Capture profile snapshot for the audit log BEFORE the delete cascades it.
		const { data: target } = await supabaseAdmin
			.from('profiles')
			.select('email, full_name, role, categories, is_active')
			.eq('id', id)
			.single();

		if (!target) return fail(404, { error: 'User not found.' });

		// Block delete if the user owns any FK-restricted rows. assignments and
		// scoresheets both `ON DELETE RESTRICT` to profiles, so the cascade from
		// auth.users → profiles would fail anyway. Surfacing a clean message is
		// better than letting Postgres complain.
		const { count: aCount } = await supabaseAdmin
			.from('assignments')
			.select('*', { count: 'exact', head: true })
			.eq('judge_id', id);
		if (aCount && aCount > 0) {
			return fail(409, {
				error: `Cannot delete: ${target.full_name} has ${aCount} assignment(s). Remove the assignments first, or deactivate the account instead.`
			});
		}

		const { count: sCount } = await supabaseAdmin
			.from('scoresheets')
			.select('*', { count: 'exact', head: true })
			.eq('judge_id', id);
		if (sCount && sCount > 0) {
			return fail(409, {
				error: `Cannot delete: ${target.full_name} has ${sCount} scoresheet(s) on record. Deactivate instead to preserve scoring history.`
			});
		}

		// Delete the auth user. profiles cascades via ON DELETE CASCADE from the
		// profiles.id → auth.users(id) FK defined in 003_tables.sql.
		const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(id);
		if (delErr) return fail(500, { error: delErr.message });

		await appendAudit({
			actor: guardActor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_delete',
			targetType: 'user',
			targetId: id,
			before: target as Record<string, unknown>,
			after: null,
			reason: null
		});

		return { ok: true, message: `Deleted ${target.email}.` };
	},

	resetPassword: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });

		const password = tempPassword(10);
		const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
		if (pwErr) return fail(400, { error: pwErr.message });

		// Force the target user to pick a new password on their next sign-in.
		await supabaseAdmin
			.from('profiles')
			.update({ must_change_password: true })
			.eq('id', id);

		await appendAudit({
			actor: guardActor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_update',
			targetType: 'user',
			targetId: id,
			before: null,
			after: { password_reset: true, must_change_password: true },
			reason: 'Admin password reset.'
		});

		return {
			ok: true,
			message: `Password reset. New temp password: ${password}`,
			created: { id, email: '', password }
		};
	}
};
