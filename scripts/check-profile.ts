import postgres from 'postgres';
import 'dotenv/config';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    
    const sql = postgres(dbUrl, { prepare: false });
    
    try {
        const result = await sql`SELECT * FROM profiles WHERE email = 'mohamedazri655@gmail.com'`;
        console.log("Profile for email:", result);
        
        const allProfiles = await sql`SELECT id, email, role FROM profiles`;
        console.log("All profiles:", allProfiles);
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

main();
