// src/lib/rateLimit.js
// Simple in-memory rate limiter for Next.js API routes
// Resets on server restart — sufficient for a single-user private tool

const store = new Map();

export function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  return function check(identifier = "global") {
    const now = Date.now();
    const key = identifier;

    if (!store.has(key)) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    const entry = store.get(key);

    // Reset window if expired
    if (now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (entry.count >= max) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count++;
    return { allowed: true };
  };
}

// Pre-built limiters for each route
export const chatLimiter    = rateLimit({ max: 60, windowMs: 60000 });
export const enrichLimiter  = rateLimit({ max: 30, windowMs: 60000 });
export const gmailLimiter   = rateLimit({ max: 10, windowMs: 60000 });
export const pipelineLimiter = rateLimit({ max: 60, windowMs: 60000 });
