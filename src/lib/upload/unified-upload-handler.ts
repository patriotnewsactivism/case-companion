import { supabase } from '@/integrations/supabase/client';
import { QueueManager } from '../queue-manager';

export interface UploadResult {
  fileId: string;
  document: Record<string, unknown>;
  storagePath: string;
  queueJobIds: string[];
  contentHash: string | null;
}

/**
 * Compute a SHA-256 hash of the file contents (used for dedup / cache).
 * Returns null on environments where SubtleCrypto isn't available — the
 * upload still proceeds without dedup.
 */
async function computeContentHash(file: File): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    // For very large files (>200MB) skip hashing — the cost outweighs the benefit
    if (file.size > 200 * 1024 * 1024) return null;
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function sanitizeFileName(name: string): string {
  // Strip path separators and characters that break Supabase storage keys.
  return name.replace(/[\\/]/g, '_').replace(/[^\w.\-() ]+/g, '_');
}

export async function uploadAndProcessFile(
  file: File,
  caseId: string,
  userId: string,
  organizationId?: string,
  metadata?: Record<string, unknown>,
  priority?: number
): Promise<UploadResult> {
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${userId}/${caseId}/${Date.now()}-${safeName}`;

  // 1. Upload to Supabase Storage (bucket is public; public URL works)
  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage
    .from('case-documents')
    .getPublicUrl(storagePath);

  // 2. Create document record
  const documentName = typeof metadata?.name === 'string' ? metadata.name : file.name;
  const batesNumber = typeof metadata?.bates_number === 'string' ? metadata.bates_number : null;
  const contentHash = await computeContentHash(file);

  const { data: docRecord, error: dbError } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> };
      };
    };
  })
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

  if (dbError || !docRecord) {
    throw new Error(`DB insert failed: ${dbError?.message ?? 'unknown error'}`);
  }

  // 3. Enqueue for processing (non-fatal — a queue failure won't block the upload)
  let jobIds: string[] = [];
  try {
    jobIds = await QueueManager.enqueueFile({
      fileId: docRecord.id as string,
      caseId,
      userId,
      organizationId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath,
      priority,
    });
  } catch (e) {
    console.warn('Queue enqueue failed (non-fatal):', e);
  }

  return {
    fileId: docRecord.id as string,
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
      const result = await uploadAndProcessFile(
        files[i],
        caseId,
        userId,
        organizationId,
        undefined,
        priority
      );
      results.push(result);
    } catch (e) {
      console.error(`Failed to upload ${files[i].name}:`, e);
    }
  }

  onProgress?.(files.length, files.length, 'Complete');
  return results;
}
