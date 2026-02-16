/**
 * Backend Diagnostic Script
 * Tests all backend connections and features
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://plcvjadartxntnurhcua.supabase.co';

const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: unknown;
}

const results: DiagnosticResult[] = [];

async function testDatabaseConnection() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase.storage.getBucket('case-documents');

    if (error) {
      results.push({
        test: 'Storage Bucket',
        status: 'warn',
        message: `Unable to verify case-documents bucket with anon key: ${error.message}`,
      });
      return;
    }

    results.push({
      test: 'Storage Bucket',
      status: 'pass',
      message: 'case-documents bucket exists and is accessible',
      details: data,
    });
  } catch (error) {
    results.push({
      test: 'Storage Bucket',
      status: 'fail',
      message: `Storage bucket check failed: ${error}`,
    });
  }
}

async function testEdgeFunctions() {
  try {
    const functions = [
      'ocr-document',
      'transcribe-media',
      'import-google-drive',
      'create-video-room',
      'join-video-room',
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Try to access tables without authentication (should be blocked)
    const tables = ['cases', 'documents', 'timeline_events', 'profiles'];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(1);

      // RLS should block unauthenticated access
      results.push({
        test: `RLS Policy: ${table}`,
        status: error ? 'pass' : 'warn',
        message: error
          ? `${table} table properly protected by RLS`
          : `${table} table returned no RLS error; verify policy manually`,
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
  console.log(`  API Key: ${SUPABASE_KEY ? `${SUPABASE_KEY.substring(0, 20)}...` : '(missing)'}`);
  console.log('\n');

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
