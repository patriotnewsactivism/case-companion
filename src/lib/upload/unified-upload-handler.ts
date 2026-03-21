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

export async function uploadAndProcessFile(
  file: File,
  caseId: string,
  userId: string,
  organizationId?: string,
  metadata?: Record<string, unknown>,
  priority?: number
): Promise<UploadResult> {
  const contentHash = await hashFile(file);

  // 1. Upload to Supabase Storage using the canonical contract
  // expected by storage RLS: cases/{caseId}/{contentHash}/{file.name}.
  // Access is authorized from the case ownership relationship, not a user-id folder prefix.
  const storagePath = `cases/${caseId}/${contentHash}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(storagePath, file, { upsert: true });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: publicData } = supabase.storage
    .from('case-documents')
    .getPublicUrl(storagePath);

  // 2. Create document record in database
  // Use the stable schema used by the app's documents table.
  const documentName = typeof metadata?.name === "string" ? metadata.name : file.name;
  const batesNumber = typeof metadata?.bates_number === "string" ? metadata.bates_number : null;

  const { data: docRecord, error: dbError } = await supabase
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
