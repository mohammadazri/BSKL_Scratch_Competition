import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log("Reloading PostgREST schema cache...");
    await sql`NOTIFY pgrst, 'reload schema'`;
    console.log("Schema cache reloaded!");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await sql.end();
  }
}

run();
