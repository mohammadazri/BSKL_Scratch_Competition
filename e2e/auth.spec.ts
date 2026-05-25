/**
 * e2e/auth.spec.ts — login (password + magic link form), role-based
 * redirect, logout. The magic-link path is not actually exercised end-to-end
 * (we'd need to read the inbox); we just assert the UI surfaces the form
 * correctly. The password path runs full round-trip.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn, signOut } from './fixtures';

test.describe('auth', () => {
	test('login page renders branded card with both auth methods reachable', async ({ page }) => {
		await page.goto('/login');

		// Brand assets — DESIGN.md § 4 + Track 6 gotcha re: missing logo regression.
		const p3Logo = page.getByRole('img', { name: /p3 robotics/i });
		const bsklLogo = page.getByRole('img', { name: /bskl/i });
		await expect(p3Logo).toBeVisible();
		await expect(bsklLogo).toBeVisible();
		for (const img of [p3Logo, bsklLogo]) {
			const src = await img.getAttribute('src');
			expect(src).toBeTruthy();
			const res = await page.request.get(src!);
			expect(res.status(), `logo ${src} should resolve`).toBe(200);
		}

		// Default mode = password. Form has email + password.
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

		// Toggle to magic-link mode — password field hides, button label flips.
		await page.getByRole('button', { name: /magic link/i }).click();
		await expect(page.getByLabel(/password/i)).toHaveCount(0);
		await expect(page.getByRole('button', { name: /email magic link/i })).toBeVisible();

		// Toggle back so the next test isn't surprised by leftover state.
		await page.getByRole('button', { name: /sign in with password/i }).click();
		await expect(page.getByLabel(/password/i)).toBeVisible();
	});

	test('wrong password surfaces a friendly error, never a stack trace', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel(/email/i).fill(accounts.judge.email);
		await page.getByLabel(/password/i).fill('definitely-wrong-password');
		await page.getByRole('button', { name: /sign in/i }).click();

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).not.toContainText(/at\s+\w+\.\w+:\d+/i); // no stack-trace shape
		// Stay on /login so they can retry.
		await expect(page).toHaveURL(/\/login/);
	});

	test('super_admin lands on /admin and can sign out', async ({ page }) => {
		await signIn(page, accounts.superAdmin);
		await expect(page).toHaveURL(/\/admin/);
		await signOut(page);
		await expect(page).toHaveURL(/\/login/);
	});

	test('judge lands on /judge and can sign out', async ({ page }) => {
		await signIn(page, accounts.judge);
		await expect(page).toHaveURL(/\/judge/);
		await signOut(page);
		await expect(page).toHaveURL(/\/login/);
	});

	test('viewer lands on /viewer and can sign out', async ({ page }) => {
		await signIn(page, accounts.viewer);
		await expect(page).toHaveURL(/\/viewer/);
		await signOut(page);
		await expect(page).toHaveURL(/\/login/);
	});
});
