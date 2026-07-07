import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TokenBucketRateLimiter, checkRateLimit } from "@/lib/rate-limiter";

describe("TokenBucketRateLimiter", () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    limiter = new TokenBucketRateLimiter(
      { maxTokens: 100, refillRate: 10, refillInterval: 60000 }, // global
      { maxTokens: 10, refillRate: 5, refillInterval: 60000 }    // per-user
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── checkLimit ──────────────────────────────────────────────────────────────

  it("allows requests within the token budget", () => {
    const result = limiter.checkLimit("user:alice", 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("denies requests when tokens are exhausted", () => {
    // Exhaust all tokens for a fresh key
    for (let i = 0; i < 10; i++) {
      limiter.checkLimit("user:depleted", 1);
    }
    const result = limiter.checkLimit("user:depleted", 1);
    expect(result.allowed).toBe(false);
  });

  it("tracks remaining tokens after each request", () => {
    limiter.checkLimit("user:bob", 1);
    const second = limiter.checkLimit("user:bob", 1);
    expect(second.remaining).toBe(8); // 10 - 2
  });

  it("allows multiple tokens per request when budget permits", () => {
    const result = limiter.checkLimit("user:multi", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5); // 10 - 5
  });

  it("refills tokens after the refill interval elapses", () => {
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) limiter.checkLimit("user:refill", 1);
    expect(limiter.checkLimit("user:refill", 1).allowed).toBe(false);

    // Advance time past one refill interval
    vi.advanceTimersByTime(60001);

    const result = limiter.checkLimit("user:refill", 1);
    expect(result.allowed).toBe(true);
  });

  // ── checkUserLimit / checkModelLimit / checkGlobalLimit ─────────────────────

  it("checkUserLimit prefixes key with 'user:'", () => {
    const result = limiter.checkUserLimit("alice");
    expect(result.allowed).toBe(true);
  });

  it("checkModelLimit uses model-specific config when known", () => {
    // 'gpt-4o' has maxTokens=50 in the default MODEL_LIMITS
    const defaultLimiter = new TokenBucketRateLimiter();
    const result = defaultLimiter.checkModelLimit("gpt-4o");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(49); // 50 - 1
  });

  it("checkGlobalLimit works independently from user limits", () => {
    const result = limiter.checkGlobalLimit(1);
    expect(result.allowed).toBe(true);
  });

  // ── checkCombinedLimit ──────────────────────────────────────────────────────

  it("allows request when all limits have budget", () => {
    const result = limiter.checkCombinedLimit("alice", undefined, 1);
    expect(result.allowed).toBe(true);
  });

  it("blocks with reason when user limit is exhausted", () => {
    for (let i = 0; i < 10; i++) limiter.checkUserLimit("carol");
    const result = limiter.checkCombinedLimit("carol", undefined, 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/user rate limit/i);
  });

  // ── reset ───────────────────────────────────────────────────────────────────

  it("reset(key) restores full token budget for that key", () => {
    for (let i = 0; i < 10; i++) limiter.checkLimit("user:dave", 1);
    expect(limiter.checkLimit("user:dave", 1).allowed).toBe(false);

    limiter.reset("user:dave");
    expect(limiter.checkLimit("user:dave", 1).allowed).toBe(true);
  });

  it("reset() without key clears all limits", () => {
    limiter.checkLimit("user:eve", 1);
    limiter.checkLimit("user:frank", 1);
    limiter.reset();

    expect(limiter.getRemainingTokens("user:eve")).toBe(0);
    expect(limiter.getRemainingTokens("user:frank")).toBe(0);
  });

  // ── getStats ────────────────────────────────────────────────────────────────

  it("tracks totalRequests and allowedRequests in stats", () => {
    limiter.checkLimit("user:stats", 1);
    limiter.checkLimit("user:stats", 1);

    const stats = limiter.getStats("user:stats") as {
      totalRequests: number;
      allowedRequests: number;
    };

    expect(stats.totalRequests).toBe(2);
    expect(stats.allowedRequests).toBe(2);
  });

  it("tracks deniedRequests when limit is exceeded", () => {
    for (let i = 0; i < 10; i++) limiter.checkLimit("user:denied", 1);
    limiter.checkLimit("user:denied", 1); // this one should be denied

    const stats = limiter.getStats("user:denied") as { deniedRequests: number };
    expect(stats.deniedRequests).toBeGreaterThanOrEqual(1);
  });

  it("getStats with no key returns all stats as a Map", () => {
    limiter.checkLimit("user:a", 1);
    limiter.checkLimit("user:b", 1);

    const allStats = limiter.getStats();
    expect(allStats instanceof Map).toBe(true);
  });

  // ── addToLimit ──────────────────────────────────────────────────────────────

  it("addToLimit increases available tokens", () => {
    // Use up all tokens
    for (let i = 0; i < 10; i++) limiter.checkLimit("user:add", 1);
    expect(limiter.checkLimit("user:add", 1).allowed).toBe(false);

    limiter.addToLimit("user:add", 5);
    expect(limiter.checkLimit("user:add", 1).allowed).toBe(true);
  });
});

// ── checkRateLimit (functional API) ───────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows requests within the window", () => {
    const result = checkRateLimit("test-key", 10, 60000);
    expect(result.allowed).toBe(true);
  });

  it("returns a resetAt timestamp in the future", () => {
    const before = Date.now();
    const result = checkRateLimit("future-key", 5, 30000);
    expect(result.resetAt).toBeGreaterThan(before);
  });
});
