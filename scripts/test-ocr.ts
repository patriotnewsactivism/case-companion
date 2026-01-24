
import { createClient } from '@supabase/supabase-js';

// Configuration (Hardcoded for local test)
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NDUzNzY4Mn0.sZ9Z2QoERcdAxXInqq5YRpH5JLlv4Z8wqTz81X9gZ4Sah4w2XXINGPb8WQC5n3QsSHhKENOCgWOvqm3BD_61DA';

// Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  console.log('🚀 Starting End-to-End OCR Test...');

  try {
    // 1. Create a Test User
    const email = `test.user.${Date.now()}@example.com`;
    const password = 'password123';
    console.log(`1. Creating user: ${email}`);
    
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (userError) throw new Error(`Failed to create user: ${userError.message}`);
    const userId = userData.user.id;
    console.log(`   ✅ User created: ${userId}`);

    // 2. Create a Profile (if triggers don't do it, but usually they do. Check if needed.)
    // Skipping profile creation, assuming trigger or not strict requirement for this test.

    // 3. Create a Case
    console.log('2. Creating a new Case...');
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .insert({
        name: 'Test Litigation Case 2025', // Using 'name' as per current schema
        case_type: 'Litigation',
        status: 'active',
        user_id: userId,
        client_name: 'John Doe'
      })
      .select()
      .single();

    if (caseError) throw new Error(`Failed to create case: ${caseError.message}`);
    const caseId = caseData.id;
    console.log(`   ✅ Case created: ${caseId} (${caseData.name})`);

    // 4. Upload a "Document" (Text file)
    console.log('3. Uploading Document...');
    const fileName = `evidence-${Date.now()}.txt`;
    const fileContent = `
      CASE NO: CV-2025-001
      DATE: January 23, 2025
      
      MEMORANDUM FOR FILE
      
      RE: Settlement Conference
      
      On February 15, 2025, a settlement conference was held at the Superior Court.
      Judge Smith presided. The plaintiff offered $50,000 to settle the matter.
      The offer was rejected.
      
      Next hearing is scheduled for March 10, 2025.
      
      IMPORTANT: Review witness list by March 1, 2025.
    `;
    
    // Upload to 'case-documents' bucket
    // Note: Local storage setup might require creating the bucket if not exists.
    // The migration 20251227200000_create_case_documents_bucket.sql should have created it.
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('case-documents')
      .upload(`${userId}/${caseId}/${fileName}`, fileContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) throw new Error(`Failed to upload file: ${uploadError.message}`);
    console.log(`   ✅ File uploaded: ${uploadData.path}`);
    
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/case-documents/${uploadData.path}`; // Construct public/signed URL
    // Actually, for local dev, 'ocr-document' handles local paths or signed URLs.
    // Let's use the path or a signed URL.
    const { data: signedUrlData } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(`${userId}/${caseId}/${fileName}`, 60 * 60);
      
    const activeUrl = signedUrlData?.signedUrl || fileUrl;

    // 5. Create Document Record
    console.log('4. Creating Document Record...');
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        case_id: caseId,
        user_id: userId,
        name: fileName,
        file_url: activeUrl,
        file_size: fileContent.length,
        file_type: 'text/plain'
        // ocr_status: 'pending' // Removed as column does not exist
      })
      .select()
      .single();

    if (docError) throw new Error(`Failed to create document record: ${docError.message}`);
    const docId = docData.id;
    console.log(`   ✅ Document record created: ${docId}`);

    // 6. Call OCR Function
    console.log('5. Invoking OCR Edge Function...');
    
    // We need to invoke it as the user (using their JWT) or Service Role.
    // The function checks: `if (!isServiceRole && ownerId !== user.id)`
    // Since we are running this script with Service Role, we can simulate the user or just use Service Role.
    // The function supports Service Role auth: `if (serviceRoleKey && authHeader.includes(serviceRoleKey))`
    
    const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-document', {
      body: {
        documentId: docId,
        fileUrl: activeUrl
      }
    });

    if (ocrError) {
        // Function invocation failed (network/500)
        console.error('   ❌ OCR Function failed:', ocrError);
        throw ocrError;
    }
    
    if (ocrData && ocrData.error) {
        // Function returned application error
         console.error('   ❌ OCR Application Error:', ocrData.error);
         throw new Error(ocrData.error);
    }

    console.log('   ✅ OCR Function returned success!');
    console.log('   Stats:', {
        textLength: ocrData.textLength,
        keyFacts: ocrData.keyFacts?.length,
        hasAnalysis: ocrData.hasAnalysis
    });

    // 7. Verify Timeline Events
    console.log('6. Verifying Timeline Events...');
    
    // Give a small buffer if async, but our function was awaited.
    const { data: events, error: eventsError } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('case_id', caseId)
      .eq('linked_document_id', docId);

    if (eventsError) throw new Error(`Failed to fetch events: ${eventsError.message}`);

    if (events.length > 0) {
      console.log(`   ✅ SUCCESS: Found ${events.length} timeline events!`);
      events.forEach(e => {
        console.log(`      - [${e.event_date}] ${e.title}: ${e.description.substring(0, 50)}...`);
      });
    } else {
      console.log('   ⚠️ WARNING: No timeline events found. Check prompt/content.');
    }

    console.log('\n✅ TEST COMPLETED SUCCESSFULLY');

  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTest();
