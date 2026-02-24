/**
 * Azure Document Intelligence integration for OCR and document analysis
 * Uses prebuilt-read for best OCR quality and prebuilt-layout for table extraction
 */

export interface AzureDocIntelligenceConfig {
  endpoint: string;
  apiKey: string;
}

export interface AnalyzeResult {
  content: string;
  pages: PageResult[];
  tables?: TableResult[];
  keyValuePairs?: KeyValuePair[];
  languages?: DetectedLanguage[];
}

export interface PageResult {
  pageNumber: number;
  content: string;
  width?: number;
  height?: number;
  unit?: string;
}

export interface TableResult {
  rowCount: number;
  columnCount: number;
  cells: TableCell[];
}

export interface TableCell {
  rowIndex: number;
  columnIndex: number;
  content: string;
  rowSpan?: number;
  columnSpan?: number;
}

export interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
}

export interface DetectedLanguage {
  locale: string;
  confidence: number;
}

export type ModelType = 'prebuilt-read' | 'prebuilt-layout' | 'prebuilt-document';

export interface ProgressCallback {
  (status: string, progress: number): void;
}

function getConfig(): AzureDocIntelligenceConfig {
  const endpoint = Deno.env.get('AZURE_DOC_INTELLIGENCE_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_DOC_INTELLIGENCE_KEY');

  if (!endpoint || !apiKey) {
    throw new Error(
      'Missing Azure Document Intelligence configuration. Required: ' +
      'AZURE_DOC_INTELLIGENCE_ENDPOINT, AZURE_DOC_INTELLIGENCE_KEY'
    );
  }

  return { endpoint, apiKey };
}

function buildAnalyzeUrls(config: AzureDocIntelligenceConfig, model: ModelType): string[] {
  const baseUrl = config.endpoint.endsWith('/') ? config.endpoint.slice(0, -1) : config.endpoint;
  const modernPath = `${baseUrl}/documentintelligence/documentModels/${model}:analyze`;
  const legacyPath = `${baseUrl}/formrecognizer/documentModels/${model}:analyze`;

  const urls = [
    `${modernPath}?api-version=2024-11-30`,
    `${modernPath}?api-version=2024-02-29-preview`,
    `${legacyPath}?api-version=2024-02-29-preview`,
    `${legacyPath}?api-version=2023-07-31`,
  ];

  return Array.from(new Set(urls));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseAzureError(status: number, errorText: string): string {
  let errorMessage = `Azure Document Intelligence error (${status})`;

  try {
    const errorJson = JSON.parse(errorText);
    return errorJson.error?.message || errorJson.message || errorMessage;
  } catch {
    if (errorText) {
      errorMessage = `${errorMessage}: ${errorText}`;
    }
    return errorMessage;
  }
}

/**
 * Analyzes a document using Azure Document Intelligence
 * 
 * @param fileBlob - The document file as a Blob
 * @param model - The model to use (prebuilt-read, prebuilt-layout, prebuilt-document)
 * @param onProgress - Optional callback for progress updates
 * @returns The analysis result with extracted text and structured data
 */
export async function analyzeDocument(
  fileBlob: Blob,
  model: ModelType = 'prebuilt-read',
  onProgress?: ProgressCallback
): Promise<AnalyzeResult> {
  const config = getConfig();
  const urls = buildAnalyzeUrls(config, model);

  onProgress?.('Submitting document for analysis...', 10);

  const arrayBuffer = await fileBlob.arrayBuffer();
  const attemptErrors: string[] = [];
  let operationLocation: string | null = null;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': fileBlob.type || 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (response.ok) {
      const candidateOperationLocation = response.headers.get('Operation-Location');
      if (candidateOperationLocation) {
        operationLocation = candidateOperationLocation;
        break;
      }

      attemptErrors.push(`[${i + 1}] ${url} -> missing Operation-Location header`);
      continue;
    }

    const errorText = await response.text();
    const parsedError = parseAzureError(response.status, errorText);
    attemptErrors.push(`[${i + 1}] ${url} -> ${parsedError}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Azure authentication failed: ${parsedError}`);
    }
    if (response.status === 429) {
      throw new Error(`Azure rate limit exceeded: ${parsedError}`);
    }
  }

  if (!operationLocation) {
    throw new Error(
      `Azure Document Intelligence request failed across ${urls.length} endpoint candidates. ${attemptErrors.join(' | ')}`
    );
  }

  onProgress?.('Analysis in progress...', 20);

  const result = await pollForResult(operationLocation, config.apiKey, onProgress);
  return parseAnalyzeResult(result);
}

async function pollForResult(
  operationLocation: string,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<unknown> {
  const maxAttempts = 120;
  const pollInterval = 1000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    await sleep(pollInterval);
    attempts += 1;

    const statusResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to poll analysis status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json() as Record<string, unknown>;

    if (statusData.status === 'succeeded') {
      onProgress?.('Analysis complete', 100);
      return statusData;
    }

    if (statusData.status === 'failed') {
      const errorDetails = (statusData.error as Record<string, unknown>)?.message || 'Unknown error';
      throw new Error(`Document analysis failed: ${errorDetails}`);
    }

    const progress = 20 + Math.min(70, (attempts / maxAttempts) * 70);
    onProgress?.(`Analyzing document... (${Math.round(progress)}%)`, progress);
  }

  throw new Error('Document analysis timed out after 2 minutes');
}

function parseAnalyzeResult(result: unknown): AnalyzeResult {
  const resultObj = result as Record<string, unknown>;
  const analyzeResult = resultObj?.analyzeResult as Record<string, unknown> || {};
  
  const content = (analyzeResult.content as string) || '';
  
  const pages: PageResult[] = [];
  const readResults = analyzeResult.pages as Array<Record<string, unknown>> || [];
  
  for (let i = 0; i < readResults.length; i++) {
    const page = readResults[i];
    const pageContent = extractPageContent(page);
    pages.push({
      pageNumber: (page.pageNumber as number) || i + 1,
      content: pageContent,
      width: page.width as number | undefined,
      height: page.height as number | undefined,
      unit: page.unit as string | undefined,
    });
  }

  const tables: TableResult[] = [];
  const tableResults = analyzeResult.tables as Array<Record<string, unknown>> || [];
  
  for (const table of tableResults) {
    const cells = (table.cells as Array<Record<string, unknown>>) || [];
    tables.push({
      rowCount: (table.rowCount as number) || 0,
      columnCount: (table.columnCount as number) || 0,
      cells: cells.map(cell => ({
        rowIndex: (cell.rowIndex as number) || 0,
        columnIndex: (cell.columnIndex as number) || 0,
        content: (cell.content as string) || '',
        rowSpan: cell.rowSpan as number | undefined,
        columnSpan: cell.columnSpan as number | undefined,
      })),
    });
  }

  const keyValuePairs: KeyValuePair[] = [];
  const kvpResults = analyzeResult.keyValuePairs as Array<Record<string, unknown>> || [];
  
  for (const kvp of kvpResults) {
    keyValuePairs.push({
      key: ((kvp.key as Record<string, unknown>)?.content as string) || '',
      value: ((kvp.value as Record<string, unknown>)?.content as string) || '',
      confidence: (kvp.confidence as number) || 0,
    });
  }

  const languages: DetectedLanguage[] = [];
  const langResults = analyzeResult.languages as Array<Record<string, unknown>> || [];
  
  for (const lang of langResults) {
    languages.push({
      locale: (lang.locale as string) || '',
      confidence: (lang.confidence as number) || 0,
    });
  }

  return {
    content,
    pages,
    tables: tables.length > 0 ? tables : undefined,
    keyValuePairs: keyValuePairs.length > 0 ? keyValuePairs : undefined,
    languages: languages.length > 0 ? languages : undefined,
  };
}

function extractPageContent(page: Record<string, unknown>): string {
  const lines = (page.lines as Array<Record<string, unknown>>) || [];
  const pageLines: string[] = [];
  
  for (const line of lines) {
    if (line.content) {
      pageLines.push(line.content as string);
    }
  }
  
  return pageLines.join('\n');
}

/**
 * Extracts text from a document using prebuilt-read model
 * Best for general OCR with high accuracy
 */
export async function extractText(
  fileBlob: Blob,
  onProgress?: ProgressCallback
): Promise<string> {
  let result: AnalyzeResult;
  try {
    result = await analyzeDocument(fileBlob, 'prebuilt-read', onProgress);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldFallbackToLayout = /resource not found|model|unsupported|invalid request/i.test(message);

    if (!shouldFallbackToLayout) {
      throw error;
    }

    onProgress?.('Falling back to prebuilt-layout model...', 15);
    result = await analyzeDocument(fileBlob, 'prebuilt-layout', onProgress);
  }
  
  if (result.pages.length > 1) {
    return result.pages.map((page, idx) => 
      `=== PAGE ${idx + 1} ===\n${page.content}`
    ).join('\n\n');
  }
  
  return result.content;
}

/**
 * Extracts tables from a document using prebuilt-layout model
 */
export async function extractTables(
  fileBlob: Blob,
  onProgress?: ProgressCallback
): Promise<TableResult[]> {
  const result = await analyzeDocument(fileBlob, 'prebuilt-layout', onProgress);
  return result.tables || [];
}

/**
 * Extracts full document structure with tables and key-value pairs
 */
export async function extractDocumentStructure(
  fileBlob: Blob,
  onProgress?: ProgressCallback
): Promise<AnalyzeResult> {
  return analyzeDocument(fileBlob, 'prebuilt-layout', onProgress);
}

/**
 * Formats table results as markdown
 */
export function formatTableAsMarkdown(table: TableResult): string {
  const rows: string[][] = [];
  
  for (let i = 0; i < table.rowCount; i++) {
    rows[i] = [];
    for (let j = 0; j < table.columnCount; j++) {
      rows[i][j] = '';
    }
  }
  
  for (const cell of table.cells) {
    if (cell.rowIndex < table.rowCount && cell.columnIndex < table.columnCount) {
      rows[cell.rowIndex][cell.columnIndex] = cell.content;
    }
  }
  
  const lines: string[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    lines.push('| ' + row.join(' | ') + ' |');
    
    if (i === 0) {
      lines.push('| ' + row.map(() => '---').join(' | ') + ' |');
    }
  }
  
  return lines.join('\n');
}

/**
 * Converts full analysis result to formatted text with page markers and tables
 */
export function formatAnalyzeResultAsText(result: AnalyzeResult): string {
  const parts: string[] = [];
  
  if (result.pages.length > 0) {
    for (let i = 0; i < result.pages.length; i++) {
      const page = result.pages[i];
      if (result.pages.length > 1) {
        parts.push(`=== PAGE ${page.pageNumber} ===`);
      }
      parts.push(page.content);
    }
  }
  
  if (result.tables && result.tables.length > 0) {
    parts.push('\n=== EXTRACTED TABLES ===\n');
    for (let i = 0; i < result.tables.length; i++) {
      parts.push(`\nTable ${i + 1}:`);
      parts.push(formatTableAsMarkdown(result.tables[i]));
    }
  }
  
  return parts.join('\n');
}
