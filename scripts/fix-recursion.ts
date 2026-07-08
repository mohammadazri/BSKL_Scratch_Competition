import postgres from 'postgres';
import 'dotenv/config';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    
    const sql = postgres(dbUrl, { prepare: false });
    
    try {
        await sql`
            CREATE OR REPLACE FUNCTION current_role_is(target user_role)
            RETURNS boolean
            LANGUAGE plpgsql
            STABLE
            SECURITY DEFINER
            SET search_path = public
            AS $$
            DECLARE
              res boolean;
            BEGIN
              SELECT EXISTS (
                SELECT 1 FROM profiles
                 WHERE id = auth.uid() AND role = target AND is_active = true
              ) INTO res;
              RETURN res;
            END;
            $$;
        `;
        console.log("Successfully redefined current_role_is in plpgsql");
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

main();
