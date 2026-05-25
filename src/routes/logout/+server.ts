// Sign-out endpoint. POST from the user menu in the AppShell.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	throw redirect(303, '/login');
};
