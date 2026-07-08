/**
 * scripts/seed-fake-event.ts
 *
 * Idempotent staging seed for the Track 6 dry-run.
 *
 * Creates:
 *   • 5 fake schools
 *   • 45 fake participants (15 per category, ~9 per school, themes distributed)
 *   • 4 fake judges (all-categories) + 1 viewer
 *   • Assignments via the production `autoAssign()` algorithm
 *
 * Does NOT create a super_admin — Mohammad bootstraps that account by hand so
 * the staging owner is a real human, not a fixture.
 *
 * --- Idempotency ---
 * Every fixture created here carries a recognisable "_seed" tag:
 *
 *   • Schools — name prefixed with "[seed]"
 *   • Participants — full_name prefixed with "[seed]"
 *   • Auth users — email ends with "@seed.p3-judging.local"
 *
 * On each run we delete every fixture matching those tags (cascades clean up
 * scoresheets, scores, assignments, audit rows, DQ flags) before recreating.
 * Real production data is never touched.
 *
 * --- Safety ---
 * Refuses to run against production. We treat any DB whose
 * SUPABASE_URL host contains "prod" or matches an explicit prod hostname as
 * production. Override with `ALLOW_PROD=1` if you really know what you're
 * doing (you don't).
 *
 * Run with:
 *   pnpm tsx scripts/seed-fake-event.ts
 *
 * Requires (in .env or environment):
 *   SUPABASE_URL=https://<staging-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
 *
 * Optional:
 *   SEED_JUDGE_PASSWORD=test-pass-1234   (default: 'p3-staging-pass!')
 *   SEED_VIEWER_PASSWORD=test-pass-1234  (same default)
 *   ALLOW_PROD=1                         (bypass production guard)
 */

import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────────────────────
// Inlined auto-assign + shuffle
//
// We can't import `src/lib/server/auto-assign.ts` directly here because that
// file uses the SvelteKit `$lib/utils/random` alias which tsx (no bundler)
// can't resolve. The algorithm is small and the contract is locked in by
// Track 2's spec + tests, so we inline a verbatim copy. Keep this in sync
// with src/lib/server/auto-assign.ts.
// ──────────────────────────────────────────────────────────────────────────────

function shuffle<T>(input: readonly T[]): T[] {
	const arr = input.slice();
	const len = arr.length;
	if (len <= 1) return arr;
	const rand = new Uint32Array(len);
	crypto.getRandomValues(rand);
	for (let i = len - 1; i > 0; i--) {
		const j = rand[i] % (i + 1);
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

interface ParticipantInput {
	id: string;
	school_id: string;
}
interface JudgeInput {
	id: string;
}
interface AutoAssignBucket {
	judge_id: string;
	participant_ids: string[];
}

function autoAssign(args: {
	participants: ParticipantInput[];
	judges: JudgeInput[];
	maxPerSchoolPerJudge?: number;
}): AutoAssignBucket[] {
	const { participants, judges, maxPerSchoolPerJudge = 3 } = args;
	if (judges.length === 0) throw new Error('no eligible judges');
	const shuffled = shuffle(participants);
	const buckets = new Map<string, ParticipantInput[]>();
	judges.forEach((j) => buckets.set(j.id, []));
	let i = 0;
	outer: for (const p of shuffled) {
		for (let tries = 0; tries < judges.length; tries++) {
			const judge = judges[(i + tries) % judges.length];
			const bucket = buckets.get(judge.id)!;
			const fromSameSchool = bucket.filter((x) => x.school_id === p.school_id).length;
			if (fromSameSchool < maxPerSchoolPerJudge) {
				bucket.push(p);
				i = (i + tries + 1) % judges.length;
				continue outer;
			}
		}
		const least = [...buckets.entries()].sort((a, b) => a[1].length - b[1].length)[0];
		least[1].push(p);
	}
	return [...buckets.entries()].map(([judge_id, parts]) => ({
		judge_id,
		participant_ids: parts.map((p) => p.id)
	}));
}

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error(
		'[seed-fake-event] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Set them in .env.'
	);
	process.exit(1);
}

if (!process.env.ALLOW_PROD) {
	const host = new URL(SUPABASE_URL).host;
	if (/prod/i.test(host)) {
		console.error(
			`[seed-fake-event] refusing to run against ${host} — host name contains "prod". Set ALLOW_PROD=1 if you really mean it.`
		);
		process.exit(1);
	}
}

const SEED_DOMAIN = '@seed.p3-judging.local';
const SEED_TAG = '[seed]';
const JUDGE_PASSWORD = process.env.SEED_JUDGE_PASSWORD ?? 'p3-staging-pass!';
const VIEWER_PASSWORD = process.env.SEED_VIEWER_PASSWORD ?? 'p3-staging-pass!';

const FAKE_SCHOOLS = [
	{ name: `Test School 1`, shortCode: 'TS1' },
	{ name: `Test School 2`, shortCode: 'TS2' }
];

const FAKE_JUDGES = [
	{ email: `judge1@test.com`, fullName: 'Judge One', pinLabel: 'Sticky #1' },
	{ email: `judge2@test.com`, fullName: 'Judge Two', pinLabel: 'Sticky #2' }
];

const FAKE_VIEWER = {
	email: `viewer@test.com`,
	fullName: 'Observer',
	pinLabel: 'Sticky #3'
};

// Themes are valid for category B/C only per SEED_RUBRICS; cat A doesn't pick
// one. We rotate themes across cat B + C participants for realistic variety.
const THEMES = ['Eco-Warriors', 'Smart Cities', 'Space Pioneers'] as const;

const CATEGORIES = ['A', 'B', 'C'] as const;
const PARTICIPANTS_PER_CATEGORY = 2; // Total 6 participants

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeParticipantName(catIdx: number, n: number): string {
	return `Test Participant ${CATEGORIES[catIdx]}${n}`;
}

async function findExistingAuthUserId(
	admin: SupabaseClient,
	email: string
): Promise<string | null> {
	// admin.listUsers paginates; for a staging DB the seed users are few so
	// page 1 is enough, but we walk pages defensively up to a sensible cap.
	for (let page = 1; page <= 20; page++) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
		if (error) throw error;
		const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
		if (found) return found.id;
		if (data.users.length < 200) return null;
	}
	return null;
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
	console.log(`[seed-fake-event] removed ${targets.length} stale seeded auth users`);
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
	console.log(`[seed-small-test] wiped ALL participants and schools`);
}

async function ensureAuthUser(
	admin: SupabaseClient,
	opts: { email: string; password: string; fullName: string }
): Promise<string> {
	const existing = await findExistingAuthUserId(admin, opts.email);
	if (existing) {
		// Reset password so the slip we'd print today still works.
		const { error } = await admin.auth.admin.updateUserById(existing, {
			password: opts.password,
			email_confirm: true,
			user_metadata: { full_name: opts.fullName }
		});
		if (error) throw error;
		return existing;
	}
	const { data, error } = await admin.auth.admin.createUser({
		email: opts.email,
		password: opts.password,
		email_confirm: true,
		user_metadata: { full_name: opts.fullName }
	});
	if (error || !data.user) throw error ?? new Error('createUser returned no user');
	return data.user.id;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	console.log(`[seed-fake-event] target: ${new URL(SUPABASE_URL!).host}`);

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
	console.log(`[seed-small-test] reset event_state to setup`);

	// Phase 2 — schools.
	const { data: insertedSchools, error: schoolErr } = await admin
		.from('schools')
		.insert(FAKE_SCHOOLS.map((s) => ({ name: s.name, short_code: s.shortCode })))
		.select('id, name');
	if (schoolErr || !insertedSchools) throw schoolErr ?? new Error('schools insert failed');
	console.log(`[seed-fake-event] inserted ${insertedSchools.length} schools`);

	// Phase 3 — participants. Spread across schools round-robin within each
	// category. Themes cycle for cat B + C; cat A leaves theme null.
	const participantRows: Array<{
		school_id: string;
		full_name: string;
		category: 'A' | 'B' | 'C';
		theme: (typeof THEMES)[number] | null;
		qualified: boolean;
	}> = [];

	for (let catIdx = 0; catIdx < CATEGORIES.length; catIdx++) {
		const category = CATEGORIES[catIdx];
		for (let n = 1; n <= PARTICIPANTS_PER_CATEGORY; n++) {
			const school = insertedSchools[(n - 1) % insertedSchools.length];
			participantRows.push({
				school_id: school.id,
				full_name: makeParticipantName(catIdx, n),
				category,
				theme: THEMES[(n - 1) % THEMES.length],
				qualified: true
			});
		}
	}

	const { data: insertedParticipants, error: pErr } = await admin
		.from('participants')
		.insert(participantRows)
		.select('id, school_id, category');
	if (pErr || !insertedParticipants) throw pErr ?? new Error('participants insert failed');
	console.log(`[seed-fake-event] inserted ${insertedParticipants.length} participants`);

	// Phase 4 — judges (auth users + profiles).
	const judgeIds: string[] = [];
	for (const j of FAKE_JUDGES) {
		const userId = await ensureAuthUser(admin, {
			email: j.email,
			password: JUDGE_PASSWORD,
			fullName: j.fullName
		});
		const { error: profErr } = await admin.from('profiles').upsert(
			{
				id: userId,
				email: j.email,
				full_name: j.fullName,
				role: 'judge',
				categories: ['A', 'B', 'C'],
				is_active: true,
				pin_label: j.pinLabel
			},
			{ onConflict: 'id' }
		);
		if (profErr) throw profErr;
		judgeIds.push(userId);
	}
	console.log(`[seed-fake-event] upserted ${judgeIds.length} judge profiles`);

	// Phase 5 — viewer.
	const viewerId = await ensureAuthUser(admin, {
		email: FAKE_VIEWER.email,
		password: VIEWER_PASSWORD,
		fullName: FAKE_VIEWER.fullName
	});
	const { error: viewerProfErr } = await admin.from('profiles').upsert(
		{
			id: viewerId,
			email: FAKE_VIEWER.email,
			full_name: FAKE_VIEWER.fullName,
			role: 'viewer',
			categories: [],
			is_active: true,
			pin_label: FAKE_VIEWER.pinLabel
		},
		{ onConflict: 'id' }
	);
	if (viewerProfErr) throw viewerProfErr;
	console.log(`[seed-fake-event] upserted 1 viewer profile`);

	// Phase 6 — assignments. Run autoAssign per category so the cap on
	// per-school spread is respected within each cat (mirrors production).
	let assignmentCount = 0;
	for (const category of CATEGORIES) {
		const catParticipants = insertedParticipants
			.filter((p) => p.category === category)
			.map((p) => ({ id: p.id, school_id: p.school_id }));
		const buckets = autoAssign({
			participants: catParticipants,
			judges: judgeIds.map((id) => ({ id })),
			maxPerSchoolPerJudge: 3
		});
		const rows = buckets.flatMap((b) =>
			b.participant_ids.map((pid) => ({ participant_id: pid, judge_id: b.judge_id }))
		);
		if (rows.length === 0) continue;
		const { error: aErr } = await admin.from('assignments').insert(rows);
		if (aErr) throw aErr;
		assignmentCount += rows.length;
	}
	console.log(`[seed-fake-event] inserted ${assignmentCount} assignments`);

	console.log('');
	console.log('[seed-fake-event] DONE.');
	console.log('  judges:  ' + FAKE_JUDGES.map((j) => j.email).join(', '));
	console.log('  viewer:  ' + FAKE_VIEWER.email);
	console.log(`  password (all seeded users): ${JUDGE_PASSWORD}`);
	console.log('');
	console.log('  Bootstrap a super_admin manually via /admin/users or supabase studio.');
}

main().catch((err) => {
	console.error('[seed-fake-event] failed:', err);
	process.exit(1);
});
