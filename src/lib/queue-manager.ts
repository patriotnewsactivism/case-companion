// Queue manager that handles all document processing through the durable queue
import { supabase } from '@/integrations/supabase/client';

export class QueueManager {
  static async enqueueFile(params: {
    fileId: string;
    caseId: string;
    userId: string;
    organizationId?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    file?: File;
    priority?: number;
  }): Promise<string[]> {
    const jobIds: string[] = [];
    const processingTypes = this.determineProcessingTypes(params.fileType, params.fileName);

    for (const procType of processingTypes) {
      try {
        const { data, error } = await (supabase as any)
          .from('processing_queue')
          .insert({
            document_id: params.fileId,
            case_id: params.caseId,
            user_id: params.userId,
            job_type: procType,
            status: 'pending',
            priority: params.priority ?? 5,
            payload: {
              fileName: params.fileName,
              fileType: params.fileType,
              fileSizeBytes: params.fileSize,
              storagePath: params.storagePath,
              organizationId: params.organizationId,
            },
          })
          .select('id')
          .single();

        if (error) {
          // Log but don't throw — a queue failure should never block the upload
          console.warn(`Queue insert warning (${procType}):`, error.message);
        } else if (data) {
          jobIds.push(data.id);
        }
      } catch (err) {
        console.warn(`Queue enqueue failed for ${procType}:`, err);
      }
    }

    return jobIds;
  }

  static determineProcessingTypes(fileType: string, fileName: string): string[] {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = fileType.toLowerCase();

    if (mime === 'application/pdf' || ext === 'pdf') {
      return ['text_extraction', 'ai_analysis'];
    }
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp'].includes(ext)) {
      return ['ocr', 'ai_analysis'];
    }
    if (['docx', 'doc', 'rtf', 'odt'].includes(ext) || mime.includes('word') || mime.includes('document')) {
      return ['text_extraction', 'ai_analysis'];
    }
    if (mime.startsWith('audio/') || mime.startsWith('video/') ||
        ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      return ['transcription', 'ai_analysis'];
    }
    if (['eml', 'msg'].includes(ext) || mime === 'message/rfc822') {
      return ['email_parse', 'ai_analysis'];
    }
    if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
      return ['text_extraction', 'ai_analysis'];
    }
    if (['txt', 'md', 'json', 'xml', 'html'].includes(ext) || mime.startsWith('text/')) {
      return ['text_extraction', 'ai_analysis'];
    }
    return ['text_extraction', 'ai_analysis'];
  }

  static async getQueueStatus(caseId: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const { data } = await (supabase as any)
      .from('processing_queue')
      .select('status')
      .eq('case_id', caseId);

    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    data?.forEach((item: { status: string }) => {
      if (item.status === 'pending' || item.status === 'retrying') counts.pending++;
      else if (item.status === 'processing') counts.processing++;
      else if (item.status === 'completed') counts.completed++;
      else if (item.status === 'failed') counts.failed++;
    });
    return counts;
  }
}
