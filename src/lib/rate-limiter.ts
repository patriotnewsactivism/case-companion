interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  queue: Array<{
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
    tokens: number;
  }>;
}

interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
  refillInterval: number;
}

interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  queuedRequests: number;
  currentTokens: number;
  maxTokens: number;
}

const DEFAULT_GLOBAL_LIMIT: RateLimiterConfig = {
  maxTokens: 100,
  refillRate: 10,
  refillInterval: 60000,
};

const DEFAULT_USER_LIMIT: RateLimiterConfig = {
  maxTokens: 20,
  refillRate: 5,
  refillInterval: 60000,
};

const MODEL_LIMITS: Record<string, RateLimiterConfig> = {
  'gpt-4o': { maxTokens: 50, refillRate: 10, refillInterval: 60000 },
  'gpt-4-turbo': { maxTokens: 50, refillRate: 10, refillInterval: 60000 },
  'gpt-3.5-turbo': { maxTokens: 100, refillRate: 20, refillInterval: 60000 },
  'azure-doc-intelligence': { maxTokens: 30, refillRate: 10, refillInterval: 60000 },
  'ocr': { maxTokens: 50, refillRate: 10, refillInterval: 60000 },
};

export class TokenBucketRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private globalConfig: RateLimiterConfig;
  private userConfig: RateLimiterConfig;
  private modelLimits: Record<string, RateLimiterConfig>;
  private stats: Map<string, RateLimitStats> = new Map();

  constructor(
    globalConfig: RateLimiterConfig = DEFAULT_GLOBAL_LIMIT,
    userConfig: RateLimiterConfig = DEFAULT_USER_LIMIT,
    modelLimits: Record<string, RateLimiterConfig> = MODEL_LIMITS
  ) {
    this.globalConfig = globalConfig;
    this.userConfig = userConfig;
    this.modelLimits = modelLimits;
  }

  checkLimit(
    key: string,
    tokens: number = 1,
    config?: RateLimiterConfig
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const limitConfig = config || this.userConfig;
    const now = Date.now();
    
    let entry = this.limits.get(key);
    
    if (!entry) {
      entry = {
        tokens: limitConfig.maxTokens,
        lastRefill: now,
        queue: [],
      };
      this.limits.set(key, entry);
      this.stats.set(key, {
        totalRequests: 0,
        allowedRequests: 0,
        deniedRequests: 0,
        queuedRequests: 0,
        currentTokens: limitConfig.maxTokens,
        maxTokens: limitConfig.maxTokens,
      });
    }
    
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor(timePassed / limitConfig.refillInterval) * limitConfig.refillRate;
    
    if (tokensToAdd > 0) {
      entry.tokens = Math.min(limitConfig.maxTokens, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }
    
    const stats = this.stats.get(key)!;
    stats.totalRequests++;
    stats.currentTokens = entry.tokens;
    
    if (entry.tokens >= tokens) {
      entry.tokens -= tokens;
      stats.allowedRequests++;
      stats.currentTokens = entry.tokens;
      
      const resetAt = now + limitConfig.refillInterval;
      
      return { allowed: true, remaining: entry.tokens, resetAt };
    }
    
    stats.deniedRequests++;
    
    const tokensNeeded = tokens - entry.tokens;
    const timeToRefill = Math.ceil(tokensNeeded / limitConfig.refillRate) * limitConfig.refillInterval;
    const resetAt = now + timeToRefill;
    
    return { allowed: false, remaining: entry.tokens, resetAt };
  }

  async waitForTokens(
    key: string,
    tokens: number = 1,
    config?: RateLimiterConfig,
    maxWaitMs: number = 30000
  ): Promise<boolean> {
    const result = this.checkLimit(key, tokens, config);
    
    if (result.allowed) {
      return true;
    }
    
    const entry = this.limits.get(key);
    if (!entry) return false;
    
    const limitConfig = config || this.userConfig;
    const stats = this.stats.get(key)!;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = entry.queue.findIndex(q => q.resolve === resolve);
        if (index > -1) {
          entry.queue.splice(index, 1);
          stats.queuedRequests--;
        }
        reject(new Error('Rate limit wait timeout'));
      }, maxWaitMs);
      
      entry.queue.push({
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        tokens,
      });
      
      stats.queuedRequests++;
      
      this.processQueue(key, limitConfig);
    });
  }

  private processQueue(key: string, config: RateLimiterConfig): void {
    const entry = this.limits.get(key);
    const stats = this.stats.get(key);
    
    if (!entry || !stats || entry.queue.length === 0) return;
    
    const now = Date.now();
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor(timePassed / config.refillInterval) * config.refillRate;
    
    if (tokensToAdd > 0) {
      entry.tokens = Math.min(config.maxTokens, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }
    
    while (entry.queue.length > 0 && entry.tokens > 0) {
      const next = entry.queue[0];
      
      if (entry.tokens >= next.tokens) {
        entry.tokens -= next.tokens;
        entry.queue.shift();
        stats.queuedRequests--;
        stats.allowedRequests++;
        stats.currentTokens = entry.tokens;
        next.resolve(true);
      } else {
        break;
      }
    }
  }

  checkUserLimit(userId: string, tokens: number = 1): { allowed: boolean; remaining: number; resetAt: number } {
    return this.checkLimit(`user:${userId}`, tokens, this.userConfig);
  }

  checkModelLimit(model: string, tokens: number = 1): { allowed: boolean; remaining: number; resetAt: number } {
    const config = this.modelLimits[model] || this.globalConfig;
    return this.checkLimit(`model:${model}`, tokens, config);
  }

  checkGlobalLimit(tokens: number = 1): { allowed: boolean; remaining: number; resetAt: number } {
    return this.checkLimit('global', tokens, this.globalConfig);
  }

  checkCombinedLimit(
    userId: string,
    model?: string,
    tokens: number = 1
  ): { allowed: boolean; remaining: number; resetAt: number; reason?: string } {
    const globalResult = this.checkGlobalLimit(tokens);
    if (!globalResult.allowed) {
      return { ...globalResult, reason: 'Global rate limit exceeded' };
    }
    
    const userResult = this.checkUserLimit(userId, tokens);
    if (!userResult.allowed) {
      return { ...userResult, reason: 'User rate limit exceeded' };
    }
    
    if (model) {
      const modelResult = this.checkModelLimit(model, tokens);
      if (!modelResult.allowed) {
        return { ...modelResult, reason: `Model ${model} rate limit exceeded` };
      }
    }
    
    return { allowed: true, remaining: Math.min(globalResult.remaining, userResult.remaining), resetAt: Math.max(globalResult.resetAt, userResult.resetAt) };
  }

  getStats(key?: string): RateLimitStats | Map<string, RateLimitStats> {
    if (key) {
      return this.stats.get(key) || {
        totalRequests: 0,
        allowedRequests: 0,
        deniedRequests: 0,
        queuedRequests: 0,
        currentTokens: 0,
        maxTokens: 0,
      };
    }
    return new Map(this.stats);
  }

  reset(key?: string): void {
    if (key) {
      this.limits.delete(key);
      this.stats.delete(key);
    } else {
      this.limits.clear();
      this.stats.clear();
    }
  }

  getRemainingTokens(key: string): number {
    const entry = this.limits.get(key);
    return entry?.tokens ?? 0;
  }

  addToLimit(key: string, tokens: number, config?: RateLimiterConfig): void {
    const limitConfig = config || this.userConfig;
    const entry = this.limits.get(key);
    
    if (entry) {
      entry.tokens = Math.min(limitConfig.maxTokens, entry.tokens + tokens);
    }
  }
}

const defaultRateLimiter = new TokenBucketRateLimiter();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const config: RateLimiterConfig = {
    maxTokens: maxRequests,
    refillRate: maxRequests,
    refillInterval: windowMs,
  };
  
  const result = defaultRateLimiter.checkLimit(key, 1, config);
  return { allowed: result.allowed, resetAt: result.resetAt };
}

export function checkUserRateLimit(
  userId: string,
  operation: string,
  tokens: number = 1
): { allowed: boolean; remaining: number; resetAt: number; reason?: string } {
  return defaultRateLimiter.checkCombinedLimit(userId, operation, tokens);
}

export function getRateLimiter(): TokenBucketRateLimiter {
  return defaultRateLimiter;
}

export function createRateLimiter(
  globalConfig?: Partial<RateLimiterConfig>,
  userConfig?: Partial<RateLimiterConfig>
): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter(
    { ...DEFAULT_GLOBAL_LIMIT, ...globalConfig },
    { ...DEFAULT_USER_LIMIT, ...userConfig }
  );
}
