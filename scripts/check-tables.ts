import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTables() {
  console.log('Querying time_entries table...');
  const { data: dataTime, error: errorTime } = await supabase
    .from('time_entries')
    .select('*')
    .limit(1);

  if (errorTime) {
    console.error('time_entries Error:', errorTime);
  } else {
    console.log('time_entries Success (Exists!):', dataTime);
  }

  console.log('\nQuerying organizations table...');
  const { data: dataOrg, error: errorOrg } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (errorOrg) {
    console.error('organizations Error:', errorOrg);
  } else {
    console.log('organizations Success (Exists!):', dataOrg);
  }
}

checkTables().catch(console.error);
