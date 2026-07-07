/**
 * Script to apply the bucket public fix via Supabase API
 * This makes the case-documents bucket public so getPublicUrl() works
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rerbrlrxptnusypzpghj.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function applyFix() {
  console.log('🔧 Applying storage bucket fix...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Execute SQL to make bucket public
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE storage.buckets
        SET public = true
        WHERE id = 'case-documents';
      `
    });

    if (error) {
      console.error('❌ Failed to update bucket:', error);
      console.log('\n📝 Manual fix required:');
      console.log('1. Go to: https://app.supabase.com/project/rerbrlrxptnusypzpghj/editor/sql');
      console.log('2. Run this SQL:\n');
      console.log('UPDATE storage.buckets SET public = true WHERE id = \'case-documents\';');
      return;
    }

    console.log('✅ Bucket updated successfully!');
    console.log('\nVerifying...');

    // Verify the bucket is now public
    const { data: bucket } = await supabase.storage.getBucket('case-documents');
    console.log('Bucket status:', bucket);

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n📝 Manual fix required:');
    console.log('1. Go to: https://app.supabase.com/project/rerbrlrxptnusypzpghj/editor/sql');
    console.log('2. Run this SQL:\n');
    console.log('UPDATE storage.buckets SET public = true WHERE id = \'case-documents\';');
  }
}

applyFix();
