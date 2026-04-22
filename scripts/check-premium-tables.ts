import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkPremiumTables() {
  const tables = [
    'discovery_requests',
    'evidence_analyses',
    'deposition_outlines',
    'case_law_research',
    'performance_summaries'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`${table}: MISSING (${error.code})`);
    } else {
      console.log(`${table}: EXISTS`);
    }
  }
}

checkPremiumTables().catch(console.error);
