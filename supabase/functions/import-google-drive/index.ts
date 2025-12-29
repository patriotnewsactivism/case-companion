import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  folderId: string;
  folderName: string;
  folderPath: string;
  caseId: string;
  accessToken: string; // Google Drive OAuth access token
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  parents?: string[];
  webContentLink?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { folderId, folderName, folderPath, caseId, accessToken }: ImportRequest = await req.json();

    // Create import job record
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        case_id: caseId,
        user_id: user.id,
        source_type: 'google_drive',
        source_folder_id: folderId,
        source_folder_name: folderName,
        source_folder_path: folderPath,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      throw jobError;
    }

    console.log(`Created import job ${importJob.id} for folder ${folderId}`);

    // Start background processing (don't await - respond immediately)
    processGoogleDriveFolder(
      supabase,
      importJob.id,
      folderId,
      folderPath,
      caseId,
      user.id,
      accessToken
    ).catch(async (error) => {
      console.error('Import job failed:', error);
      await supabase
        .from('import_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importJob.id);
    });

    return new Response(
      JSON.stringify({
        success: true,
        importJobId: importJob.id,
        message: 'Import started. You can monitor progress in the import jobs section.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in import-google-drive function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Recursively process all files in a Google Drive folder
 */
async function processGoogleDriveFolder(
  supabase: any,
  importJobId: string,
  folderId: string,
  currentPath: string,
  caseId: string,
  userId: string,
  accessToken: string
): Promise<void> {
  const stats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    failedFiles: [] as Array<{ filename: string; error: string }>,
  };

  // Recursively collect all files from folder and subfolders
  const allFiles = await collectAllFiles(folderId, currentPath, accessToken);
  stats.total = allFiles.length;

  console.log(`Found ${stats.total} files in folder ${folderId}`);

  // Update job with total count
  await supabase
    .from('import_jobs')
    .update({ total_files: stats.total })
    .eq('id', importJobId);

  // Process files in batches to avoid overwhelming the system
  const BATCH_SIZE = 5;
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (file) => {
        try {
          await processFile(supabase, file, caseId, userId, accessToken, importJobId);
          stats.successful++;
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
          stats.failed++;
          stats.failedFiles.push({
            filename: file.name,
            error: error.message,
          });
        } finally {
          stats.processed++;

          // Update progress every file
          await supabase
            .from('import_jobs')
            .update({
              processed_files: stats.processed,
              successful_files: stats.successful,
              failed_files: stats.failed,
              failed_file_details: stats.failedFiles,
            })
            .eq('id', importJobId);
        }
      })
    );
  }

  // Mark job as completed
  await supabase
    .from('import_jobs')
    .update({
      status: stats.failed === stats.total ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', importJobId);

  console.log(`Import job ${importJobId} completed: ${stats.successful}/${stats.total} successful`);
}

/**
 * Recursively collect all files from a folder and its subfolders
 */
async function collectAllFiles(
  folderId: string,
  currentPath: string,
  accessToken: string
): Promise<Array<DriveFile & { path: string }>> {
  const files: Array<DriveFile & { path: string }> = [];
  const foldersToProcess: Array<{ id: string; path: string }> = [{ id: folderId, path: currentPath }];

  // Supported MIME types
  const supportedMimeTypes = new Set([
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Audio
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/x-m4a',
    // Video
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
    'video/3gpp',
    'video/x-flv',
  ]);

  while (foldersToProcess.length > 0) {
    const { id: currentFolderId, path } = foldersToProcess.shift()!;

    // List all items in current folder
    let pageToken: string | undefined;
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `'${currentFolderId}' in parents and trashed=false`);
      url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,parents,webContentLink)');
      url.searchParams.set('pageSize', '100');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.statusText}`);
      }

      const data = await response.json();

      for (const item of data.files || []) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Add subfolder to processing queue
          foldersToProcess.push({
            id: item.id,
            path: `${path}/${item.name}`,
          });
        } else if (supportedMimeTypes.has(item.mimeType)) {
          // Add file to results
          files.push({
            ...item,
            path: `${path}/${item.name}`,
          });
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  return files;
}

/**
 * Process a single file: download, upload to Supabase, create document record
 */
async function processFile(
  supabase: any,
  file: DriveFile & { path: string },
  caseId: string,
  userId: string,
  accessToken: string,
  importJobId: string
): Promise<void> {
  console.log(`Processing file: ${file.name} (${file.mimeType})`);

  // Download file from Google Drive
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const fileBlob = await response.blob();

  // Determine media type
  let mediaType = 'document';
  if (file.mimeType.startsWith('audio/')) {
    mediaType = 'audio';
  } else if (file.mimeType.startsWith('video/')) {
    mediaType = 'video';
  } else if (file.mimeType.startsWith('image/')) {
    mediaType = 'image';
  }

  // Generate storage path
  const fileExtension = file.name.split('.').pop() || '';
  const timestamp = Date.now();
  const storagePath = `${userId}/${caseId}/${timestamp}.${fileExtension}`;

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(storagePath, fileBlob, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('case-documents')
    .getPublicUrl(storagePath);

  // Create document record
  const { error: docError } = await supabase.from('documents').insert({
    case_id: caseId,
    user_id: userId,
    name: file.name,
    file_url: urlData.publicUrl,
    file_type: file.mimeType,
    file_size: parseInt(file.size || '0'),
    media_type: mediaType,
    drive_file_id: file.id,
    drive_file_path: file.path,
    import_job_id: importJobId,
  });

  if (docError) {
    throw new Error(`Failed to create document record: ${docError.message}`);
  }

  console.log(`Successfully processed: ${file.name}`);
}
