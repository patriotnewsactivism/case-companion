import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  withErrorHandling,
} from '../_shared/errorHandler.ts';

interface UploadRequest {
  caseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
}

interface R2UploadResponse {
  success: boolean;
  fileUrl: string;
  key: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);
  } catch (error) {
    return createErrorResponse(error, 500, 'upload-to-r2', corsHeaders);
  }

  const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const R2_ENDPOINT_URL = Deno.env.get('R2_ENDPOINT_URL');
  const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT_URL || !R2_BUCKET_NAME) {
    return createErrorResponse(new Error('R2 storage not configured'), 500, 'upload-to-r2', corsHeaders);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let requestBody: UploadRequest;
  try { requestBody = await req.json(); } catch { return createErrorResponse(new Error('Invalid JSON'), 400, 'upload-to-r2', corsHeaders); }

  const { caseId, fileName, fileType, fileSize, fileData } = requestBody;

  if (!caseId || !fileName || !fileType || !fileData) {
    return createErrorResponse(new Error('Missing required fields'), 400, 'upload-to-r2', corsHeaders);
  }

  const { data: caseData, error: caseError } = await supabase.from('cases').select('id').eq('id', caseId).eq('user_id', user.id).single();
  if (caseError || !caseData) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (fileSize > 100 * 1024 * 1024) {
    return createErrorResponse(new Error('File too large (max 100MB)'), 400, 'upload-to-r2', corsHeaders);
  }

  try {
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const fileExtension = fileName.split('.').pop() || 'bin';
    const key = user.id + '/' + caseId + '/' + Date.now() + '-' + Math.random().toString(36).substring(2, 8) + '.' + fileExtension;

    const uploadResult = await uploadToR2(R2_ENDPOINT_URL, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, key, bytes, fileType);

    const { data: docData, error: docError } = await supabase.from('documents').insert({
      case_id: caseId, user_id: user.id, name: fileName, file_url: uploadResult.fileUrl, file_type: fileType, file_size: fileSize
    }).select().single();

    if (docError) throw new Error('Failed to create document: ' + docError.message);

    return new Response(JSON.stringify({ success: true, document: docData, fileUrl: uploadResult.fileUrl }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error : new Error('Upload failed'), 500, 'upload-to-r2', corsHeaders);
  }
};

async function uploadToR2(endpointUrl: string, bucketName: string, accessKeyId: string, secretAccessKey: string, key: string, data: Uint8Array, contentType: string): Promise<R2UploadResponse> {
  const url = new URL(endpointUrl);
  const host = url.host;
  const path = '/' + bucketName + '/' + key;

  const headers = await getAwsSignatureV4Headers('PUT', path, host, 's3', 'auto', accessKeyId, secretAccessKey, data, contentType);

  const response = await fetch(endpointUrl + '/' + bucketName + '/' + key, { method: 'PUT', headers: { ...headers, 'Content-Type': contentType }, body: data });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('R2 upload failed: ' + response.status + ' ' + errorText);
  }

  return { success: true, fileUrl: endpointUrl + '/' + bucketName + '/' + key, key };
}

async function getAwsSignatureV4Headers(method: string, path: string, host: string, service: string, region: string, accessKeyId: string, secretAccessKey: string, payload: Uint8Array, contentType: string): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|.d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = await sha256Hex(payload);
  const canonicalHeaders = 'content-type:' + contentType + '
host:' + host + '
x-amz-content-sha256:' + payloadHash + '
x-amz-date:' + amzDate + '
';
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('
');
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('
');
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);
  const authorization = algorithm + ' Credential=' + accessKeyId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
  return { 'Host': host, 'Content-Type': contentType, 'X-Amz-Content-Sha256': payloadHash, 'X-Amz-Date': amzDate, 'Authorization': authorization };
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  const result = await hmacSha256(key, data);
  return arrayBufferToHex(result.buffer);
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(withErrorHandling(handler, 'upload-to-r2'));
