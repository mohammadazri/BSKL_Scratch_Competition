import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
		.from('event_state')
		.select('id, event_name, event_date, sprint_minutes, phase_a, phase_b, phase_c, sprint_start_a, sprint_start_b, sprint_start_c, locked, locked_at, locked_by')
		.eq('id', 1)
		.single();
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
