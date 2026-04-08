import "server-only";

// ---------------------------------------------------------------------------
// Rate limiting utility — sliding window counter (in-memory)
// ---------------------------------------------------------------------------
//
// Provides per-key rate limiting for API routes and server actions.
// Default backend is in-memory (Map-based). A Redis backend can be
// swapped in via the RateLimitStore interface when traffic justifies it.
//
// All configuration is loaded from environment variables at first access,
// keeping hardcoded numeric values out of committed source.

// ── Store interface (strategy pattern) ────────────────────────────

export interface RateLimitStore {
  /** Increment counter for key, return { count, resetAtMs } */
  increment(key: string, windowMs: number): Promise<{ count: number; resetAtMs: number }>;
}

// ── In-memory store ───────────────────────────────────────────────

interface WindowEntry {
  count: number;
  startMs: number;
}

export class InMemoryStore implements RateLimitStore {
  private windows = new Map<string, WindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup of expired entries (every 60s)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    // Allow the interval to not keep the process alive
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAtMs: number }> {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now - entry.startMs >= windowMs) {
      // Start a new window
      const newEntry: WindowEntry = { count: 1, startMs: now };
      this.windows.set(key, newEntry);
      return { count: 1, resetAtMs: now + windowMs };
    }

    // Within existing window
    entry.count++;
    return { count: entry.count, resetAtMs: entry.startMs + windowMs };
  }

  private cleanup() {
    const now = Date.now();
    // Clean entries older than 5 minutes (generous to avoid race conditions)
    const maxAge = 5 * 60_000;
    for (const [key, entry] of this.windows) {
      if (now - entry.startMs > maxAge) {
        this.windows.delete(key);
      }
    }
  }

  /** Visible for testing */
  get size(): number {
    return this.windows.size;
  }
}

// ── Singleton store ───────────────────────────────────────────────

let _store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (!_store) {
    _store = new InMemoryStore();
  }
  return _store;
}

/** Override the global store (e.g., for Redis or testing) */
export function setRateLimitStore(store: RateLimitStore): void {
  _store = store;
}

// ── Configuration ─────────────────────────────────────────────────

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function getApiRateLimitConfig(): RateLimitConfig {
  return {
    windowMs: envInt("RATE_LIMIT_API_WINDOW_MS", 60_000),
    maxRequests: envInt("RATE_LIMIT_API_MAX_REQUESTS", 100),
  };
}

export function getPreflightRateLimitConfig(): RateLimitConfig {
  return {
    windowMs: envInt("RATE_LIMIT_PREFLIGHT_WINDOW_MS", 60_000),
    maxRequests: envInt("RATE_LIMIT_PREFLIGHT_MAX", 60),
  };
}

export function getMutationRateLimitConfig(action: "project" | "key" | "threshold"): RateLimitConfig {
  const suffix = action.toUpperCase();
  return {
    windowMs: envInt(`RATE_LIMIT_MUTATION_${suffix}_WINDOW_MS`, envInt("RATE_LIMIT_MUTATION_WINDOW_MS", 60_000)),
    maxRequests: envInt(`RATE_LIMIT_MUTATION_${suffix}_MAX`, envInt("RATE_LIMIT_MUTATION_MAX", 5)),
  };
}

// ── Rate limit check ──────────────────────────────────────────────

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * Check rate limit for a given key and config.
 * Returns { limited: false } if within limits, or { limited: true, retryAfterSeconds }
 * if the limit has been exceeded.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const store = getStore();
  const { count, resetAtMs } = await store.increment(key, config.windowMs);

  if (count > config.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
    return { limited: true, retryAfterSeconds };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

// ── IP resolution ─────────────────────────────────────────────────

/**
 * Resolve client IP from standard proxy headers.
 * Falls back to "unknown" if no IP can be determined.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain comma-separated IPs; first is the client
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
