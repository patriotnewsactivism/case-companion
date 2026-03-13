import { supabase } from '@/integrations/supabase/client';
import { QueueManager } from '../queue-manager';
import { hashFile } from '../hashing';

export interface UploadResult {
  fileId: string;
  storagePath: string;
  queueJobIds: string[];
  contentHash: string;
}

export async function uploadAndProcessFile(
  file: File,
  caseId: string,
  userId: string,
  organizationId?: string,
  metadata?: Record<string, any>
): Promise<UploadResult> {
  const contentHash = await hashFile(file);
  
  // 1. Upload to Supabase Storage
  const storagePath = `cases/${caseId}/${contentHash}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(storagePath, file, { upsert: true });
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  
  // 2. Create document record in database
  const { data: docRecord, error: dbError } = await supabase
    .from('documents')
    .insert({
      case_id: caseId,
      user_id: userId,
      organization_id: organizationId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      content_hash: contentHash,
      status: 'queued',
      ...metadata,
    })
    .select('id')
    .single();
  
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
  });
  
  return {
    fileId: docRecord.id,
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
  onProgress?: (completed: number, total: number, fileName: string) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length, files[i].name);
    try {
      const result = await uploadAndProcessFile(files[i], caseId, userId, organizationId);
      results.push(result);
    } catch (e) {
      console.error(`Failed to upload ${files[i].name}:`, e);
      // Continue with other files — don't let one failure stop the batch
    }
  }
  
  onProgress?.(files.length, files.length, 'Complete');
  return results;
}
