/**
 * e2e/rls-isolation.spec.ts — Judge A cannot read Judge B's scoresheet.
 *
 * We exercise RLS at the API layer rather than via the UI: Playwright signs
 * in as Judge A, grabs the Supabase session cookie / JWT, then directly hits
 * the PostgREST endpoint for a scoresheet that belongs to Judge B. Expect:
 *   • HTTP 200 with empty array  (RLS filters silently — preferred)
 *   • HTTP 401/403               (also acceptable)
 *   • HTTP 200 with Judge B's row  → TEST FAILS (RLS leak).
 *
 * Judge B's scoresheet ID is discovered by signing in as super_admin first
 * (who can see everything) and reading the first scoresheet whose judge_id
 * is NOT Judge A's. We pass it back to the Judge A context for the actual
 * RLS probe.
 */
import { expect, test, request as playwrightRequest } from '@playwright/test';
import { accounts, signIn } from './fixtures';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe('RLS isolation', () => {
	test.skip(
		!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY,
		'requires PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY in .env.test'
	);

	test('judge cannot read another judge\'s scoresheet via PostgREST', async ({ browser }) => {
		// Step 1 — discover a "foreign" scoresheet via the service-role key.
		// This is the test harness's privilege; the SUT (Judge A's JWT)
		// never sees it.
		const adminApi = await playwrightRequest.newContext({
			extraHTTPHeaders: {
				apikey: SERVICE_ROLE_KEY!,
				Authorization: `Bearer ${SERVICE_ROLE_KEY!}`
			}
		});
		const profilesRes = await adminApi.get(
			`${SUPABASE_URL}/rest/v1/profiles?role=eq.judge&email=eq.${encodeURIComponent(accounts.judge.email)}&select=id`
		);
		expect(profilesRes.ok()).toBe(true);
		const profileBody = (await profilesRes.json()) as Array<{ id: string }>;
		expect(profileBody.length).toBeGreaterThan(0);
		const judgeAId = profileBody[0].id;

		const foreignSheetRes = await adminApi.get(
			`${SUPABASE_URL}/rest/v1/scoresheets?judge_id=neq.${judgeAId}&select=id,judge_id&limit=1`
		);
		expect(foreignSheetRes.ok()).toBe(true);
		const foreignBody = (await foreignSheetRes.json()) as Array<{ id: string; judge_id: string }>;
		test.skip(
			foreignBody.length === 0,
			'no foreign scoresheet exists yet — run scripts/seed-fake-event.ts + judge-flow.spec.ts first'
		);
		const targetSheetId = foreignBody[0].id;
		const targetJudgeId = foreignBody[0].judge_id;
		await adminApi.dispose();

		// Step 2 — sign Judge A into the app, grab their JWT from localStorage.
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await signIn(page, accounts.judge);

		const accessToken = await page.evaluate(() => {
			// Supabase stores its session under sb-<project-ref>-auth-token.
			// Scan localStorage for the first matching key.
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && /^sb-.*-auth-token$/.test(key)) {
					const raw = localStorage.getItem(key);
					if (!raw) continue;
					try {
						const parsed = JSON.parse(raw) as { access_token?: string };
						if (parsed.access_token) return parsed.access_token;
					} catch {
						/* fall through */
					}
				}
			}
			return null;
		});
		await ctx.close();
		expect(accessToken, 'failed to extract Judge A access token from localStorage').toBeTruthy();

		// Step 3 — probe PostgREST as Judge A.
		const judgeApi = await playwrightRequest.newContext({
			extraHTTPHeaders: {
				apikey: ANON_KEY!,
				Authorization: `Bearer ${accessToken!}`
			}
		});
		const probe = await judgeApi.get(
			`${SUPABASE_URL}/rest/v1/scoresheets?id=eq.${targetSheetId}&select=id,judge_id`
		);
		const status = probe.status();
		expect(status, `RLS probe returned ${status} for a foreign scoresheet`).toBeLessThan(500);

		if (status === 200) {
			const rows = (await probe.json()) as Array<{ id: string; judge_id: string }>;
			expect(
				rows.length,
				`RLS leak: Judge A could read Judge ${targetJudgeId}'s scoresheet ${targetSheetId}`
			).toBe(0);
		} else {
			// 401/403/404 are all acceptable — anything but a 2xx with the row.
			expect([401, 403, 404]).toContain(status);
		}
		await judgeApi.dispose();
	});
});
