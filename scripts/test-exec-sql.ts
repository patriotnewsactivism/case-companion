import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testExecSql() {
  console.log('Testing exec_sql RPC...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'SELECT 1 as test'
  });

  if (error) {
    console.error('Error calling exec_sql:', error);
  } else {
    console.log('Successfully called exec_sql:', data);
  }
}

testExecSql().catch(console.error);
