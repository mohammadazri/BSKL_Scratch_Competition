import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function main() {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL/Key');
    if (!email || !password) throw new Error('Missing admin creds');

    const supabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log(`Logging in as ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('Login failed:', error.message);
        return;
    }

    console.log('Login successful! Session token:', data.session.access_token.substring(0, 20) + '...');
    
    // Now try to fetch the local server
    console.log('Fetching http://localhost:5999/admin ...');
    
    // Format the cookies exactly how the browser would send them.
    // The sveltekit app expects sb-auth-token cookies (or relies on Supabase Auth SSR which looks for specific cookies).
    // Let's see what the cookie names are. Wait, standard SSR setup uses `sb-jikvbzauclrbkesfvqeq-auth-token` or similar.
    // Actually, SvelteKit's Supabase SSR uses the cookies. Let's look at what hooks.server.ts reads.
    
    // Actually we can just query the profile table with the authenticated supabase client directly:
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
    if (profileError) {
        console.error('Profile fetch over RLS failed:', profileError.message);
    } else {
        console.log('Profile fetch over RLS successful:', profile);
    }
}

main();
