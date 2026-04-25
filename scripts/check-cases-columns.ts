import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkCases() {
  const { data, error } = await supabase.from('cases').select('*').limit(1);
  if (error) {
    console.error('Error selecting from cases:', error);
  } else {
    console.log('Successfully selected from cases. Columns:', Object.keys(data[0] || {}));
  }
}

checkCases().catch(console.error);
