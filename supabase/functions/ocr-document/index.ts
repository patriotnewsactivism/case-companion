import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, validateURL } from '../_shared/validation.ts';

const STORAGE_BUCKET = 'case-documents';

interface OcrSpaceParsedResult {
  ParsedText?: string;
}

interface OcrSpaceResponse {
  OCRExitCode?: number;
  ParsedResults?: OcrSpaceParsedResult[];
  ErrorMessage?: string | string[];
}

function extractStoragePath(fileUrl: string): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return null;
  }

  if (!fileUrl.startsWith('http')) {
    return fileUrl.replace(/^\/+/, '');
  }

  const lower = fileUrl.toLowerCase();
  if (!lower.includes('/storage/v1/object/')) {
    return null;
  }

  const marker = `/${STORAGE_BUCKET}/`;
  const markerIndex = lower.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const pathWithQuery = fileUrl.slice(markerIndex + marker.length);
  return pathWithQuery.split('?')[0];
}

async function loadFileBlob(
  supabase: SupabaseClient,
  fileUrl: string
): Promise<{ blob: Blob; contentType: string }> {
  const storagePath = extractStoragePath(fileUrl);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (!error && data) {
      return { blob: data, contentType: data.type || '' };
    }
  }

  if (!fileUrl.startsWith('http')) {
    throw new Error('File URL is not a valid URL');
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const blob = await response.blob();
  return { blob, contentType };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const azureVisionKey = Deno.env.get('AZURE_VISION_API_KEY');
    const azureVisionEndpoint = Deno.env.get('AZURE_VISION_ENDPOINT');
    const ocrSpaceApiKey = Deno.env.get('OCR_SPACE_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    const hasAzure = !!(azureVisionKey && azureVisionEndpoint);
    const hasOcrSpace = !!ocrSpaceApiKey;
    const hasGemini = !!googleApiKey;

    if (!hasAzure && !hasOcrSpace && !hasGemini) {
      console.error('No OCR service configured');
      return createErrorResponse(
        new Error('OCR service not configured. Please set AZURE_VISION_API_KEY, OCR_SPACE_API_KEY, or GOOGLE_AI_API_KEY.'),
        500,
        'ocr-document',
        corsHeaders
      );
    }

    console.log(`OCR providers available: Azure=${hasAzure}, OCR.space=${hasOcrSpace}, Gemini=${hasGemini}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NDUzNzY4Mn0.sZ9Z2QoERcdAxXInqq5YRpH5JLlv4Z8wqTz81X9gZ4Sah4w2XXINGPb8WQC5n3QsSHhKENOCgWOvqm3BD_61DA";
    const authHeader = req.headers.get('Authorization') || '';

    type AuthUser = { id: string };
    type DocumentOwner = { cases?: { user_id?: string } };

    let user: AuthUser;
    let supabase: SupabaseClient;
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
          'ocr-document',
          corsHeaders
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
    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<{ documentId: string; fileUrl: string }>(
      requestBody,
      ['documentId', 'fileUrl']
    );

    const { documentId, fileUrl } = requestBody;
    const validatedDocumentId = validateUUID(documentId, 'documentId');
    const validatedFileUrl = validateURL(fileUrl);

    console.log(`Processing OCR for document: ${validatedDocumentId}`);

    // Verify user owns this document by checking the associated case
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('case_id, name, cases!inner(user_id)')
      .eq('id', validatedDocumentId)
      .single();

    if (docError || !documentData) {
      console.error('Document not found:', docError);
      return createErrorResponse(
        new Error('Document not found'),
        404,
        'ocr-document',
        corsHeaders
      );
    }

    // Check if user owns the case (skip for service role)
    const ownerId = (documentData as DocumentOwner).cases?.user_id;
    if (!isServiceRole && ownerId !== user.id) {
      console.error('User does not own this document');
      return forbiddenResponse(
        'You do not have access to this document',
        corsHeaders
      );
    }

    console.log(`User verified as owner of document ${validatedDocumentId}: ${documentData.name}`);

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
    const { blob: fileBlob, contentType } = await loadFileBlob(supabase, validatedFileUrl);
    const resolvedContentType = contentType || fileBlob.type || '';
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

    // Azure Computer Vision OCR (PRIMARY - Industry-leading accuracy)
    const azureOcr = async (fileBlob: Blob, isImage: boolean): Promise<string> => {
      if (!azureVisionKey || !azureVisionEndpoint) {
        throw new Error('Azure Vision API not configured');
      }

      console.log('Using Azure Computer Vision for OCR (best quality)...');

      const endpoint = azureVisionEndpoint.endsWith('/') 
        ? azureVisionEndpoint.slice(0, -1) 
        : azureVisionEndpoint;

      let allText = '';
      
      if (isImage) {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const response = await fetch(`${endpoint}/vision/v3.2/ocr?detectOrientation=true`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureVisionKey,
            'Content-Type': 'application/octet-stream',
          },
          body: arrayBuffer,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            throw new Error('Azure rate limit exceeded');
          }
          throw new Error(`Azure OCR failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        allText = extractAzureText(result);
      } else {
        const formData = new FormData();
        formData.append('file', fileBlob, 'document.pdf');

        const response = await fetch(`${endpoint}/vision/v3.2/read/analyze`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureVisionKey,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            throw new Error('Azure rate limit exceeded');
          }
          throw new Error(`Azure PDF OCR failed: ${response.status} ${errorText}`);
        }

        const operationLocation = response.headers.get('Operation-Location');
        if (!operationLocation) {
          throw new Error('Azure did not return Operation-Location header');
        }

        let attempts = 0;
        let readResult = null;
        while (attempts < 30) {
          await delay(1000);
          const statusResponse = await fetch(operationLocation, {
            headers: { 'Ocp-Apim-Subscription-Key': azureVisionKey },
          });
          const statusData = await statusResponse.json();
          if (statusData.status === 'succeeded') {
            readResult = statusData;
            break;
          }
          if (statusData.status === 'failed') {
            throw new Error('Azure PDF OCR analysis failed');
          }
          attempts += 1;
        }

        if (!readResult) {
          throw new Error('Azure PDF OCR timed out');
        }

        allText = extractAzureReadResult(readResult);
      }

      if (!allText || allText.trim().length === 0) {
        throw new Error('Azure returned empty text');
      }

      console.log(`Azure extracted ${allText.length} characters`);
      return allText;
    };

    const extractAzureText = (result: any): string => {
      const lines: string[] = [];
      const regions = result.regions || [];
      for (const region of regions) {
        for (const line of region.lines || []) {
          const lineText = (line.words || []).map((w: any) => w.text || '').join(' ');
          if (lineText) lines.push(lineText);
        }
      }
      return lines.join('\n');
    };

    const extractAzureReadResult = (result: any): string => {
      const pages: string[] = [];
      const analyzeResult = result.analyzeResult || {};
      const readResults = analyzeResult.readResults || [];
      
      for (let i = 0; i < readResults.length; i += 1) {
        const page = readResults[i];
        const pageLines: string[] = [];
        for (const line of page.lines || []) {
          if (line.text) pageLines.push(line.text);
        }
        if (readResults.length > 1) {
          pages.push(`=== PAGE ${i + 1} ===\n${pageLines.join('\n')}`);
        } else {
          pages.push(pageLines.join('\n'));
        }
      }
      return pages.join('\n\n');
    };

    // Gemini 2.5 Flash OCR (LAST RESORT - Used when Azure and OCR.space fail)
    const geminiOcr = async (fileBlob: Blob, mimeType: string, isImage: boolean): Promise<string> => {
      if (!googleApiKey) {
        throw new Error('Google AI API key not configured');
      }

      console.log('Using Gemini 2.5 Flash for OCR (last resort)...');

      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);

      const prompt = isImage
        ? `You are a professional legal document OCR system. Extract ALL text from this image with maximum accuracy.

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
        : `You are a professional legal document OCR system. Extract ALL text from this PDF with maximum accuracy.

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

Extract now:`;

      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
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
            maxOutputTokens: 65536,
          }
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Gemini OCR error:', errorText);

        // Check for rate limit errors
        if (aiResponse.status === 429) {
          throw new Error('Gemini rate limit exceeded. Falling back to OCR.space...');
        }
        throw new Error(`Gemini OCR failed: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text || text.trim().length === 0) {
        throw new Error('Gemini returned empty text');
      }

      console.log(`Gemini extracted ${text.length} characters`);
      return text;
    };

    // OCR.space fallback function (FREE: 25,000 requests/month)
    const ocrSpaceExtract = async (fileBlob: Blob, isImage: boolean, contentType?: string): Promise<string> => {
      if (!ocrSpaceApiKey) {
        throw new Error('OCR.space API key not configured');
      }

      console.log('Using OCR.space fallback OCR service...');

      // Create a File object with proper extension so OCR.space can detect file type
      const extension = isImage ? 'jpg' : 'pdf';
      const fileName = `document.${extension}`;
      const file = new File([fileBlob], fileName, {
        type: contentType || (isImage ? 'image/jpeg' : 'application/pdf')
      });

      const formData = new FormData();
      formData.append('file', file, fileName);
      formData.append('apikey', ocrSpaceApiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy
      formData.append('filetype', extension.toUpperCase()); // Explicitly set file type

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OCR.space API failed: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as OcrSpaceResponse;

      if (result.OCRExitCode !== 1 || !result.ParsedResults || result.ParsedResults.length === 0) {
        const errorMessage = Array.isArray(result.ErrorMessage)
          ? result.ErrorMessage.join(', ')
          : (result.ErrorMessage || 'Unknown error');
        throw new Error(`OCR.space parsing failed: ${errorMessage}`);
      }

      // Combine all parsed text from all pages
      const extractedText = result.ParsedResults
        .map((page, idx: number) => {
          const pageText = page.ParsedText || '';
          return result.ParsedResults!.length > 1 ? `=== PAGE ${idx + 1} ===\n${pageText}` : pageText;
        })
        .join('\n\n');

      console.log(`OCR.space extracted ${extractedText.length} characters`);
      return extractedText;
    };

    // For images, use OCR to extract text
    if (resolvedContentType.includes('image') || validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i)) {
      console.log('Processing image with OCR...');

      const mimeType = resolvedContentType || 'image/jpeg';
      const sizeInMB = (fileBlob.size / 1024 / 1024).toFixed(2);

      console.log(`Image size: ${sizeInMB}MB, MIME: ${mimeType}`);

      // Try Azure first (best quality), then OCR.space, then Gemini (last resort)
      const errors: string[] = [];
      
      if (hasAzure) {
        try {
          extractedText = await azureOcr(fileBlob, true);
        } catch (error) {
          console.error('Azure OCR error:', error);
          errors.push(`Azure: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!extractedText && hasOcrSpace) {
        console.log('Trying OCR.space fallback...');
        try {
          extractedText = await ocrSpaceExtract(fileBlob, true, mimeType);
        } catch (error) {
          console.error('OCR.space OCR error:', error);
          errors.push(`OCR.space: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!extractedText && hasGemini) {
        console.log('Trying Gemini (last resort)...');
        try {
          extractedText = await geminiOcr(fileBlob, mimeType, true);
        } catch (error) {
          console.error('Gemini OCR error:', error);
          errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!extractedText) {
        throw new Error(`All OCR providers failed. ${errors.join('; ')}`);
      }

    } else if (resolvedContentType.includes('pdf') || validatedFileUrl.match(/\.pdf$/i)) {
      // For PDFs, use OCR
      console.log('PDF detected - processing with OCR...');

      const sizeInMB = (fileBlob.size / 1024 / 1024).toFixed(2);
      console.log(`PDF size: ${sizeInMB}MB`);

      // Try Azure first (best quality), then OCR.space, then Gemini (last resort)
      const errors: string[] = [];
      
      if (hasAzure) {
        try {
          extractedText = await azureOcr(fileBlob, false);
        } catch (error) {
          console.error('Azure OCR error:', error);
          errors.push(`Azure: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!extractedText && hasOcrSpace) {
        console.log('Trying OCR.space fallback...');
        try {
          extractedText = await ocrSpaceExtract(fileBlob, false, 'application/pdf');
        } catch (error) {
          console.error('OCR.space OCR error:', error);
          errors.push(`OCR.space: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!extractedText && hasGemini) {
        console.log('Trying Gemini (last resort)...');
        try {
          extractedText = await geminiOcr(fileBlob, 'application/pdf', false);
        } catch (error) {
          console.error('Gemini OCR error:', error);
          errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!extractedText) {
        throw new Error(`All OCR providers failed. ${errors.join('; ')}`);
      }

    } else if (resolvedContentType.includes('text') || validatedFileUrl.match(/\.(txt|doc|docx)$/i)) {
      // For text files, read directly
      extractedText = await fileBlob.text();
      console.log(`Read ${extractedText.length} characters from text file`);
    } else {
      console.log(`Unsupported file type: ${resolvedContentType || 'unknown'}`);
      extractedText = `[File type ${resolvedContentType || 'unknown'} - OCR not available for this format]`;
    }

    extractedText = normalizeExtractedText(extractedText);

    const isOcrTarget =
      resolvedContentType.includes('image') ||
      resolvedContentType.includes('pdf') ||
      validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|pdf)$/i);

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
    let timelineEvents: unknown[] = [];

    if (extractedText && extractedText.length > 50 && !extractedText.startsWith('[File type') && (hasAzure || hasGemini)) {
      console.log('Analyzing extracted text with AI...');

      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      const aiGatewayUrl = Deno.env.get('AI_GATEWAY_URL');
      const hasOpenAI = !!openaiApiKey;
      
      const analysisPrompt = `You are an expert legal document analyst specializing in litigation support. Analyze documents with precision and identify strategic insights for case preparation.

Analyze this legal document and provide a JSON response with comprehensive legal analysis, including chronological timeline events.

ANALYSIS REQUIREMENTS:
1. SUMMARY: 2-4 sentence executive summary of the document's content and significance
2. KEY_FACTS: 5-10 specific factual findings (dates, events, statements, numbers)
3. FAVORABLE_FINDINGS: 3-5 findings that could support the case (admissions, favorable testimony, helpful evidence)
4. ADVERSE_FINDINGS: 3-5 findings that could hurt the case (contradictions, damaging statements, weaknesses)
5. ACTION_ITEMS: 3-5 specific follow-up actions (witnesses to interview, documents to request, issues to research)
6. TIMELINE_EVENTS: Extract chronological events found in the document. For each event provide:
   - "event_date": YYYY-MM-DD format (if approximate, use first of month/year)
   - "title": Short title (5-10 words)
   - "description": Detailed description (1-2 sentences)
   - "importance": "high", "medium", or "low"
   - "event_type": e.g., "communication", "filing", "incident", "meeting"

Be thorough, precise, and strategic. Focus on facts that matter for litigation.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "key_facts": ["fact1", "fact2", ...],
  "favorable_findings": ["finding1", "finding2", ...],
  "adverse_findings": ["finding1", "finding2", ...],
  "action_items": ["action1", "action2", ...],
  "timeline_events": [
    { "event_date": "2023-01-01", "title": "...", "description": "...", "importance": "high", "event_type": "..." }
  ]
}

Document text:
${extractedText.substring(0, 20000)}`;

      let content = '';
      
      // Try OpenAI/AI Gateway first (if configured)
      if (hasOpenAI) {
        try {
          const apiUrl = aiGatewayUrl || 'https://api.openai.com/v1/chat/completions';
          const analysisResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: analysisPrompt }],
              temperature: 0.2,
              max_tokens: 4096,
              response_format: { type: 'json_object' },
            }),
          });

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            content = analysisData.choices?.[0]?.message?.content || '';
            console.log('OpenAI analysis completed successfully');
          } else {
            console.error('OpenAI analysis failed:', await analysisResponse.text());
          }
        } catch (openaiError) {
          console.error('OpenAI analysis error:', openaiError);
        }
      }
      
      // Fallback to Gemini if OpenAI didn't work
      if (!content && hasGemini) {
        try {
          const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: analysisPrompt }]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json',
              }
            }),
          });

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            content = extractGeminiText(analysisData);
            console.log('Gemini analysis completed');
          } else {
            console.error('Gemini analysis failed:', await analysisResponse.text());
          }
        } catch (geminiError) {
          console.error('Gemini analysis error:', geminiError);
        }
      }

      try {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          summary = analysis.summary || '';
          keyFacts = Array.isArray(analysis.key_facts) ? analysis.key_facts : [];
          favorableFindings = Array.isArray(analysis.favorable_findings) ? analysis.favorable_findings : [];
          adverseFindings = Array.isArray(analysis.adverse_findings) ? analysis.adverse_findings : [];
          actionItems = Array.isArray(analysis.action_items) ? analysis.action_items : [];
          timelineEvents = Array.isArray(analysis.timeline_events) ? analysis.timeline_events : [];
          console.log(`Analysis complete: ${keyFacts.length} facts, ${timelineEvents.length} events found`);
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
      .eq('id', validatedDocumentId);

    if (updateError) {
      console.error('Failed to update document:', updateError);
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // Insert extracted timeline events
    if (timelineEvents.length > 0) {
      console.log(`Inserting ${timelineEvents.length} timeline events...`);
      const eventsToInsert = (timelineEvents as Array<{event_date?: string; title?: string; description?: string; importance?: string; event_type?: string}>).map((event) => ({
        case_id: documentData.case_id,
        user_id: user.id, // Or ownerId if different
        linked_document_id: validatedDocumentId,
        event_date: event.event_date || new Date().toISOString().split('T')[0],
        title: event.title || 'Untitled Event',
        description: event.description || '',
        importance: event.importance || 'medium',
        event_type: event.event_type || 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: timelineError } = await supabase
        .from('timeline_events')
        .insert(eventsToInsert);

      if (timelineError) {
        console.error('Failed to insert timeline events:', timelineError);
        // We don't throw here to avoid failing the whole OCR process just because timeline insertion failed
      } else {
        console.log('Timeline events inserted successfully');
      }
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

  } catch (error: unknown) {
    console.error('OCR Error:', error);
    if (error instanceof Error) {
        return createErrorResponse(error, 500, 'ocr-document', corsHeaders);
    }
    return createErrorResponse(new Error('An unknown error occurred'), 500, 'ocr-document', corsHeaders);
  }
});