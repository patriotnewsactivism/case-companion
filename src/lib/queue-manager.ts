// Queue manager that handles all document processing through the durable queue
// EVERY file upload must go through this — never process directly

import { supabase } from '@/integrations/supabase/client';
import { hashFile } from './hashing';

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
    file: File;
    priority?: number;
  }): Promise<string[]> {
    const contentHash = await hashFile(params.file);
    const jobIds: string[] = [];
    
    // Determine what processing this file needs
    const processingTypes = this.determineProcessingTypes(params.fileType, params.fileName);
    
    for (const procType of processingTypes) {
      const { data, error } = await supabase
        .from('processing_queue')
        .insert({
          file_id: params.fileId,
          case_id: params.caseId,
          user_id: params.userId,
          organization_id: params.organizationId,
          processing_type: procType,
          status: 'pending',
          priority: params.priority ?? 5,
          content_hash: contentHash,
          file_name: params.fileName,
          file_type: params.fileType,
          file_size_bytes: params.fileSize,
          storage_path: params.storagePath,
        })
        .select('id')
        .single();
      
      if (data) jobIds.push(data.id);
    }
    
    return jobIds;
  }
  
  static determineProcessingTypes(fileType: string, fileName: string): string[] {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = fileType.toLowerCase();
    
    // PDF: try text extraction first, then OCR if needed, then AI analysis
    if (mime === 'application/pdf' || ext === 'pdf') {
      return ['text_extraction', 'ai_analysis'];
    }
    
    // Images: OCR then AI analysis
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp'].includes(ext)) {
      return ['ocr', 'ai_analysis'];
    }
    
    // Word docs: text extraction then AI analysis
    if (['docx', 'doc', 'rtf', 'odt'].includes(ext) || mime.includes('word') || mime.includes('document')) {
      return ['text_extraction', 'ai_analysis'];
    }
    
    // Audio/Video: transcription then AI analysis
    if (mime.startsWith('audio/') || mime.startsWith('video/') || 
        ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      return ['transcription', 'ai_analysis'];
    }
    
    // Email: parse then AI analysis
    if (['eml', 'msg'].includes(ext) || mime === 'message/rfc822') {
      return ['email_parse', 'ai_analysis'];
    }
    
    // Spreadsheets: text extraction then AI analysis
    if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
      return ['text_extraction', 'ai_analysis'];
    }
    
    // Plain text: just AI analysis
    if (['txt', 'md', 'json', 'xml', 'html'].includes(ext) || mime.startsWith('text/')) {
      return ['text_extraction', 'ai_analysis'];
    }
    
    // Unknown: try text extraction, fall back to OCR
    return ['text_extraction', 'ai_analysis'];
  }
  
  // Enqueue processing for an existing document (already uploaded).
  // Used when manually triggering OCR, transcription, or re-analysis.
  static async enqueueExistingDocument(params: {
    fileId: string;
    caseId: string;
    userId: string;
    fileName: string;
    fileType: string;
    fileSize?: number;
    fileUrl: string;
    processingTypes?: string[];
    priority?: number;
  }): Promise<string[]> {
    const jobIds: string[] = [];

    // Extract storage path from file URL
    const storagePath = this.extractStoragePath(params.fileUrl);

    // Use provided types or auto-detect
    const processingTypes = params.processingTypes ||
      this.determineProcessingTypes(params.fileType, params.fileName);

    for (const procType of processingTypes) {
      const { data, error } = await supabase
        .from('processing_queue')
        .insert({
          file_id: params.fileId,
          case_id: params.caseId,
          user_id: params.userId,
          processing_type: procType,
          status: 'pending',
          priority: params.priority ?? 3,
          file_name: params.fileName,
          file_type: params.fileType,
          file_size_bytes: params.fileSize ?? 0,
          storage_path: storagePath,
        })
        .select('id')
        .single();

      if (data) jobIds.push(data.id);
      if (error) console.error(`Failed to enqueue ${procType} for ${params.fileId}:`, error);
    }

    return jobIds;
  }

  // Trigger the process-queue edge function to start processing enqueued jobs
  static async triggerProcessing(): Promise<void> {
    try {
      await supabase.functions.invoke('process-queue', {
        body: {},
      });
    } catch (e) {
      // Non-fatal — the queue will be picked up on next invocation or cron
      console.warn('Failed to trigger process-queue:', e);
    }
  }

  // Extract storage path from a Supabase public URL
  private static extractStoragePath(fileUrl: string): string {
    if (!fileUrl) return '';
    const marker = '/case-documents/';
    const idx = fileUrl.indexOf(marker);
    if (idx !== -1) {
      return fileUrl.slice(idx + marker.length).split('?')[0];
    }
    // If not a full URL, assume it's already a storage path
    return fileUrl;
  }

  static async getQueueStatus(caseId: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const { data } = await supabase
      .from('processing_queue')
      .select('status')
      .eq('case_id', caseId);
    
    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    data?.forEach(item => {
      if (item.status === 'pending' || item.status === 'retrying') counts.pending++;
      else if (item.status === 'processing') counts.processing++;
      else if (item.status === 'completed') counts.completed++;
      else if (item.status === 'failed') counts.failed++;
    });
    return counts;
  }
}
