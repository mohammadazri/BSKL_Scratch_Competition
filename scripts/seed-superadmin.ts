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
 * Safe to re-run: existing user is updated in-place (password reset + role
 * re-promoted) rather than inserted again.
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
		await sql`
			DO $$
			DECLARE
				v_id   uuid;
				v_exists boolean;
			BEGIN
				-- Check if the user already exists
				SELECT id INTO v_id
				FROM auth.users
				WHERE email = ${email}
				LIMIT 1;

				IF v_id IS NOT NULL THEN
					-- Already exists — reset password + ensure email confirmed
					UPDATE auth.users
					SET
						encrypted_password  = crypt(${password}, gen_salt('bf')),
						email_confirmed_at  = COALESCE(email_confirmed_at, now()),
						updated_at          = now()
					WHERE id = v_id;

					RAISE NOTICE 'Updated existing auth user % (%)', ${email}, v_id;
				ELSE
					-- New user — insert with all required GoTrue fields
					v_id := gen_random_uuid();

					INSERT INTO auth.users (
						id, instance_id, aud, role,
						email, encrypted_password, email_confirmed_at,
						confirmation_token, recovery_token,
						email_change_token_new, email_change,
						raw_app_meta_data, raw_user_meta_data,
						is_super_admin, created_at, updated_at
					) VALUES (
						v_id,
						'00000000-0000-0000-0000-000000000000',
						'authenticated',
						'authenticated',
						${email},
						crypt(${password}, gen_salt('bf')),
						now(),
						'', '',   -- GoTrue expects empty strings, not NULL
						'', '',
						'{"provider":"email","providers":["email"]}',
						jsonb_build_object('full_name', ${fullName}),
						false,
						now(), now()
					);

					-- Identity row required for password sign-in.
					-- id = user id is the GoTrue convention for the email provider.
					INSERT INTO auth.identities (
						id, user_id, provider_id,
						identity_data, provider,
						last_sign_in_at, created_at, updated_at
					) VALUES (
						v_id, v_id,
						${email},
						jsonb_build_object(
							'sub',            v_id::text,
							'email',          ${email},
							'email_verified', true,
							'provider_id',    ${email}
						),
						'email',
						now(), now(), now()
					);

					RAISE NOTICE 'Created auth user % (%)', ${email}, v_id;
				END IF;

				-- The handle_new_user trigger created (or already had) a profiles row.
				-- Upsert to make sure role=super_admin regardless.
				INSERT INTO profiles (id, email, full_name, role, is_active)
				VALUES (v_id, ${email}, ${fullName}, 'super_admin', true)
				ON CONFLICT (id) DO UPDATE
					SET role      = 'super_admin',
					    full_name = ${fullName},
					    is_active = true;

				RAISE NOTICE 'Profile promoted to super_admin for %', ${email};
			END $$;
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
