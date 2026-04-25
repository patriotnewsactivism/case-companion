// Extract text from digital PDFs WITHOUT OCR
// This skips OCR entirely for 60%+ of PDFs that have embedded text layers

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs';

export interface PDFTextResult {
  text: string;
  pageCount: number;
  hasTextLayer: boolean;
  provider: 'pdf_text_layer';
}

export async function extractPDFText(file: File | Blob): Promise<PDFTextResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  const pageCount = pdf.numPages;
  
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }
  
  const cleanText = fullText.trim();
  const hasTextLayer = cleanText.length > 100; // Meaningful text threshold
  
  return {
    text: cleanText,
    pageCount,
    hasTextLayer,
    provider: 'pdf_text_layer',
  };
}
