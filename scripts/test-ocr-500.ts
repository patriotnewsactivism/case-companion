import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  process.exit(1);
}

async function testOcrFunction() {
  const url = `${SUPABASE_URL}/functions/v1/ocr-document`;
  console.log(`Calling OCR function: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        documentId: '00000000-0000-0000-0000-000000000000',
        fileUrl: 'https://example.com/test.pdf'
      })
    });

    console.log(`Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response: ${text}`);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testOcrFunction().catch(console.error);
