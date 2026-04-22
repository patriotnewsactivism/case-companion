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

async function checkTables() {
  const tables = [
    'time_entries',
    'research_notes',
    'court_dates',
    'depositions',
    'processing_queue'
  ];

  for (const table of tables) {
    console.log(`Checking table: ${table}`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.error(`Error checking ${table}:`, error);
    } else {
      console.log(`Successfully selected from ${table}:`, data);
    }
  }

  // Test insert into processing_queue
  console.log('Testing insert into processing_queue...');
  const { data: insertData, error: insertError } = await supabase.from('processing_queue').insert({
    file_id: '00000000-0000-0000-0000-000000000000',
    case_id: '00000000-0000-0000-0000-000000000000',
    user_id: '00000000-0000-0000-0000-000000000000',
    processing_type: 'ocr',
    file_name: 'test.pdf',
    file_type: 'application/pdf',
    storage_path: 'test/test.pdf'
  }).select();

  if (insertError) {
    console.error('Error inserting into processing_queue:', insertError);
  } else {
    console.log('Successfully inserted into processing_queue:', insertData);
  }
}

checkTables().catch(console.error);
