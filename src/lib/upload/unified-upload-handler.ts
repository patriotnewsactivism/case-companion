import { supabase } from '@/integrations/supabase/client';
import { QueueManager } from '../queue-manager';
import { hashFile } from '../hashing';

export interface UploadResult {
  fileId: string;
  document: Record<string, unknown>;
  storagePath: string;
  queueJobIds: string[];
  contentHash: string;
}

function isMissingDocumentsContentHashColumn(errorMessage: string): boolean {
  return (
    errorMessage.includes("Could not find the 'content_hash' column") &&
    errorMessage.includes("'documents'")
  );
}

export function shouldRetryDocumentInsertWithoutContentHash(errorMessage: string): boolean {
  return isMissingDocumentsContentHashColumn(errorMessage);
}

export async function uploadAndProcessFile(
  file: File,
  caseId: string,
  userId: string,
  organizationId?: string,
  metadata?: Record<string, unknown>,
  priority?: number
): Promise<UploadResult> {
  const contentHash = await hashFile(file);
  
  // 1. Upload to Supabase Storage
  const storagePath = `cases/${caseId}/${contentHash}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(storagePath, file, { upsert: true });
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  
  // 2. Create document record in database
  const baseDocumentPayload = {
    case_id: caseId,
    user_id: userId,
    organization_id: organizationId,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_path: storagePath,
    status: 'queued',
    ...metadata,
  };

  const { data: docRecordWithHash, error: dbErrorWithHash } = await supabase
    .from('documents')
    .insert({
      ...baseDocumentPayload,
      content_hash: contentHash,
    })
    .select('*')
    .single();

  let docRecord = docRecordWithHash;
  let dbError = dbErrorWithHash;

  if (dbError && shouldRetryDocumentInsertWithoutContentHash(dbError.message)) {
    const { data: docRecordWithoutHash, error: dbErrorWithoutHash } = await supabase
      .from('documents')
      .insert(baseDocumentPayload)
      .select('*')
      .single();

    docRecord = docRecordWithoutHash;
    dbError = dbErrorWithoutHash;
  }
  
  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);
  
  // 3. Enqueue for processing
  const jobIds = await QueueManager.enqueueFile({
    fileId: docRecord.id,
    caseId,
    userId,
    organizationId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    storagePath,
    file,
    priority,
  });
  
  return {
    fileId: docRecord.id,
    document: docRecord,
    storagePath,
    queueJobIds: jobIds,
    contentHash,
  };
}

export async function uploadMultipleFiles(
  files: File[],
  caseId: string,
  userId: string,
  organizationId?: string,
  onProgress?: (completed: number, total: number, fileName: string) => void,
  priority?: number
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length, files[i].name);
    try {
      const result = await uploadAndProcessFile(files[i], caseId, userId, organizationId, undefined, priority);
      results.push(result);
    } catch (e) {
      console.error(`Failed to upload ${files[i].name}:`, e);
      // Continue with other files — don't let one failure stop the batch
    }
  }
  
  onProgress?.(files.length, files.length, 'Complete');
  return results;
}
