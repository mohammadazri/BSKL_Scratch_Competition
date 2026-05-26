-- 014_must_change_password.sql
--
-- Force first-login password change for any account where the super-admin
-- created (or reset) the password. The flag lives on the profile, the gate
-- runs in the SvelteKit root layout, and `/auth/change-password` clears it.
--
-- Flow:
--   1. super_admin creates a user OR resets a password → flag set TRUE
--   2. User signs in with the temp password
--   3. App-level gate redirects every page to /auth/change-password
--   4. User picks a new password → action updates auth.users password +
--      sets the flag to FALSE
--
-- The bootstrap super_admin (created by scripts/seed-superadmin.ts using
-- credentials the operator chose themselves) explicitly leaves this flag
-- FALSE — they already know their password.
--
-- Safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
