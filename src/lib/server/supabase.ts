// Server-side Supabase ADMIN client.
// Uses the service-role key — bypasses Row Level Security.
// NEVER import this from a `.svelte` file or anywhere that ships to the browser.
// Only import inside `+page.server.ts`, `+server.ts`, `+layout.server.ts`, or `src/lib/server/**`.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});
