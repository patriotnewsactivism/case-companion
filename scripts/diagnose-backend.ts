/**
 * Backend Diagnostic Script
 * Tests all backend connections and features
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: 'supabase/.env.local', override: true });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: unknown;
}

const results: DiagnosticResult[] = [];

function hasBaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function maskKey(key: string): string {
  if (!key) return '(missing)';
  if (key.length < 20) return `${key.substring(0, 6)}...`;
  return `${key.substring(0, 20)}...`;
}

async function testDatabaseConnection() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await supabase.from('cases').select('count').limit(1);

    if (error) throw error;

    results.push({
      test: 'Database Connection',
      status: 'pass',
      message: 'Successfully connected to Supabase database',
    });
  } catch (error) {
    results.push({
      test: 'Database Connection',
      status: 'fail',
      message: `Database connection failed: ${error}`,
    });
  }
}

async function testAuthentication() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase.auth.getSession();

    results.push({
      test: 'Authentication',
      status: data?.session ? 'pass' : 'warn',
      message: data?.session ? 'User session active' : 'No active session (expected if not logged in)',
    });
  } catch (error) {
    results.push({
      test: 'Authentication',
      status: 'fail',
      message: `Authentication check failed: ${error}`,
    });
  }
}

async function testStorageBucket() {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      results.push({
        test: 'Storage Bucket',
        status: 'warn',
        message:
          'SUPABASE_SERVICE_ROLE_KEY not set; skipping definitive storage bucket existence check',
      });
      return;
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.storage.getBucket('case-documents');

    if (error) throw error;

    if (error) throw error;
    if (!data) {
      results.push({
        test: 'Storage Bucket',
        status: 'fail',
        message: 'case-documents bucket is missing',
      });
      return;
    }

    results.push({
      test: 'Storage Bucket',
      status: 'pass',
      message: `case-documents bucket exists (public: ${data.public})`,
      details: data,
    });
  } catch (error) {
    results.push({
      test: 'Storage Bucket',
      status: 'fail',
      message: `Storage bucket check failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    });
  }
}

async function testEdgeFunctions() {
  try {
    const functions = [
      'ocr-document',
      'trial-simulation',
      'transcribe-media',
      'transcribe-recording',
      'import-google-drive',
      'create-video-room',
      'join-video-room',
      'recording-webhook',
    ];

    for (const func of functions) {
      const url = `${SUPABASE_URL}/functions/v1/${func}`;
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:8080',
        },
      });

      results.push({
        test: `Edge Function: ${func}`,
        status: response.ok || response.status === 204 ? 'pass' : 'warn',
        message:
          response.ok || response.status === 204
            ? `${func} is deployed and responding`
            : `${func} returned status ${response.status}`,
      });
    }
  } catch (error) {
    results.push({
      test: 'Edge Functions',
      status: 'fail',
      message: `Edge function check failed: ${error}`,
    });
  }
}

async function testRLSPolicies() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Try to access tables without authentication (should be blocked)
    const tables = ['cases', 'documents', 'timeline_events', 'profiles'];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      const rowCount = Array.isArray(data) ? data.length : 0;

      results.push({
        test: `RLS Policy: ${table}`,
        status: error || rowCount === 0 ? 'pass' : 'warn',
        message: error
          ? `${table} table properly protected by RLS`
          : rowCount === 0
            ? `${table} table returned zero rows to anon user`
            : `${table} table returned ${rowCount} row(s) to anon user; verify policy`,
      });
    }
  } catch (error) {
    results.push({
      test: 'RLS Policies',
      status: 'fail',
      message: `RLS policy check failed: ${error}`,
    });
  }
}

async function runDiagnostics() {
  console.log('Starting backend diagnostics...\n');
  console.log('Configuration:');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Anon API Key: ${maskKey(SUPABASE_ANON_KEY)}`);
  console.log(`  Service Role Key: ${maskKey(SUPABASE_SERVICE_ROLE_KEY)}`);
  console.log('\n');

  if (!hasBaseConfig()) {
    results.push({
      test: 'Configuration',
      status: 'fail',
      message:
        'Missing required Supabase env vars: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY',
    });
  } else {
    results.push({
      test: 'Configuration',
      status: 'pass',
      message: 'Required Supabase environment variables are present',
    });
  }

  if (!hasBaseConfig()) {
    console.log('\nDiagnostic results:\n');
    console.log('='.repeat(80));
    results.forEach((result) => {
      const icon = result.status === 'pass' ? '[PASS]' : result.status === 'warn' ? '[WARN]' : '[FAIL]';
      console.log(`${icon} ${result.test}`);
      console.log(`   ${result.message}`);
      console.log('');
    });
    console.log('='.repeat(80));
    console.log('\nSummary: 0 passed, 0 warnings, 1 failed');
    console.log('\nCRITICAL ISSUES FOUND - Backend requires attention!');
    process.exit(1);
  }

  await testDatabaseConnection();
  await testAuthentication();
  await testStorageBucket();
  await testEdgeFunctions();
  await testRLSPolicies();

  console.log('\nDiagnostic results:\n');
  console.log('='.repeat(80));

  results.forEach((result) => {
    const icon = result.status === 'pass' ? '[PASS]' : result.status === 'warn' ? '[WARN]' : '[FAIL]';
    console.log(`${icon} ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });

  console.log('='.repeat(80));

  const passed = results.filter((r) => r.status === 'pass').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log(`\nSummary: ${passed} passed, ${warned} warnings, ${failed} failed`);

  if (failed > 0) {
    console.log('\nCRITICAL ISSUES FOUND - Backend requires attention!');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\nSome warnings found - Review recommended');
  } else {
    console.log('\nAll systems operational!');
  }
}

runDiagnostics().catch(console.error);
