import postgres from 'postgres';
import 'dotenv/config';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    
    const sql = postgres(dbUrl, { prepare: false });
    
    try {
        const users = await sql`SELECT id, email, role, raw_user_meta_data FROM auth.users WHERE email = 'mohamedazri655@gmail.com'`;
        console.log("auth.users:", users);
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

main();
