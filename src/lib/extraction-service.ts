import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import JSZip from 'jszip';

export interface ExtractionResult {
  text: string;
  metadata: {
    fileType: string;
    fileName?: string;
    pageCount?: number;
    wordCount: number;
    charCount: number;
    isScanned?: boolean;
    tables?: unknown[];
  };
}

export interface ExtractionOptions {
  maxFileSize?: number;
  extractTables?: boolean;
  preserveFormatting?: boolean;
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'message/rfc822': 'email',
  'application/vnd.ms-outlook': 'email',
} as const;

export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'doc',
  '.txt': 'txt',
  '.csv': 'csv',
  '.json': 'json',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.rtf': 'rtf',
  '.zip': 'zip',
  '.eml': 'email',
  '.msg': 'email',
};

export function detectFileType(fileName: string, mimeType?: string): string | null {
  if (mimeType && SUPPORTED_MIME_TYPES[mimeType as keyof typeof SUPPORTED_MIME_TYPES]) {
    return SUPPORTED_MIME_TYPES[mimeType as keyof typeof SUPPORTED_MIME_TYPES];
  }

  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS[extension] || null;
}

export async function extractText(
  file: File | Blob,
  fileName: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const maxSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
  
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
  }

  const mimeType = (file as File).type;
  const fileType = detectFileType(fileName, mimeType);

  if (!fileType) {
    throw new Error(`Unsupported file type: ${fileName}`);
  }

  let text = '';
  let metadata: ExtractionResult['metadata'] = {
    fileType,
    fileName,
    wordCount: 0,
    charCount: 0,
  };

  switch (fileType) {
    case 'pdf': {
      const pdfResult = await extractPdf(file, options);
      text = pdfResult.text;
      metadata = { ...metadata, ...pdfResult.metadata };
      break;
    }
    case 'docx':
      text = await extractDocx(file);
      break;
    case 'doc':
      text = await extractDocx(file);
      break;
    case 'txt':
      text = await file.text();
      break;
    case 'csv':
      text = await extractCsv(file);
      break;
    case 'json':
      text = await extractJson(file);
      break;
    case 'xml':
      text = await extractXml(file);
      break;
    case 'html':
      text = await extractHtml(file);
      break;
    case 'rtf':
      text = await extractRtf(file);
      break;
    case 'zip': {
      const zipResult = await extractZip(file, options);
      text = zipResult.text;
      metadata = { ...metadata, ...zipResult.metadata };
      break;
    }
    case 'email':
      text = await extractEmail(file);
      break;
    default:
      throw new Error(`Extraction not implemented for type: ${fileType}`);
  }

  text = normalizeText(text);
  metadata.wordCount = countWords(text);
  metadata.charCount = text.length;

  return { text, metadata };
}

async function extractPdf(file: Blob, options: ExtractionOptions): Promise<{ text: string; metadata: Partial<ExtractionResult['metadata']> }> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const textContent = tryExtractPdfText(uint8Array);
  
  if (!textContent || textContent.trim().length < 50) {
    return {
      text: '',
      metadata: { isScanned: true },
    };
  }

  return {
    text: textContent,
    metadata: { isScanned: false },
  };
}

function tryExtractPdfText(data: Uint8Array): string {
  const textParts: string[] = [];
  const decoder = new TextDecoder('utf-8', { fatal: false });
  
  for (let i = 0; i < data.length - 6; i++) {
    if (
      data[i] === 0x73 && data[i + 1] === 0x74 && 
      data[i + 2] === 0x72 && data[i + 3] === 0x65 && 
      data[i + 4] === 0x61 && data[i + 5] === 0x6D
    ) {
      let end = i + 6;
      while (end < data.length && !(data[end] === 0x65 && data[end + 1] === 0x6E && data[end + 2] === 0x64 && data[end + 3] === 0x73 && data[end + 4] === 0x74 && data[end + 5] === 0x72 && data[end + 6] === 0x65 && data[end + 7] === 0x61 && data[end + 8] === 0x6D)) {
        end++;
      }
      
      if (end < data.length) {
        const streamContent = data.slice(i + 6, end);
        let text = decoder.decode(streamContent);
        
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\(([^)]*)\)/g, '$1')
          .replace(/<[^>]*>/g, '')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (text.length > 10) {
          textParts.push(text);
        }
      }
    }
  }
  
  return textParts.join('\n');
}

async function extractDocx(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractCsv(file: Blob): Promise<string> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  return lines.map(line => line.trim()).join('\n');
}

async function extractJson(file: Blob): Promise<string> {
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    return jsonToText(parsed);
  } catch {
    return text;
  }
}

function jsonToText(obj: unknown, depth = 0): string {
  if (depth > 10) return '[nested content]';
  
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (obj === null) return 'null';
  
  if (Array.isArray(obj)) {
    return obj.map(item => jsonToText(item, depth + 1)).join('\n');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    return entries.map(([key, value]) => {
      const valueStr = jsonToText(value, depth + 1);
      if (valueStr.includes('\n')) {
        return `${key}:\n${valueStr.split('\n').map(l => '  ' + l).join('\n')}`;
      }
      return `${key}: ${valueStr}`;
    }).join('\n');
  }
  
  return '';
}

async function extractXml(file: Blob): Promise<string> {
  const text = await file.text();
  return text
    .replace(/<\?[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractHtml(file: Blob): Promise<string> {
  const html = await file.text();
  const clean = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return clean.replace(/\s+/g, ' ').trim();
}

async function extractRtf(file: Blob): Promise<string> {
  const text = await file.text();
  return text
    .replace(/\\[a-z]+\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\\\\/g, '\\')
    .replace(/\\'/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractZip(file: Blob, options: ExtractionOptions): Promise<{ text: string; metadata: Partial<ExtractionResult['metadata']> }> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const results: string[] = [];
  let totalFiles = 0;
  
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    
    const fileType = detectFileType(relativePath);
    if (!fileType) continue;
    
    totalFiles++;
    
    try {
      const content = await zipEntry.async('blob');
      const result = await extractText(content, relativePath, options);
      results.push(`=== ${relativePath} ===\n${result.text}`);
    } catch (error) {
      console.warn(`Failed to extract ${relativePath}:`, error);
    }
  }
  
  return {
    text: results.join('\n\n'),
    metadata: { pageCount: totalFiles },
  };
}

async function extractEmail(file: Blob): Promise<string> {
  const text = await file.text();
  const lines: string[] = [];
  
  const headers = ['From:', 'To:', 'Subject:', 'Date:', 'Cc:', 'Bcc:'];
  let inBody = false;
  
  for (const line of text.split(/\r?\n/)) {
    if (inBody) {
      lines.push(line);
    } else if (line.trim() === '') {
      inBody = true;
    } else {
      for (const header of headers) {
        if (line.startsWith(header)) {
          lines.push(line);
          break;
        }
      }
    }
  }
  
  return lines.join('\n');
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, '-');
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

export function isScannedPdf(text: string, metadata?: ExtractionResult['metadata']): boolean {
  if (metadata?.isScanned !== undefined) {
    return metadata.isScanned;
  }
  
  const wordCount = countWords(text);
  const charCount = text.length;
  
  if (charCount < 100) return true;
  
  const wordLengthRatio = charCount / Math.max(wordCount, 1);
  if (wordLengthRatio > 10) return true;
  
  const printableRatio = text.replace(/[\x20-\x7E\n\r\t]/g, '').length / charCount;
  if (printableRatio > 0.3) return true;
  
  return false;
}

export function createExtractionSummary(result: ExtractionResult): string {
  const { text, metadata } = result;
  const lines = [
    `File Type: ${metadata.fileType}`,
    `Character Count: ${metadata.charCount.toLocaleString()}`,
    `Word Count: ${metadata.wordCount.toLocaleString()}`,
  ];
  
  if (metadata.pageCount) {
    lines.push(`Pages/Files: ${metadata.pageCount}`);
  }
  
  if (metadata.isScanned !== undefined) {
    lines.push(`Scanned Document: ${metadata.isScanned ? 'Yes' : 'No'}`);
  }
  
  if (text.length > 0) {
    const preview = text.substring(0, 200).replace(/\n/g, ' ');
    lines.push(`Preview: ${preview}${text.length > 200 ? '...' : ''}`);
  }
  
  return lines.join('\n');
}
