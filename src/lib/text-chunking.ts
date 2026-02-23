export interface TextChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  sourceFile?: string;
  documentId?: string;
  chunkIndex: number;
  totalChunks: number;
  wordCount: number;
  charCount: number;
  previousChunkId?: string;
  nextChunkId?: string;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlapSize?: number;
  respectSentenceBoundaries?: boolean;
  includeMetadata?: boolean;
}

const DEFAULT_MAX_CHUNK_SIZE = 8000;
const DEFAULT_MIN_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP_SIZE = 200;

export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): TextChunk[] {
  const {
    maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
    minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
    overlapSize = DEFAULT_OVERLAP_SIZE,
    respectSentenceBoundaries = true,
  } = options;

  if (text.length <= maxChunkSize) {
    return [createChunk(text, 0, 1, 0, text.length)];
  }

  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChunkSize, text.length);
    
    if (endIndex < text.length && respectSentenceBoundaries) {
      const adjustedEnd = findSentenceBoundary(text, endIndex);
      if (adjustedEnd > currentIndex + minChunkSize) {
        endIndex = adjustedEnd;
      }
    }

    const chunkContent = text.substring(currentIndex, endIndex);
    const chunk = createChunk(
      chunkContent,
      chunkIndex,
      -1,
      currentIndex,
      endIndex
    );
    
    chunks.push(chunk);
    
    currentIndex = endIndex - overlapSize;
    if (currentIndex <= chunks[chunks.length - 2]?.endIndex) {
      currentIndex = endIndex;
    }
    
    chunkIndex++;
  }

  const totalChunks = chunks.length;
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].metadata.totalChunks = totalChunks;
    chunks[i].metadata.chunkIndex = i;
    
    if (i > 0) {
      chunks[i].metadata.previousChunkId = chunks[i - 1].id;
      chunks[i - 1].metadata.nextChunkId = chunks[i].id;
    }
  }

  return chunks;
}

function createChunk(
  content: string,
  index: number,
  totalChunks: number,
  startIndex: number,
  endIndex: number
): TextChunk {
  const wordCount = countWords(content);
  const charCount = content.length;
  
  return {
    id: generateChunkId(index),
    content,
    startIndex,
    endIndex,
    metadata: {
      chunkIndex: index,
      totalChunks,
      wordCount,
      charCount,
    },
  };
}

function generateChunkId(index: number): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `chunk_${timestamp}_${random}_${index}`;
}

function findSentenceBoundary(text: string, position: number): number {
  const sentenceEnders = ['.', '!', '?', '。', '！', '？'];
  
  for (let i = position; i > position - 500 && i >= 0; i--) {
    const char = text[i];
    if (sentenceEnders.includes(char)) {
      if (i + 1 < text.length) {
        const nextChar = text[i + 1];
        if (nextChar === ' ' || nextChar === '\n' || nextChar === '\r') {
          return i + 1;
        }
      } else {
        return i + 1;
      }
    }
  }
  
  for (let i = position; i > position - 500 && i >= 0; i--) {
    const char = text[i];
    if (char === '\n' || char === '\r') {
      return i;
    }
  }
  
  for (let i = position; i > position - 500 && i >= 0; i--) {
    const char = text[i];
    if (char === ' ') {
      return i;
    }
  }
  
  return position;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

export function chunkDocumentWithPages(
  text: string,
  pageBreaks: number[],
  options: ChunkingOptions = {}
): TextChunk[] {
  const {
    maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
    minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
    overlapSize = DEFAULT_OVERLAP_SIZE,
    respectSentenceBoundaries = true,
  } = options;

  const chunks: TextChunk[] = [];
  let globalChunkIndex = 0;
  
  const pageRanges: { start: number; end: number; pageNumber: number }[] = [];
  let lastBreak = 0;
  
  for (let i = 0; i < pageBreaks.length; i++) {
    pageRanges.push({ start: lastBreak, end: pageBreaks[i], pageNumber: i + 1 });
    lastBreak = pageBreaks[i];
  }
  pageRanges.push({ start: lastBreak, end: text.length, pageNumber: pageBreaks.length + 1 });

  for (const pageRange of pageRanges) {
    const pageText = text.substring(pageRange.start, pageRange.end);
    
    if (pageText.length <= maxChunkSize) {
      const chunk = createChunk(
        pageText,
        globalChunkIndex,
        -1,
        pageRange.start,
        pageRange.end
      );
      chunk.pageNumber = pageRange.pageNumber;
      chunks.push(chunk);
      globalChunkIndex++;
    } else {
      let currentIndex = pageRange.start;
      
      while (currentIndex < pageRange.end) {
        let endIndex = Math.min(currentIndex + maxChunkSize, pageRange.end);
        
        if (endIndex < pageRange.end && respectSentenceBoundaries) {
          const adjustedEnd = findSentenceBoundary(text, endIndex);
          if (adjustedEnd > currentIndex + minChunkSize) {
            endIndex = adjustedEnd;
          }
        }
        
        const chunkContent = text.substring(currentIndex, endIndex);
        const chunk = createChunk(
          chunkContent,
          globalChunkIndex,
          -1,
          currentIndex,
          endIndex
        );
        chunk.pageNumber = pageRange.pageNumber;
        chunks.push(chunk);
        
        currentIndex = endIndex - overlapSize;
        if (currentIndex <= chunks[chunks.length - 2]?.endIndex) {
          currentIndex = endIndex;
        }
        
        globalChunkIndex++;
      }
    }
  }

  const totalChunks = chunks.length;
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].metadata.totalChunks = totalChunks;
    chunks[i].metadata.chunkIndex = i;
    
    if (i > 0) {
      chunks[i].metadata.previousChunkId = chunks[i - 1].id;
      chunks[i - 1].metadata.nextChunkId = chunks[i].id;
    }
  }

  return chunks;
}

export function mergeChunks(chunks: TextChunk[], maxResultSize: number): string {
  const result: string[] = [];
  let currentSize = 0;
  
  for (const chunk of chunks) {
    const chunkSize = chunk.content.length;
    
    if (currentSize + chunkSize <= maxResultSize) {
      result.push(chunk.content);
      currentSize += chunkSize;
    } else if (currentSize === 0) {
      result.push(chunk.content.substring(0, maxResultSize));
      break;
    } else {
      break;
    }
  }
  
  return result.join('\n\n');
}

export function getChunksForContext(
  chunks: TextChunk[],
  targetChunkIndex: number,
  contextSize: number
): TextChunk[] {
  const start = Math.max(0, targetChunkIndex - contextSize);
  const end = Math.min(chunks.length, targetChunkIndex + contextSize + 1);
  return chunks.slice(start, end);
}

export function findRelevantChunks(
  chunks: TextChunk[],
  query: string,
  topK: number = 5
): TextChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const scored = chunks.map(chunk => {
    const content = chunk.content.toLowerCase();
    let score = 0;
    
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = content.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    return { chunk, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topK).map(s => s.chunk);
}

export function formatChunksForAI(chunks: TextChunk[]): string {
  return chunks.map((chunk, index) => {
    const header = `[Chunk ${index + 1}/${chunk.metadata.totalChunks}]`;
    const page = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
    return `${header}${page}\n${chunk.content}`;
  }).join('\n\n---\n\n');
}

export function estimateTokenCount(text: string): number {
  const avgCharsPerToken = 4;
  return Math.ceil(text.length / avgCharsPerToken);
}

export function optimizeChunksForTokenLimit(
  chunks: TextChunk[],
  maxTokens: number
): TextChunk[] {
  const result: TextChunk[] = [];
  let totalTokens = 0;
  
  for (const chunk of chunks) {
    const chunkTokens = estimateTokenCount(chunk.content);
    
    if (totalTokens + chunkTokens <= maxTokens) {
      result.push(chunk);
      totalTokens += chunkTokens;
    } else if (totalTokens === 0) {
      const truncatedContent = chunk.content.substring(0, maxTokens * 4);
      result.push({
        ...chunk,
        content: truncatedContent,
        metadata: {
          ...chunk.metadata,
          charCount: truncatedContent.length,
          wordCount: countWords(truncatedContent),
        },
      });
      break;
    } else {
      break;
    }
  }
  
  return result;
}
