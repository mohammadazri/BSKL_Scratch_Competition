/**
 * scripts/seed-superadmin.ts
 *
 * Idempotent bootstrap: creates the super-admin auth user + profile row via a
 * direct Postgres connection (DATABASE_URL) — same pattern as seed-rubrics.ts.
 *
 * Reads credentials from .env:
 *   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
 *
 * Run once after all migrations + seed-rubrics have been applied:
 *   pnpm tsx scripts/seed-superadmin.ts
 *
 * Safe to re-run: existing user gets password reset + role re-promoted.
 */

import postgres from 'postgres';
import 'dotenv/config';

async function main() {
	const dbUrl = process.env.DATABASE_URL;
	const email = process.env.SUPER_ADMIN_EMAIL;
	const password = process.env.SUPER_ADMIN_PASSWORD;
	const fullName = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

	if (!dbUrl) throw new Error('DATABASE_URL is not set in .env');
	if (!email) throw new Error('SUPER_ADMIN_EMAIL is not set in .env');
	if (!password) throw new Error('SUPER_ADMIN_PASSWORD is not set in .env');

	const sql = postgres(dbUrl, { prepare: false });

	try {
		// Check if the auth user already exists
		const existing = await sql<{ id: string }[]>`
			SELECT id FROM auth.users WHERE email = ${email} LIMIT 1
		`;

		let userId: string;

		if (existing.length > 0) {
			userId = existing[0].id;
			await sql`
				UPDATE auth.users
				SET encrypted_password = crypt(${password}, gen_salt('bf')),
				    email_confirmed_at  = COALESCE(email_confirmed_at, now()),
				    updated_at          = now()
				WHERE id = ${userId}::uuid
			`;
			console.log(`Updated existing user ${email} (${userId})`);
		} else {
			// Generate UUID in Postgres so we have it for the identity row too
			const [{ id }] = await sql<{ id: string }[]>`SELECT gen_random_uuid() AS id`;
			userId = id;

			const appMeta = JSON.stringify({ provider: 'email', providers: ['email'] });
			const userMeta = JSON.stringify({ full_name: fullName });

			await sql`
				INSERT INTO auth.users (
					id, instance_id, aud, role,
					email, encrypted_password, email_confirmed_at,
					confirmation_token, recovery_token,
					email_change_token_new, email_change,
					raw_app_meta_data, raw_user_meta_data,
					is_super_admin, created_at, updated_at
				) VALUES (
					${userId}::uuid,
					'00000000-0000-0000-0000-000000000000'::uuid,
					'authenticated', 'authenticated',
					${email},
					crypt(${password}, gen_salt('bf')),
					now(),
					'', '', '', '',
					${appMeta}::jsonb,
					${userMeta}::jsonb,
					false, now(), now()
				)
			`;

			const identityData = JSON.stringify({
				sub: userId,
				email,
				email_verified: true,
				provider_id: email
			});

			await sql`
				INSERT INTO auth.identities (
					id, user_id, provider_id,
					identity_data, provider,
					last_sign_in_at, created_at, updated_at
				) VALUES (
					${userId}::uuid, ${userId}::uuid, ${email},
					${identityData}::jsonb,
					'email',
					now(), now(), now()
				)
			`;

			console.log(`Created auth user ${email} (${userId})`);
		}

		// Upsert profile — handle_new_user trigger may have already inserted it
		await sql`
			INSERT INTO profiles (id, email, full_name, role, is_active)
			VALUES (${userId}::uuid, ${email}, ${fullName}, 'super_admin', true)
			ON CONFLICT (id) DO UPDATE
				SET role      = 'super_admin',
				    full_name = ${fullName},
				    is_active = true
		`;

		console.log(`super_admin ready → ${email}`);
	} finally {
		await sql.end();
	}
}

try {
	await main();
} catch (err) {
	console.error('seed-superadmin failed:', err);
	process.exit(1);
}
