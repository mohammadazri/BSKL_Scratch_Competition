// Browser-side Supabase client factory.
// Safe to import from `.svelte` files — uses the publishable (anon) key.
// All access is guarded by Row Level Security policies in the database.

import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const createSupabaseBrowser = () =>
	createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
