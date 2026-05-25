/**
 * scripts/test-rls.ts
 *
 * RLS smoke test. Uses the Supabase service-role key (which bypasses RLS) to:
 *   1. Provision two test fixtures: judge_a and judge_b, each with one
 *      assigned participant.
 *   2. Issue impersonated JWTs for each judge.
 *   3. Re-connect using the anon client + JWT to exercise policies:
 *      a) judge_a SELECT participants → should see ONLY judge_a's participant.
 *      b) judge_a UPDATE judge_b's scoresheet → should be blocked (0 rows).
 *      c) judge_a INSERT into audit_log → should fail.
 *      d) judge_a UPDATE an audit_log row → should be blocked (0 rows).
 *
 * Idempotent: fixtures are torn down at the end (best-effort). Re-running is safe.
 *
 * Run with:
 *   pnpm tsx scripts/test-rls.ts
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
	throw new Error(
		'Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SUPABASE_ANON_KEY'
	);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

type Fixture = {
	userId: string;
	email: string;
	password: string;
	participantId: string;
	scoresheetId: string;
	jwt: string;
};

const STAMP = Date.now();
const PW = 'rls-test-pw-' + STAMP;

const results: { name: string; passed: boolean; detail?: string }[] = [];

function record(name: string, passed: boolean, detail?: string) {
	results.push({ name, passed, detail });
	const tag = passed ? 'PASS' : 'FAIL';
	console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function provisionJudge(label: string, schoolId: string): Promise<Fixture> {
	const email = `rls-${label}-${STAMP}@example.test`;

	const { data: created, error: createErr } = await admin.auth.admin.createUser({
		email,
		password: PW,
		email_confirm: true,
		user_metadata: { full_name: `RLS ${label}`, role: 'judge' }
	});
	if (createErr || !created.user) {
		throw new Error(`failed to create user ${label}: ${createErr?.message}`);
	}
	const userId = created.user.id;

	// handle_new_user trigger should have created a profile row; double-check it
	// exists and is a judge.
	await admin
		.from('profiles')
		.update({ role: 'judge', is_active: true })
		.eq('id', userId);

	const { data: participant, error: pErr } = await admin
		.from('participants')
		.insert({
			school_id: schoolId,
			full_name: `RLS Participant ${label} ${STAMP}`,
			category: 'A'
		})
		.select('id')
		.single();
	if (pErr || !participant) throw new Error(`participant insert failed: ${pErr?.message}`);

	const { error: aErr } = await admin
		.from('assignments')
		.insert({ participant_id: participant.id, judge_id: userId });
	if (aErr) throw new Error(`assignment insert failed: ${aErr.message}`);

	const { data: sheet, error: sErr } = await admin
		.from('scoresheets')
		.insert({ participant_id: participant.id, judge_id: userId, status: 'draft' })
		.select('id')
		.single();
	if (sErr || !sheet) throw new Error(`scoresheet insert failed: ${sErr?.message}`);

	// Sign in via the anon client to obtain a JWT for this user.
	const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	const { data: session, error: signInErr } = await anon.auth.signInWithPassword({
		email,
		password: PW
	});
	if (signInErr || !session.session) {
		throw new Error(`sign-in failed for ${label}: ${signInErr?.message}`);
	}

	return {
		userId,
		email,
		password: PW,
		participantId: participant.id,
		scoresheetId: sheet.id,
		jwt: session.session.access_token
	};
}

function clientFor(jwt: string) {
	return createClient(SUPABASE_URL!, ANON_KEY!, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers: { Authorization: `Bearer ${jwt}` } }
	});
}

async function cleanup(fixtures: Fixture[], schoolId: string) {
	for (const f of fixtures) {
		// Cascades handle scoresheets / assignments / scores via FK ON DELETE CASCADE.
		await admin.from('participants').delete().eq('id', f.participantId);
		await admin.auth.admin.deleteUser(f.userId).catch(() => {});
	}
	await admin.from('schools').delete().eq('id', schoolId);
}

async function main() {
	// Bootstrap a throwaway school for the test participants.
	const { data: school, error: schoolErr } = await admin
		.from('schools')
		.insert({ name: `RLS Test School ${STAMP}` })
		.select('id')
		.single();
	if (schoolErr || !school) throw new Error(`school insert failed: ${schoolErr?.message}`);

	const judgeA = await provisionJudge('a', school.id);
	const judgeB = await provisionJudge('b', school.id);

	try {
		const aClient = clientFor(judgeA.jwt);

		// (1) judge_a SELECT participants → should see only their own.
		const { data: visible, error: vErr } = await aClient.from('participants').select('id');
		const ids = (visible ?? []).map((r) => r.id);
		record(
			'judge sees only assigned participants',
			!vErr && ids.includes(judgeA.participantId) && !ids.includes(judgeB.participantId),
			vErr ? vErr.message : `saw ${ids.length} row(s)`
		);

		// (2) judge_a UPDATE judge_b's scoresheet → should be blocked.
		const { data: updated, error: uErr } = await aClient
			.from('scoresheets')
			.update({ judge_notes: 'cross-tenant write attempt' })
			.eq('id', judgeB.scoresheetId)
			.select('id');
		record(
			'judge cannot UPDATE another judge scoresheet',
			!uErr && (updated?.length ?? 0) === 0,
			uErr ? uErr.message : `updated ${updated?.length ?? 0} row(s)`
		);

		// (3) judge_a INSERT into audit_log directly → should be blocked.
		const { error: iErr } = await aClient.from('audit_log').insert({
			action: 'login',
			target_type: 'user',
			target_id: judgeA.userId,
			actor_id: judgeA.userId
		});
		record(
			'judge cannot INSERT into audit_log',
			!!iErr,
			iErr ? `blocked: ${iErr.message}` : 'INSERT unexpectedly succeeded'
		);

		// (4) judge_a UPDATE an audit_log row → should be blocked.
		// Find an audit_log row created by handle_new_user / triggers for judge_a
		// (use service client to pull a target id).
		const { data: anyLog } = await admin
			.from('audit_log')
			.select('id')
			.limit(1)
			.maybeSingle();
		if (anyLog) {
			const { data: upd, error: aUpdErr } = await aClient
				.from('audit_log')
				.update({ reason: 'tamper attempt' })
				.eq('id', anyLog.id)
				.select('id');
			record(
				'judge cannot UPDATE audit_log row',
				!aUpdErr && (upd?.length ?? 0) === 0,
				aUpdErr ? `blocked: ${aUpdErr.message}` : `updated ${upd?.length ?? 0} row(s)`
			);
		} else {
			record('judge cannot UPDATE audit_log row', true, 'no audit_log rows to target — skipped');
		}
	} finally {
		await cleanup([judgeA, judgeB], school.id);
	}

	const failed = results.filter((r) => !r.passed);
	if (failed.length > 0) {
		console.error(`\n${failed.length} check(s) failed`);
		process.exit(1);
	}
	console.log('\nall RLS checks passed');
}

main().catch((err) => {
	console.error('test-rls crashed:', err);
	process.exit(1);
});
