interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  itemCount: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private stats: CacheStats;
  private accessOrder: string[] = [];

  constructor(maxSize: number = 100 * 1024 * 1024, defaultTTL: number = 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize,
      itemCount: 0,
    };
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    
    this.updateAccessOrder(key);
    this.stats.hits++;
    
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const entrySize = this.estimateSize(value);
    
    while (this.stats.size + entrySize > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (ttl ?? this.defaultTTL),
      createdAt: now,
      accessCount: 0,
      lastAccessedAt: now,
      size: entrySize,
    };
    
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.stats.size -= oldEntry.size;
    } else {
      this.stats.itemCount++;
    }
    
    this.cache.set(key, entry);
    this.stats.size += entrySize;
    this.updateAccessOrder(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.stats.size -= entry.size;
    this.stats.itemCount--;
    this.cache.delete(key);
    
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
    this.stats.itemCount = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder.shift()!;
    const entry = this.cache.get(lruKey);
    
    if (entry) {
      this.stats.size -= entry.size;
      this.stats.itemCount--;
      this.stats.evictions++;
      this.cache.delete(lruKey);
    }
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private estimateSize(value: T): number {
    if (typeof value === 'string') {
      return value.length * 2;
    }
    if (value instanceof ArrayBuffer) {
      return value.byteLength;
    }
    if (value instanceof Blob) {
      return value.size;
    }
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024;
    }
  }
}

export function createContentHash(content: string): string {
  let hash = 0;
  const str = content.trim();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

export function createDocumentCacheKey(
  documentId: string,
  operation: string,
  options?: Record<string, unknown>
): string {
  const optionsHash = options ? createContentHash(JSON.stringify(options)) : '';
  return `${documentId}:${operation}:${optionsHash}`;
}

const analysisCache = new LRUCache<unknown>(50 * 1024 * 1024, 2 * 60 * 60 * 1000);
const extractionCache = new LRUCache<string>(100 * 1024 * 1024, 24 * 60 * 60 * 1000);
const chunkCache = new LRUCache<unknown>(30 * 1024 * 1024, 60 * 60 * 1000);

export function cacheAnalysisResult<T>(
  documentId: string,
  analysisType: string,
  result: T,
  ttl?: number
): void {
  const key = createDocumentCacheKey(documentId, `analysis:${analysisType}`);
  analysisCache.set(key, result, ttl);
}

export function getCachedAnalysis<T>(
  documentId: string,
  analysisType: string
): T | undefined {
  const key = createDocumentCacheKey(documentId, `analysis:${analysisType}`);
  return analysisCache.get(key) as T | undefined;
}

export function cacheExtractionResult(
  documentId: string,
  contentHash: string,
  text: string,
  ttl?: number
): void {
  const key = createDocumentCacheKey(documentId, `extraction:${contentHash}`);
  extractionCache.set(key, text, ttl);
}

export function getCachedExtraction(
  documentId: string,
  contentHash: string
): string | undefined {
  const key = createDocumentCacheKey(documentId, `extraction:${contentHash}`);
  return extractionCache.get(key);
}

export function cacheChunks(
  documentId: string,
  options: Record<string, unknown>,
  chunks: unknown
): void {
  const key = createDocumentCacheKey(documentId, 'chunks', options);
  chunkCache.set(key, chunks);
}

export function getCachedChunks<T>(
  documentId: string,
  options: Record<string, unknown>
): T | undefined {
  const key = createDocumentCacheKey(documentId, 'chunks', options);
  return chunkCache.get(key) as T | undefined;
}

export function invalidateDocumentCache(documentId: string): void {
  for (const cache of [analysisCache, extractionCache, chunkCache]) {
    for (const key of (cache as unknown as { cache: Map<string, unknown> }).cache.keys()) {
      if (key.startsWith(documentId)) {
        cache.delete(key);
      }
    }
  }
}

export function getCacheStats(): {
  analysis: CacheStats;
  extraction: CacheStats;
  chunks: CacheStats;
} {
  return {
    analysis: analysisCache.getStats(),
    extraction: extractionCache.getStats(),
    chunks: chunkCache.getStats(),
  };
}

export function clearAllCaches(): void {
  analysisCache.clear();
  extractionCache.clear();
  chunkCache.clear();
}
