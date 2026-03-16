/**
 * Creates the ben@texasplanninglaw.com user account in Supabase.
 *
 * Prerequisites:
 *   1. Set SUPABASE_SERVICE_ROLE_KEY in .env (Supabase Dashboard → Settings → API → service_role)
 *   2. Run: node scripts/create-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const [key, ...vals] = line.split('=');
      return [key.trim(), vals.join('=').trim().replace(/^["']|["']$/g, '')];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY in .env before running this script.');
  console.error('   Find it at: Supabase Dashboard → Settings → API → service_role secret');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = 'ben@texasplanninglaw.com';
const PASSWORD = 'Activism101$';

console.log(`Creating user: ${EMAIL}`);

const { data, error } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: 'Ben' },
});

if (error) {
  if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
    console.log('ℹ️  User already exists. Updating password...');
    // Find and update the user
    const { data: users } = await supabase.auth.admin.listUsers();
    const existing = users?.users?.find(u => u.email === EMAIL);
    if (existing) {
      const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      });
      if (updateErr) {
        console.error('❌ Failed to update user:', updateErr.message);
        process.exit(1);
      }
      console.log('✅ Password updated successfully.');
      console.log(`   Email:    ${EMAIL}`);
      console.log(`   Password: ${PASSWORD}`);
    }
  } else {
    console.error('❌ Failed to create user:', error.message);
    process.exit(1);
  }
} else {
  const userId = data.user.id;
  console.log(`✅ User created: ${userId}`);

  // Upsert profile record
  const { error: profileErr } = await supabase.from('profiles').upsert({
    user_id: userId,
    full_name: 'Ben',
    firm_name: 'Texas Planning Law',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (profileErr) {
    console.warn('⚠️  Profile upsert failed (non-fatal):', profileErr.message);
  } else {
    console.log('✅ Profile record created.');
  }

  console.log('\nLogin credentials:');
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
}
