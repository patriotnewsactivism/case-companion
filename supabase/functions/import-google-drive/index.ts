import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  withErrorHandling,
  checkRateLimit,
} from '../_shared/errorHandler.ts';

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

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  console.log('import-google-drive: Request received', {
    method: req.method,
    url: req.url,
    hasAuth: !!req.headers.get('Authorization'),
  });

  // Validate environment variables
  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);
  } catch (error) {
    console.error('Environment validation failed:', error);
    return createErrorResponse(error, 500, 'import-google-drive', corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );
  const authHeader = req.headers.get('Authorization') || '';

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'User authentication required' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Rate limiting: max 5 imports per minute per user
  const rateLimitCheck = checkRateLimit(`import:${user.id}`, 5, 60000);
  if (!rateLimitCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many import requests. Please wait before starting another import.',
        retryAfter: Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // Parse and validate request body
  let requestBody: Record<string, unknown>;
  try {
    requestBody = (await req.json()) as Record<string, unknown>;
  } catch (error) {
    return createErrorResponse(
      new Error('Invalid JSON in request body'),
      400,
      'import-google-drive',
      corsHeaders
    );
  }

  // Validate required fields
  try {
    validateRequestBody<ImportRequest>(requestBody, [
      'folderId',
      'folderName',
      'folderPath',
      'caseId',
      'accessToken',
    ]);
  } catch (error) {
    return createErrorResponse(
      error,
      400,
      'import-google-drive',
      corsHeaders
    );
  }

  const { folderId, folderName, folderPath, caseId, accessToken } = requestBody as ImportRequest;

  // Validate case access
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('user_id', user.id)
    .single();

  if (caseError || !caseData) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Case not found or access denied',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create import job record
  const { data: importJob, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      case_id: caseId,
      user_id: user.id,
      source_folder_id: folderId,
      source_folder_name: folderName,
      source_folder_path: folderPath,
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError) {
    console.error('Failed to create import job:', jobError);
    return createErrorResponse(
      new Error(`Failed to create import job: ${jobError.message}`),
      500,
      'import-google-drive',
      corsHeaders
    );
  }

  console.log(`Created import job ${importJob.id} for folder ${folderId} (user: ${user.id})`);

  // Start background processing (don't await - respond immediately)
  processGoogleDriveFolder(
    supabase,
    importJob.id,
    folderId,
    folderPath,
    caseId,
    user.id,
    accessToken,
    authHeader
  ).catch(async (error) => {
    console.error(`Import job ${importJob.id} failed:`, error);
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
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
      status: 202, // Accepted
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
};

serve(withErrorHandling(handler, 'import-google-drive'));

/**
 * Recursively process all files in a Google Drive folder
 */
async function processGoogleDriveFolder(
  supabase: SupabaseClient,
  importJobId: string,
  folderId: string,
  currentPath: string,
  caseId: string,
  userId: string,
  accessToken: string,
  authHeader: string
): Promise<void> {
  const stats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    failedFiles: [] as Array<{ filename: string; error: string }>,
  };

  try {
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
    const BATCH_SIZE = 3; // Reduced from 5 for better stability
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);

      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(allFiles.length / BATCH_SIZE)}: ${batch.length} files`);
      
      await Promise.all(
        batch.map(async (file) => {
          try {
            await processFile(supabase, file, caseId, userId, accessToken, importJobId, authHeader);
            stats.successful++;
          } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            stats.failed++;
            stats.failedFiles.push({
              filename: file.name,
              error: error instanceof Error ? error.message : 'Unknown error',
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
      
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} completed. Processed ${stats.processed}/${stats.total} files`);
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
  } catch (error) {
    console.error(`Fatal error in import job ${importJobId}:`, error);
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', importJobId);
    throw error;
  }
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
  const foldersToProcess: Array<{ id: string; path: string; depth: number }> = [
    { id: folderId, path: currentPath, depth: 0 },
  ];

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

  const MAX_FILES = 1000; // Safety limit
  const MAX_DEPTH = 10; // Safety limit for folder depth

  while (foldersToProcess.length > 0) {
    const { id: currentFolderId, path, depth } = foldersToProcess.shift()!;
    if (depth > MAX_DEPTH) {
      console.warn(`Reached maximum folder depth (${MAX_DEPTH}). Skipping ${path}.`);
      continue;
    }

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
        const errorText = await response.text();
        throw new Error(`Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      for (const item of data.files || []) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Add subfolder to processing queue
          if (depth + 1 > MAX_DEPTH) {
            console.warn(`Reached maximum folder depth (${MAX_DEPTH}). Skipping ${path}/${item.name}.`);
          } else {
            foldersToProcess.push({
              id: item.id,
              path: `${path}/${item.name}`,
              depth: depth + 1,
            });
          }
        } else if (supportedMimeTypes.has(item.mimeType)) {
          // Add file to results
          files.push({
            ...item,
            path: `${path}/${item.name}`,
          });

          // Safety check
          if (files.length >= MAX_FILES) {
            console.warn(`Reached maximum file limit (${MAX_FILES}). Stopping collection.`);
            return files;
          }
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  return files;
}

/**
 * Process a single file: download, upload to Supabase, create document record, trigger OCR
 */
async function processFile(
  supabase: SupabaseClient,
  file: DriveFile & { path: string },
  caseId: string,
  userId: string,
  accessToken: string,
  importJobId: string,
  authHeader: string
): Promise<void> {
  console.log(`Processing file: ${file.name} (${file.mimeType})`);

  // File size limit: 100MB
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const fileSize = parseInt(file.size || '0');

  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max 100MB)`);
  }

  // Download file from Google Drive with timeout
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const fileBlob = await response.blob();
    const arrayBuffer = await fileBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Generate storage path
    const storagePath = `cases/${caseId}/${contentHash}/${file.name}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('case-documents')
      .upload(storagePath, fileBlob, {
        contentType: file.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('case-documents')
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Create document record
    const { data: docData, error: docError } = await supabase.from('documents').insert({
      case_id: caseId,
      user_id: userId,
      name: file.name,
      file_url: fileUrl,
      file_type: file.mimeType,
      file_size: fileSize,
      storage_path: storagePath,
      content_hash: contentHash,
      status: 'queued',
    }).select().single();

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    // Determine processing types
    const processingTypes = [];
    const mime = file.mimeType.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (mime === 'application/pdf' || ext === 'pdf') {
      processingTypes.push('text_extraction', 'ai_analysis');
    } else if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp'].includes(ext)) {
      processingTypes.push('ocr', 'ai_analysis');
    } else if (['docx', 'doc', 'rtf', 'odt'].includes(ext) || mime.includes('word') || mime.includes('document')) {
      processingTypes.push('text_extraction', 'ai_analysis');
    } else if (mime.startsWith('audio/') || mime.startsWith('video/') || ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      processingTypes.push('transcription', 'ai_analysis');
    } else if (['eml', 'msg'].includes(ext) || mime === 'message/rfc822') {
      processingTypes.push('email_parse', 'ai_analysis');
    } else if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
      processingTypes.push('text_extraction', 'ai_analysis');
    } else if (['txt', 'md', 'json', 'xml', 'html'].includes(ext) || mime.startsWith('text/')) {
      processingTypes.push('text_extraction', 'ai_analysis');
    } else {
      processingTypes.push('text_extraction', 'ai_analysis');
    }

    // Insert into processing queue
    for (const procType of processingTypes) {
      await supabase.from('processing_queue').insert({
        file_id: docData.id,
        case_id: caseId,
        user_id: userId,
        processing_type: procType,
        status: 'pending',
        priority: 5,
        content_hash: contentHash,
        file_name: file.name,
        file_type: file.mimeType,
        file_size_bytes: fileSize,
        storage_path: storagePath,
      });
    }

    console.log(`✅ Successfully queued: ${file.name}`);
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}
