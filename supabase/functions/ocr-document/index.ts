import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, validateURL } from '../_shared/validation.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GOOGLE_AI_API_KEY']);

    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') || '';

    let user: any;
    let supabase: any;
    let isServiceRole = false;

    // Check if this is a service role call (internal from import-google-drive)
    if (serviceRoleKey && authHeader.includes(serviceRoleKey)) {
      console.log('Service role authentication detected - internal call');
      isServiceRole = true;
      supabase = createClient(supabaseUrl, serviceRoleKey);
      user = { id: 'service-role' };
    } else {
      // Verify user authentication
      const authResult = await verifyAuth(req);
      if (!authResult.authorized || !authResult.user || !authResult.supabase) {
        return createErrorResponse(
          new Error(authResult.error || 'Unauthorized'),
          401,
          'ocr-document'
        );
      }
      user = authResult.user;
      supabase = authResult.supabase;
    }

    // Rate limiting: 10 OCR operations per minute per user (skip for service role)
    if (!isServiceRole) {
      const rateLimitCheck = checkRateLimit(`ocr:${user.id}`, 10, 60000);
      if (!rateLimitCheck.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Parse and validate request body
    const requestBody = await req.json();
    validateRequestBody(requestBody, ['documentId', 'fileUrl']);

    const documentId = validateUUID(requestBody.documentId, 'documentId');
    const fileUrl = validateURL(requestBody.fileUrl);

    console.log(`Processing OCR for document: ${documentId}`);

    // Verify user owns this document by checking the associated case
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('case_id, name, cases!inner(user_id)')
      .eq('id', documentId)
      .single();

    if (docError || !documentData) {
      console.error('Document not found:', docError);
      return createErrorResponse(
        new Error('Document not found'),
        404,
        'ocr-document'
      );
    }

    // Check if user owns the case (skip for service role)
    if (!isServiceRole && (documentData.cases as any).user_id !== user.id) {
      console.error('User does not own this document');
      return forbiddenResponse(
        'You do not have access to this document',
        corsHeaders
      );
    }

    console.log(`User verified as owner of document ${documentId}: ${documentData.name}`);

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchWithRetry = async (
      url: string,
      options: RequestInit,
      context: string,
      attempts = 3
    ) => {
      let lastError = '';

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const response = await fetch(url, options);
        if (response.ok) return response;

        lastError = await response.text();
        if (attempt < attempts && (response.status === 429 || response.status >= 500)) {
          await delay(attempt * 300);
          continue;
        }
        throw new Error(`${context} failed (${response.status}): ${lastError}`);
      }

      throw new Error(`${context} failed: ${lastError}`);
    };

    const extractGeminiText = (payload: any) => {
      const parts = payload?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return '';
      return parts.map((part: any) => String(part?.text || '')).join('').trim();
    };

    const normalizeExtractedText = (text: string) =>
      text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();

    // Fetch the file content
    const fileResponse = await fetchWithRetry(fileUrl, {}, 'File download');

    const contentType = fileResponse.headers.get('content-type') || '';
    let extractedText = '';

    // Helper function to convert ArrayBuffer to base64 efficiently
    const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      return btoa(binary);
    };

    // For images, use AI vision to extract text
    if (contentType.includes('image') || fileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i)) {
      console.log('Processing image with AI vision...');

      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const mimeType = contentType || 'image/jpeg';
      const sizeInMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);

      console.log(`Image size: ${sizeInMB}MB, MIME: ${mimeType}`);

      const aiResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a professional legal document OCR system. Extract ALL text from this image with maximum accuracy.

EXTRACTION REQUIREMENTS:
1. Extract EVERY word, number, date, signature, stamp, and annotation visible
2. Preserve document structure: headings, paragraphs, lists, tables
3. For tables: use pipe (|) separators and preserve column alignment
4. Include ALL metadata: dates, case numbers, file stamps, Bates numbers, exhibit numbers
5. Preserve legal citations exactly as written (case names, statute numbers, etc.)
6. Include handwritten notes and marginalia if visible
7. Mark unclear text with [UNCLEAR: your best guess]
8. Note document quality issues: [FADED], [SMUDGED], [REDACTED], [WATERMARK], etc.
9. If text is rotated or upside down, still extract it
10. Extract text from headers, footers, and page numbers

OUTPUT FORMAT:
- Plain text only, no markdown formatting
- Preserve original line breaks and paragraph spacing
- Use "---" to separate distinct sections
- Start with any document identifiers found (Bates #, Exhibit #, file #, date)

Extract now:`
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 32768,
              responseMimeType: 'text/plain',
            }
          }),
        },
        'AI image OCR'
      );

      const aiData = await aiResponse.json();
      extractedText = normalizeExtractedText(extractGeminiText(aiData));
      console.log(`Extracted ${extractedText.length} characters from image`);

    } else if (contentType.includes('pdf') || fileUrl.match(/\.pdf$/i)) {
      // For PDFs, use Gemini 2.0 Flash with native PDF support
      console.log('PDF detected - using advanced AI processing...');

      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const sizeInMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);

      console.log(`PDF size: ${sizeInMB}MB`);

      const aiResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a professional legal document OCR system. Extract ALL text from this PDF with maximum accuracy.

EXTRACTION REQUIREMENTS:
1. Process EVERY page of the PDF
2. Extract EVERY word, number, date, signature, stamp, and annotation
3. Preserve document structure: headings, paragraphs, lists, tables
4. For tables: use pipe (|) separators and preserve alignment
5. Include ALL metadata: dates, case numbers, file stamps, Bates numbers, exhibit numbers
6. Preserve legal citations exactly as written
7. Include handwritten notes and marginalia if visible
8. Mark unclear text with [UNCLEAR: best guess]
9. Note document quality issues: [FADED], [SMUDGED], [REDACTED]
10. Extract headers, footers, and page numbers

OUTPUT FORMAT:
- Plain text only, no markdown
- Preserve line breaks and spacing
- Use "=== PAGE X ===" to separate pages
- Use "---" to separate sections within a page
- Start each page with any identifiers (Bates #, page #)

Extract now:`
                  },
                  {
                    inline_data: {
                      mime_type: 'application/pdf',
                      data: base64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 32768,
              responseMimeType: 'text/plain',
            }
          }),
        },
        'AI PDF OCR'
      );

      const aiData = await aiResponse.json();
      extractedText = normalizeExtractedText(extractGeminiText(aiData));
      console.log(`Extracted ${extractedText.length} characters from PDF`);

    } else if (contentType.includes('text') || fileUrl.match(/\.txt$/i)) {
      // For text files, read directly
      extractedText = await fileResponse.text();
      console.log(`Read ${extractedText.length} characters from text file`);
    } else {
      console.log(`Unsupported file type: ${contentType}`);
      extractedText = `[File type ${contentType} - OCR not available for this format]`;
    }

    extractedText = normalizeExtractedText(extractedText);

    const isOcrTarget =
      contentType.includes('image') ||
      contentType.includes('pdf') ||
      fileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|pdf)$/i);

    if (isOcrTarget && extractedText.length < 30) {
      throw new Error(
        'OCR extraction returned too little text. The file may be corrupted, heavily redacted, or require re-upload.'
      );
    }

    // Now use AI to analyze the extracted text and generate legal insights
    let keyFacts: string[] = [];
    let favorableFindings: string[] = [];
    let adverseFindings: string[] = [];
    let actionItems: string[] = [];
    let summary = '';

    if (extractedText && extractedText.length > 50 && !extractedText.startsWith('[File type')) {
      console.log('Analyzing extracted text with AI...');

      const analysisResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an expert legal document analyst specializing in litigation support. Analyze documents with precision and identify strategic insights for case preparation.

Analyze this legal document and provide a JSON response with comprehensive legal analysis.

ANALYSIS REQUIREMENTS:
1. SUMMARY: 2-4 sentence executive summary of the document's content and significance
2. KEY_FACTS: 5-10 specific factual findings (dates, events, statements, numbers)
3. FAVORABLE_FINDINGS: 3-5 findings that could support the case (admissions, favorable testimony, helpful evidence)
4. ADVERSE_FINDINGS: 3-5 findings that could hurt the case (contradictions, damaging statements, weaknesses)
5. ACTION_ITEMS: 3-5 specific follow-up actions (witnesses to interview, documents to request, issues to research)

Be thorough, precise, and strategic. Focus on facts that matter for litigation.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "key_facts": ["fact1", "fact2", ...],
  "favorable_findings": ["finding1", "finding2", ...],
  "adverse_findings": ["finding1", "finding2", ...],
  "action_items": ["action1", "action2", ...]
}

Document text:
${extractedText.substring(0, 20000)}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
            }
          }),
        },
        'AI legal analysis'
      );

      const analysisData = await analysisResponse.json();
      const content = extractGeminiText(analysisData);

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          summary = String(analysis.summary || '').trim();
          keyFacts = Array.isArray(analysis.key_facts) ? analysis.key_facts : [];
          favorableFindings = Array.isArray(analysis.favorable_findings) ? analysis.favorable_findings : [];
          adverseFindings = Array.isArray(analysis.adverse_findings) ? analysis.adverse_findings : [];
          actionItems = Array.isArray(analysis.action_items) ? analysis.action_items : [];
          console.log(`Analysis complete: ${keyFacts.length} facts, ${favorableFindings.length} favorable, ${adverseFindings.length} adverse`);
        }
      } catch (parseError) {
        console.error('Failed to parse analysis JSON:', parseError);
        console.error('Raw content:', content);
        summary = content.substring(0, 500);
      }
    }

    // Update the document with OCR results
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ocr_text: extractedText,
        ocr_processed_at: new Date().toISOString(),
        ai_analyzed: !!summary,
        summary: summary || null,
        key_facts: keyFacts.length > 0 ? keyFacts : null,
        favorable_findings: favorableFindings.length > 0 ? favorableFindings : null,
        adverse_findings: adverseFindings.length > 0 ? adverseFindings : null,
        action_items: actionItems.length > 0 ? actionItems : null,
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document:', updateError);
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log('Document updated successfully with OCR and analysis results');

    return new Response(
      JSON.stringify({
        success: true,
        textLength: extractedText.length,
        hasAnalysis: !!summary,
        summary,
        keyFacts,
        favorableFindings,
        adverseFindings,
        actionItems,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OCR Error:', error);
    return createErrorResponse(error, 500, 'ocr-document');
  }
});

