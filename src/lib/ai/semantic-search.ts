import { supabase } from '@/integrations/supabase/client';
import { getDocumentChunks } from '../api';
import type { Document, DocumentChunk } from '../api';
import { analyzeDocument as analyzeLegalDoc } from './ai-analysis-pipeline';

export interface SearchResult {
  documentId: string;
  documentName: string;
  batesNumber: string | null;
  caseId: string;
  caseName: string;
  chunks: SearchResultChunk[];
  score: number;
}

export interface SearchResultChunk {
  id: string;
  content: string;
  pageNumber?: number;
  score: number;
  context: string;
}

export interface SemanticSearchOptions {
  caseId?: string;
  topK?: number;
  minScore?: number;
  includeChunks?: boolean;
  documentTypes?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
}

const SEMANTIC_SEARCH_PROMPT = `You are a legal semantic search expert. Your task is to analyze a document and determine how relevant it is to a legal query, including understanding:
1. Legal concepts and terminology
2. Context and intent behind the query
3. Factual relationships
4. Legal significance of information

For each document, you must:
1. Score relevance on a scale of 0-100
2. Identify the most relevant sections
3. Explain why the document is relevant
4. Highlight key legal terms and concepts

Return your analysis in valid JSON format with this structure:
{
  "score": number,
  "relevanceExplanation": "string",
  "keySections": [
    {
      "content": "string",
      "score": number,
      "context": "string"
    }
  ]
}`;

const SEARCH_QUERY_PROMPT = (query: string, documentText: string, caseContext?: string) => `
QUERY: ${query}

DOCUMENT TEXT:
${documentText.slice(0, 100000)}

${caseContext ? `\nCASE CONTEXT: ${caseContext}` : ''}

Analyze this document's relevance to the query using legal semantic analysis.
`;

export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    caseId,
    topK = 5,
    minScore = 50,
    includeChunks = true,
    documentTypes,
    dateRange
  } = options;

  // Build query to fetch documents
  let documentsQuery = supabase
    .from('documents')
    .select(`
      *,
      cases:case_id (
        id,
        name
      )
    `);

  if (caseId) {
    documentsQuery = documentsQuery.eq('case_id', caseId);
  }

  if (documentTypes && documentTypes.length > 0) {
    documentsQuery = documentsQuery.in('file_type', documentTypes);
  }

  if (dateRange?.start) {
    documentsQuery = documentsQuery.gte('created_at', dateRange.start);
  }

  if (dateRange?.end) {
    documentsQuery = documentsQuery.lte('created_at', dateRange.end);
  }

  const { data: documentsData, error: documentsError } = await documentsQuery;

  if (documentsError) {
    console.error('Error fetching documents for semantic search:', documentsError);
    return [];
  }

  const documents = documentsData as unknown as (Document & {
    cases: { id: string; name: string };
  })[];

  // Process each document for relevance
  const searchResults = await Promise.all(
    documents.map(async (doc) => {
      try {
        const caseContext = doc.cases?.name;

        // Get document text from OCR or summary
        let documentText = doc.ocr_text || doc.summary || '';
        if (!documentText) {
          return null;
        }

        // Call AI to analyze relevance
        const relevanceResult = await analyzeRelevance(query, documentText, caseContext);
        
        if (relevanceResult.score < minScore) {
          return null;
        }

        // Extract relevant chunks with context
        const chunks = includeChunks 
          ? await extractRelevantChunks(doc, query, relevanceResult, caseContext) 
          : [];

        return {
          documentId: doc.id,
          documentName: doc.name,
          batesNumber: doc.bates_number,
          caseId: doc.case_id,
          caseName: doc.cases?.name || 'Unknown Case',
          chunks,
          score: relevanceResult.score,
        };
      } catch (error) {
        console.error(`Error analyzing document ${doc.id}:`, error);
        return null;
      }
    })
  );

  // Filter out null results and sort by score
  const validResults = searchResults.filter((result): result is SearchResult => 
    result !== null
  );

  validResults.sort((a, b) => b.score - a.score);

  return validResults.slice(0, topK);
}

async function analyzeRelevance(query: string, documentText: string, caseContext?: string): Promise<{
  score: number;
  relevanceExplanation: string;
  keySections: Array<{ content: string; score: number; context: string }>;
}> {
  const { data, error } = await supabase.functions.invoke('ai-analyze', {
    body: {
      provider: 'gemini',
      model: 'gemini-2.0-flash-exp',
      systemPrompt: SEMANTIC_SEARCH_PROMPT,
      userPrompt: SEARCH_QUERY_PROMPT(query, documentText, caseContext),
      responseFormat: 'json',
    },
  });

  if (error) {
    console.error('Relevance analysis failed:', error);
    return {
      score: 0,
      relevanceExplanation: 'Analysis failed',
      keySections: [],
    };
  }

  const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;

  return {
    score: result.score || 0,
    relevanceExplanation: result.relevanceExplanation || '',
    keySections: result.keySections || [],
  };
}

async function extractRelevantChunks(
  document: Document,
  query: string,
  relevanceResult: { keySections: Array<{ content: string; score: number; context: string }> },
  caseContext?: string
): Promise<SearchResultChunk[]> {
  const chunks = getDocumentChunks(document);
  const relevantChunks: SearchResultChunk[] = [];

  // For each key section from AI analysis, find matching chunks
  for (const section of relevanceResult.keySections) {
    const bestChunk = findBestMatchingChunk(chunks, section.content);
    if (bestChunk) {
      relevantChunks.push({
        id: bestChunk.id,
        content: bestChunk.content,
        pageNumber: bestChunk.pageNumber,
        score: section.score,
        context: section.context,
      });
    }
  }

  // Fallback: if no sections matched, find chunks with keyword matches
  if (relevantChunks.length === 0) {
    const keywordMatches = findKeywordMatchingChunks(chunks, query);
    relevantChunks.push(...keywordMatches);
  }

  return relevantChunks;
}

function findBestMatchingChunk(chunks: DocumentChunk[], sectionContent: string): DocumentChunk | null {
  let bestMatch: DocumentChunk | null = null;
  let highestOverlap = 0;

  for (const chunk of chunks) {
    const overlap = calculateOverlap(chunk.content, sectionContent);
    if (overlap > highestOverlap) {
      highestOverlap = overlap;
      bestMatch = chunk;
    }
  }

  return highestOverlap > 0.1 ? bestMatch : null;
}

function calculateOverlap(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = set1.size + set2.size - intersection;
  
  return union > 0 ? intersection / union : 0;
}

function findKeywordMatchingChunks(chunks: DocumentChunk[], query: string): SearchResultChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

  for (const chunk of chunks) {
    const content = chunk.content.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = content.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    if (score > 0) {
      scoredChunks.push({
        chunk,
        score,
      });
    }
  }

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ chunk, score }) => ({
      id: chunk.id,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      score: Math.min(100, score * 20),
      context: 'Keyword match',
    }));
}

export async function searchDocuments(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SearchResult[]> {
  // First, try semantic search
  let results = await semanticSearch(query, options);

  // Fallback to keyword search if no semantic results
  if (results.length === 0) {
    results = await keywordSearchFallback(query, options);
  }

  return results;
}

async function keywordSearchFallback(query: string, options: SemanticSearchOptions): Promise<SearchResult[]> {
  console.log('Semantic search returned no results, falling back to keyword search');
  
  let documentsQuery = supabase
    .from('documents')
    .select(`
      *,
      cases:case_id (
        id,
        name
      )
    `);

  if (options.caseId) {
    documentsQuery = documentsQuery.eq('case_id', options.caseId);
  }

  const { data: documentsData, error } = await documentsQuery;

  if (error) {
    console.error('Keyword search failed:', error);
    return [];
  }

  const documents = documentsData as unknown as (Document & {
    cases: { id: string; name: string };
  })[];

  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const results: SearchResult[] = [];

  for (const doc of documents) {
    const documentText = doc.ocr_text || doc.summary || '';
    if (!documentText) continue;

    let documentScore = 0;
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = documentText.match(regex);
      if (matches) {
        documentScore += matches.length;
      }
    }

    if (documentScore > 0) {
      const chunks = getDocumentChunks(doc);
      const relevantChunks = findKeywordMatchingChunks(chunks, query);

      results.push({
        documentId: doc.id,
        documentName: doc.name,
        batesNumber: doc.bates_number,
        caseId: doc.case_id,
        caseName: doc.cases?.name || 'Unknown Case',
        chunks: relevantChunks,
        score: Math.min(100, documentScore * 10),
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, options.topK || 5);
}
