import { z } from 'zod';

const schema = z.object({
  maxRequests: z.number().int().min(1),
  windowMs: z.number().int().min(100),
  keyFn: z.function().optional(),
  onLimitReached: z.function().optional(),
});

/**
 * Create an in-memory rate limiter. Zero external dependencies.
 * Compatible with both Express (req, res, next) and standalone use.
 *
 * @param {object} options
 * @param {number} options.maxRequests - Maximum requests allowed per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {function} [options.keyFn] - Called with (req) to derive the rate-limit key. Defaults to IP.
 * @param {function} [options.onLimitReached] - Called with (key, req) when limit is hit.
 * @returns {function} Express-compatible middleware (req, res, next) or call check(key) directly
 * @throws {Error} If options are invalid
 */
export function createRateLimiter({ maxRequests, windowMs, keyFn, onLimitReached } = {}) {
  const parsed = schema.safeParse({ maxRequests, windowMs, keyFn, onLimitReached });
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join('; ');
    throw new Error(`createRateLimiter: invalid options — ${msg}`);
  }

  const store = new Map(); // key → { count, resetAt }

  function _getEntry(key) {
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    return entry;
  }

  /**
   * Check and increment the rate limit for a given key.
   * @param {string} key - Identifier (IP, user ID, etc.)
   * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
   */
  function check(key) {
    const entry = _getEntry(key);
    const allowed = entry.count < maxRequests;
    if (allowed) entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);
    return { allowed, remaining, resetAt: entry.resetAt };
  }

  /**
   * Reset the limit for a specific key.
   * @param {string} key
   */
  function reset(key) {
    store.delete(key);
  }

  /**
   * Clear all stored rate limit entries.
   */
  function clear() {
    store.clear();
  }

  // Express / Next.js middleware
  function middleware(req, res, next) {
    const key = keyFn ? keyFn(req) : _extractIp(req);
    const result = check(key);

    res.setHeader?.('X-RateLimit-Limit', maxRequests);
    res.setHeader?.('X-RateLimit-Remaining', result.remaining);
    res.setHeader?.('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      if (onLimitReached) onLimitReached(key, req);
      const send = res.status?.(429).json ?? res.json;
      if (typeof res.status === 'function') {
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
      } else {
        res.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
      }
      return;
    }

    if (typeof next === 'function') next();
  }

  middleware.check = check;
  middleware.reset = reset;
  middleware.clear = clear;

  return middleware;
}

function _extractIp(req) {
  return (
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
    req?.ip ??
    req?.connection?.remoteAddress ??
    'unknown'
  );
}
