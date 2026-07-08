import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function run() {
  const sqlString = fs.readFileSync('supabase/migrations/025_category_phases_and_timers.sql', 'utf8');
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log("Applying migration...");
    await sql.unsafe(sqlString);
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.end();
  }
}

run();
