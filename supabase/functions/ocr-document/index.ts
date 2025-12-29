import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'LOVABLE_API_KEY']);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'ocr-document'
      );
    }

    const { user, supabase } = authResult;

    // Rate limiting: 10 OCR operations per minute per user
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

    // Parse and validate request body
    const requestBody = await req.json();
    validateRequestBody(requestBody, ['documentId', 'fileUrl']);

    const documentId = validateUUID(requestBody.documentId, 'documentId');
    const fileUrl = validateURL(requestBody.fileUrl);

    console.log(`Processing OCR for document: ${documentId}`);

    // Verify user owns this document by checking the associated case
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('case_id, cases!inner(user_id)')
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

    // Check if user owns the case
    if ((documentData.cases as any).user_id !== user.id) {
      console.error('User does not own this document');
      return forbiddenResponse(
        'You do not have access to this document',
        corsHeaders
      );
    }

    console.log(`User verified as owner of document ${documentId}`);

    // Fetch the file content
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }

    const contentType = fileResponse.headers.get('content-type') || '';
    let extractedText = '';

    // For images, use AI vision to extract text
    if (contentType.includes('image') || fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      console.log('Processing image with AI vision...');
      
      // Convert image to base64
      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = contentType || 'image/jpeg';

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract ALL text from this document image. Include every single word, number, date, name, and piece of information visible. Preserve the original structure and formatting as much as possible. If there are tables, preserve the table structure. If there are multiple columns, process each column. Output ONLY the extracted text, no commentary.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 8000,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI OCR error:', errorText);
        throw new Error(`AI OCR failed: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.choices[0]?.message?.content || '';
      console.log(`Extracted ${extractedText.length} characters from image`);

    } else if (contentType.includes('pdf') || fileUrl.match(/\.pdf$/i)) {
      // For PDFs, we'll note that direct PDF processing requires more complex handling
      // Using AI to describe what we know about the document
      console.log('PDF detected - using AI to process...');
      
      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `This is a PDF document. Extract ALL text content from every page. Include every single word, number, date, name, and piece of information. Preserve the original structure and formatting. If there are tables, preserve the table structure. Output ONLY the extracted text, no commentary.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 8000,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI PDF OCR error:', errorText);
        throw new Error(`AI PDF OCR failed: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.choices[0]?.message?.content || '';
      console.log(`Extracted ${extractedText.length} characters from PDF`);

    } else if (contentType.includes('text') || fileUrl.match(/\.(txt|doc|docx)$/i)) {
      // For text files, read directly
      extractedText = await fileResponse.text();
      console.log(`Read ${extractedText.length} characters from text file`);
    } else {
      console.log(`Unsupported file type: ${contentType}`);
      extractedText = `[File type ${contentType} - OCR not available for this format]`;
    }

    // Now use AI to analyze the extracted text and generate insights
    let keyFacts: string[] = [];
    let favorableFindings: string[] = [];
    let adverseFindings: string[] = [];
    let actionItems: string[] = [];
    let summary = '';

    if (extractedText && extractedText.length > 50) {
      console.log('Analyzing extracted text with AI...');
      
      const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a legal document analyst. Analyze the provided document text and extract key information for litigation purposes. Be thorough and precise.`
            },
            {
              role: 'user',
              content: `Analyze this legal document and provide a JSON response with the following structure:
{
  "summary": "A 2-3 sentence summary of the document",
  "key_facts": ["List of 3-5 key factual findings from the document"],
  "favorable_findings": ["List of 2-4 findings that could help the case"],
  "adverse_findings": ["List of 2-4 findings that could hurt the case"],
  "action_items": ["List of 2-3 follow-up actions based on this document"]
}

Document text:
${extractedText.substring(0, 15000)}`
            }
          ],
          max_tokens: 2000,
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        const content = analysisData.choices[0]?.message?.content || '';
        
        try {
          // Try to parse JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            summary = analysis.summary || '';
            keyFacts = analysis.key_facts || [];
            favorableFindings = analysis.favorable_findings || [];
            adverseFindings = analysis.adverse_findings || [];
            actionItems = analysis.action_items || [];
          }
        } catch (parseError) {
          console.error('Failed to parse analysis JSON:', parseError);
          summary = content.substring(0, 500);
        }
      }
    }

    // Update the document with OCR results
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ocr_text: extractedText,
        ocr_processed_at: new Date().toISOString(),
        ai_analyzed: true,
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
