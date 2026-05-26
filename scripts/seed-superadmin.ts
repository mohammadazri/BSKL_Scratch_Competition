/**
 * scripts/seed-superadmin.ts
 *
 * Idempotent bootstrap: creates the super-admin auth user via the Supabase
 * Admin API (which sets up all internal GoTrue fields correctly so password
 * sign-in works), then promotes the profile to super_admin via DATABASE_URL.
 *
 * Reads from .env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — for the Admin API call
 *   DATABASE_URL                             — for the profile upsert
 *   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
 *
 * Run once after migrations + seed-rubrics:
 *   pnpm tsx scripts/seed-superadmin.ts
 *
 * Safe to re-run: existing user gets password reset + profile re-promoted.
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
	const supabaseUrl = process.env.SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const dbUrl = process.env.DATABASE_URL;
	const email = process.env.SUPER_ADMIN_EMAIL;
	const password = process.env.SUPER_ADMIN_PASSWORD;
	const fullName = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

	if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
	if (!dbUrl) throw new Error('DATABASE_URL not set');
	if (!email) throw new Error('SUPER_ADMIN_EMAIL not set');
	if (!password) throw new Error('SUPER_ADMIN_PASSWORD not set');

	const supabase = createClient(supabaseUrl, serviceKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	// ── 1. Create or update the auth user via Admin API ──────────────────────
	// The Admin API sets every internal GoTrue field correctly.
	// Raw SQL inserts into auth.users miss hidden fields and break sign-in.
	const { data: created, error: createErr } = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { full_name: fullName }
	});

	let userId: string;

	if (createErr) {
		if (!createErr.message.toLowerCase().includes('already')) {
			throw new Error(`Failed to create auth user: ${createErr.message}`);
		}

		// Already exists — find and reset password
		const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
			page: 1,
			perPage: 1000
		});
		if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

		const existing = list.users.find((u) => u.email === email);
		if (!existing) throw new Error('User reported as existing but not found.');

		const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
			password,
			email_confirm: true
		});
		if (updateErr) throw new Error(`Failed to reset password: ${updateErr.message}`);

		userId = existing.id;
		console.log(`Updated existing auth user  ${email} (${userId})`);
	} else {
		userId = created.user.id;
		console.log(`Created auth user           ${email} (${userId})`);
	}

	// ── 2. Promote profile to super_admin via direct Postgres ─────────────────
	// handle_new_user trigger already inserted the profiles row with role=judge.
	const sql = postgres(dbUrl, { prepare: false });
	try {
		await sql`
			INSERT INTO profiles (id, email, full_name, role, is_active)
			VALUES (${userId}::uuid, ${email}, ${fullName}, 'super_admin', true)
			ON CONFLICT (id) DO UPDATE
				SET role      = 'super_admin',
				    full_name = ${fullName},
				    is_active = true
		`;
	} finally {
		await sql.end();
	}

	console.log(`super_admin ready           → ${email}`);
}

try {
	await main();
} catch (err) {
	console.error('seed-superadmin failed:', err);
	process.exit(1);
}
