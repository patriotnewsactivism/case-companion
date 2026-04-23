import { supabase } from '@/integrations/supabase/client';
import { QueueManager } from '../queue-manager';

export interface UploadResult {
  fileId: string;
  document: Record<string, unknown>;
  storagePath: string;
  queueJobIds: string[];
}

export async function uploadAndProcessFile(
  file: File,
  caseId: string,
  userId: string,
  organizationId?: string,
  metadata?: Record<string, unknown>,
  priority?: number
): Promise<UploadResult> {
  // Use timestamp-based path — no full-file read needed
  const storagePath = `${userId}/${caseId}/${Date.now()}-${file.name}`;

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await (supabase as any).storage
    .from('case-documents')
    .upload(storagePath, file, { upsert: true });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: publicData } = (supabase as any).storage
    .from('case-documents')
    .getPublicUrl(storagePath);

  // 2. Create document record
  const documentName = typeof metadata?.name === 'string' ? metadata.name : file.name;
  const batesNumber = typeof metadata?.bates_number === 'string' ? metadata.bates_number : null;

  const { data: docRecord, error: dbError } = await (supabase as any)
    .from('documents')
    .insert({
      case_id: caseId,
      user_id: userId,
      name: documentName,
      file_type: file.type,
      file_size: file.size,
      file_url: publicData.publicUrl,
      bates_number: batesNumber,
    })
    .select('*')
    .single();

  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);

  // 3. Enqueue for processing (non-fatal — a queue failure won't block the upload)
  const jobIds = await QueueManager.enqueueFile({
    fileId: docRecord.id,
    caseId,
    userId,
    organizationId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    storagePath,
    priority,
  });

  return {
    fileId: docRecord.id,
    document: docRecord,
    storagePath,
    queueJobIds: jobIds,
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
    }
  }

  onProgress?.(files.length, files.length, 'Complete');
  return results;
}
