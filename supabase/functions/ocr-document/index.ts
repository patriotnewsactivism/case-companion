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
import {
  extractText as azureDocExtractText,
  extractTables as azureDocExtractTables,
  extractDocumentStructure,
  formatAnalyzeResultAsText,
  type TableResult,
} from '../_shared/azureDocumentIntelligence.ts';

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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeExtractedText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const azureDocIntelligenceKey = Deno.env.get('AZURE_DOC_INTELLIGENCE_KEY');
    const azureDocIntelligenceEndpoint = Deno.env.get('AZURE_DOC_INTELLIGENCE_ENDPOINT');
    const azureVisionKey = Deno.env.get('AZURE_VISION_API_KEY');
    const azureVisionEndpoint = Deno.env.get('AZURE_VISION_ENDPOINT');
    const ocrSpaceApiKey = Deno.env.get('OCR_SPACE_API_KEY');

    const hasAzureDocIntelligence = !!(azureDocIntelligenceKey && azureDocIntelligenceEndpoint);
    const hasAzureVision = !!(azureVisionKey && azureVisionEndpoint);
    const hasOcrSpace = !!ocrSpaceApiKey;

    console.log(
      `OCR providers available: AzureDocIntelligence=${hasAzureDocIntelligence}, AzureVision=${hasAzureVision}, OCR.space=${hasOcrSpace}`
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : authHeader.trim();

    type AuthUser = { id: string };
    type DocumentOwner = { cases?: { user_id?: string } };

    let user: AuthUser;
    let supabase: SupabaseClient;
    let isServiceRole = false;

    if (serviceRoleKey && bearerToken === serviceRoleKey) {
      console.log('Service role authentication detected - internal call');
      isServiceRole = true;
      supabase = createClient(supabaseUrl, serviceRoleKey);
      user = { id: 'service-role' };
    } else {
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

    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<{ documentId: string; fileUrl: string }>(
      requestBody,
      ['documentId', 'fileUrl']
    );

    const { documentId, fileUrl, extractTables } = requestBody;
    const validatedDocumentId = validateUUID(documentId as string, 'documentId');
    const validatedFileUrl = validateURL(fileUrl as string);
    const shouldExtractTables = extractTables === true;

    console.log(`Processing OCR for document: ${validatedDocumentId}`);

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

    const ownerId = (documentData as DocumentOwner).cases?.user_id;
    if (!isServiceRole && ownerId !== user.id) {
      console.error('User does not own this document');
      return forbiddenResponse(
        'You do not have access to this document',
        corsHeaders
      );
    }

    console.log(`User verified as owner of document ${validatedDocumentId}: ${documentData.name}`);

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

    const { blob: fileBlob, contentType } = await loadFileBlob(supabase, validatedFileUrl);
    const resolvedContentType = contentType || fileBlob.type || '';
    let extractedText = '';
    let extractedTables: TableResult[] = [];
    let ocrProvider = '';

    const azureVisionOcr = async (fileBlob: Blob, isImage: boolean): Promise<string> => {
      if (!azureVisionKey || !azureVisionEndpoint) {
        throw new Error('Azure Vision API not configured');
      }

      console.log('Using Azure Computer Vision for OCR...');

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

      console.log(`Azure Vision extracted ${allText.length} characters`);
      return allText;
    };

    interface AzureOcrRegion {
      lines?: Array<{ words?: Array<{ text?: string }> }>;
    }

    interface AzureOcrResult {
      regions?: AzureOcrRegion[];
    }

    interface AzureReadResult {
      analyzeResult?: {
        readResults?: Array<{ lines?: Array<{ text?: string }> }>;
      };
    }

    const extractAzureText = (result: AzureOcrResult): string => {
      const lines: string[] = [];
      const regions = result.regions || [];
      for (const region of regions) {
        for (const line of region.lines || []) {
          const lineText = (line.words || []).map((w) => w.text || '').join(' ');
          if (lineText) lines.push(lineText);
        }
      }
      return lines.join('\n');
    };

    const extractAzureReadResult = (result: AzureReadResult): string => {
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

    const ocrSpaceExtract = async (fileBlob: Blob, isImage: boolean, contentType?: string): Promise<string> => {
      if (!ocrSpaceApiKey) {
        throw new Error('OCR.space API key not configured');
      }

      console.log('Using OCR.space fallback OCR service...');

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
      formData.append('OCREngine', '2');
      formData.append('filetype', extension.toUpperCase());

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

      const extractedText = result.ParsedResults
        .map((page, idx: number) => {
          const pageText = page.ParsedText || '';
          return result.ParsedResults!.length > 1 ? `=== PAGE ${idx + 1} ===\n${pageText}` : pageText;
        })
        .join('\n\n');

      console.log(`OCR.space extracted ${extractedText.length} characters`);
      return extractedText;
    };

    const isOcrTarget =
      resolvedContentType.includes('image') ||
      resolvedContentType.includes('pdf') ||
      validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|pdf)$/i);

    if (isOcrTarget) {
      if (!hasAzureDocIntelligence && !hasAzureVision && !hasOcrSpace) {
        throw new Error(
          'No OCR providers configured. Please set AZURE_DOC_INTELLIGENCE_KEY and AZURE_DOC_INTELLIGENCE_ENDPOINT, or AZURE_VISION_API_KEY and AZURE_VISION_ENDPOINT, or OCR_SPACE_API_KEY.'
        );
      }

      console.log('Processing document with OCR...');
      const isImage = resolvedContentType.includes('image') || validatedFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i);
      const sizeInMB = (fileBlob.size / 1024 / 1024).toFixed(2);
      console.log(`Document size: ${sizeInMB}MB, MIME: ${resolvedContentType}`);

      const errors: string[] = [];

      if (hasAzureDocIntelligence) {
        try {
          console.log('Attempting Azure Document Intelligence (primary)...');
          if (shouldExtractTables) {
            const result = await extractDocumentStructure(fileBlob, (status, progress) => {
              console.log(`Azure Doc Intelligence: ${status} (${progress}%)`);
            });
            extractedText = formatAnalyzeResultAsText(result);
            extractedTables = result.tables || [];
          } else {
            extractedText = await azureDocExtractText(fileBlob, (status, progress) => {
              console.log(`Azure Doc Intelligence: ${status} (${progress}%)`);
            });
          }
          ocrProvider = 'azure-doc-intelligence';
          console.log(`Azure Document Intelligence extracted ${extractedText.length} characters`);
        } catch (error) {
          console.error('Azure Document Intelligence error:', error);
          errors.push(`AzureDocIntelligence: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!extractedText && hasAzureVision) {
        try {
          console.log('Trying Azure Vision fallback...');
          extractedText = await azureVisionOcr(fileBlob, !!isImage);
          ocrProvider = 'azure-vision';
        } catch (error) {
          console.error('Azure Vision OCR error:', error);
          errors.push(`AzureVision: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!extractedText && hasOcrSpace) {
        console.log('Trying OCR.space fallback...');
        try {
          extractedText = await ocrSpaceExtract(fileBlob, !!isImage, resolvedContentType);
          ocrProvider = 'ocr-space';
        } catch (error) {
          console.error('OCR.space OCR error:', error);
          errors.push(`OCR.space: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!extractedText) {
        throw new Error(`OCR failed. ${errors.join('; ')}`.trim());
      }

    } else if (resolvedContentType.includes('text') || validatedFileUrl.match(/\.(txt|doc|docx)$/i)) {
      extractedText = await fileBlob.text();
      ocrProvider = 'direct-text';
      console.log(`Read ${extractedText.length} characters from text file`);
    } else {
      console.log(`Unsupported file type: ${resolvedContentType || 'unknown'}`);
      extractedText = `[File type ${resolvedContentType || 'unknown'} - OCR not available for this format]`;
      ocrProvider = 'none';
    }

    extractedText = normalizeExtractedText(extractedText);

    if (isOcrTarget && extractedText.length < 30) {
      throw new Error(
        'OCR extraction returned too little text. The file may be corrupted, heavily redacted, or require re-upload.'
      );
    }

    let keyFacts: string[] = [];
    let favorableFindings: string[] = [];
    let adverseFindings: string[] = [];
    let actionItems: string[] = [];
    let summary = '';
    let timelineEvents: unknown[] = [];

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const aiGatewayUrl = Deno.env.get('AI_GATEWAY_URL');
    const hasOpenAI = !!openaiApiKey;

    if (extractedText && extractedText.length > 50 && !extractedText.startsWith('[File type') && hasOpenAI) {
      console.log('Analyzing extracted text with AI...');

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

      try {
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

    const updateData: Record<string, unknown> = {
      ocr_text: extractedText,
      ocr_processed_at: new Date().toISOString(),
      ocr_provider: ocrProvider,
      ai_analyzed: !!summary,
      summary: summary || null,
      key_facts: keyFacts.length > 0 ? keyFacts : null,
      favorable_findings: favorableFindings.length > 0 ? favorableFindings : null,
      adverse_findings: adverseFindings.length > 0 ? adverseFindings : null,
      action_items: actionItems.length > 0 ? actionItems : null,
    };

    if (extractedTables.length > 0) {
      updateData.extracted_tables = extractedTables;
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', validatedDocumentId);

    if (updateError) {
      console.error('Failed to update document:', updateError);
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    if (timelineEvents.length > 0) {
      console.log(`Inserting ${timelineEvents.length} timeline events...`);
      const eventsToInsert = (timelineEvents as Array<{event_date?: string; title?: string; description?: string; importance?: string; event_type?: string}>).map((event) => ({
        case_id: documentData.case_id,
        user_id: user.id,
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
      } else {
        console.log('Timeline events inserted successfully');
      }
    }

    console.log('Document updated successfully with OCR and analysis results');

    return new Response(
      JSON.stringify({
        success: true,
        textLength: extractedText.length,
        ocrProvider,
        hasAnalysis: !!summary,
        summary,
        keyFacts,
        favorableFindings,
        adverseFindings,
        actionItems,
        tablesExtracted: extractedTables.length,
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
