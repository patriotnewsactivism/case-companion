import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://rerbrlrxptnusypzpghj.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createBucket() {
  console.log('Checking if case-documents bucket exists...');

  // List all buckets
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError);
    Deno.exit(1);
  }

  console.log('Existing buckets:', buckets.map(b => b.id));

  const existingBucket = buckets.find(b => b.id === 'case-documents');

  if (existingBucket) {
    console.log('Bucket already exists:', existingBucket);
    return;
  }

  console.log('Creating case-documents bucket...');

  const { data, error } = await supabase.storage.createBucket('case-documents', {
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/mp4',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo'
    ]
  });

  if (error) {
    console.error('Error creating bucket:', error);
    Deno.exit(1);
  }

  console.log('Bucket created successfully:', data);
}

await createBucket();
