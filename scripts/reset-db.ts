import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error(
		'[reset-db] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Set them in .env.'
	);
	process.exit(1);
}

if (!process.env.ALLOW_PROD) {
	const host = new URL(SUPABASE_URL).host;
	if (/prod/i.test(host)) {
		console.error(
			`[reset-db] refusing to run against ${host} — host name contains "prod". Set ALLOW_PROD=1 if you really mean it.`
		);
		process.exit(1);
	}
}

async function deleteSeededAuthUsers(admin: SupabaseClient): Promise<void> {
	const targets: string[] = [];
	for (let page = 1; page <= 20; page++) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
		if (error) throw error;
		for (const u of data.users) {
			if (u.email && u.email.toLowerCase() !== 'mohamedazri655@gmail.com') {
				targets.push(u.id);
			}
		}
		if (data.users.length < 200) break;
	}
	for (const id of targets) {
		const { error } = await admin.auth.admin.deleteUser(id, true);
		if (error && !/not.?found/i.test(error.message)) {
			throw error;
		}
	}
	console.log(`[reset-db] removed ${targets.length} auth users (excluding admin).`);
}

async function deleteSeededTables(admin: SupabaseClient): Promise<void> {
	// Wipe all participants to cascade delete scoresheets, assignments, etc.
	const { error: pErr } = await admin
		.from('participants')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (pErr) throw pErr;

	const { error: sErr } = await admin.from('schools').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	if (sErr) throw sErr;
	console.log(`[reset-db] wiped ALL participants, assignments, scoresheets, scores, and schools.`);
}

async function main(): Promise<void> {
	const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	console.log(`[reset-db] target: ${new URL(SUPABASE_URL!).host}`);

	// Phase 1 — wipe all rows so the run is a fresh slate.
	await deleteSeededTables(admin);
	await deleteSeededAuthUsers(admin);

	// Reset event_state
	const { error: esErr } = await admin.from('event_state').update({
		phase_a: 'setup',
		phase_b: 'setup',
		phase_c: 'setup',
		sprint_start_a: null,
		sprint_start_b: null,
		sprint_start_c: null,
		locked: false,
		locked_at: null,
		locked_by: null
	}).eq('id', 1);
	if (esErr) throw esErr;
	console.log(`[reset-db] reset event_state to setup`);

	console.log('');
	console.log('[reset-db] DONE. Database is now completely clean except for the admin account.');
}

main().catch((err) => {
	console.error('[reset-db] failed:', err);
	process.exit(1);
});
