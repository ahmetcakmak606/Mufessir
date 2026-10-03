import type { Request, Response, NextFunction } from "express";

/**
 * Minimal in-memory sliding-window rate limiter (plan 1B.8 — interim).
 *
 * Scope and limits:
 *  - SINGLE INSTANCE ONLY. Counters live in this process; the permanent
 *    fix (plan 3.1) moves attack counters to the database so they survive
 *    restarts and apply across instances.
 *  - Client IP comes from X-Forwarded-For ONLY when TRUST_PROXY=1 (deployed
 *    behind a trusted reverse proxy such as Railway); otherwise the socket
 *    address is used, so attackers cannot spoof the header to rotate keys.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Keep the map bounded: drop expired buckets opportunistically.
function prune(now: number, windowMs: number): void {
  if (buckets.size < 10_000) return;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

/**
 * Resolves the client IP from the RIGHT end of X-Forwarded-For.
 *
 * XFF is appended left-to-right by each proxy; only the rightmost `hops`
 * entries were written by proxies we trust (TRUST_PROXY=<n>). Everything
 * left of that was supplied by the client and must not be trusted — using
 * the first value (as an earlier draft did) lets attackers rotate limiter
 * keys by sending a fake header. With fewer entries than trusted hops the
 * header is left untouched by our chain → fall back to the socket address.
 */
export function getClientIp(req: Request): string {
  const raw = process.env.TRUST_PROXY;
  const hops =
    raw === "1" || raw === "true"
      ? 1
      : Number(raw) > 0
        ? Math.floor(Number(raw))
        : 0;
  if (hops > 0) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const parts = forwarded
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (parts.length >= hops) {
        return parts[parts.length - hops]!;
      }
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Stable identifier for the counter (include the bucket name yourself). */
  key: (req: Request) => string;
  message?: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, key, message } = options;
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    prune(now, windowMs);
    const id = key(req);
    const bucket = buckets.get(id) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length >= max) {
      const retryAfterSec = Math.ceil(
        (bucket.timestamps[0]! + windowMs - now) / 1000,
      );
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      res.status(429).json({
        error: message ?? "Too many requests, please try again later",
      });
      return;
    }
    bucket.timestamps.push(now);
    buckets.set(id, bucket);
    next();
  };
}

/** Check-only: is the counter for this key already at its limit? */
export function isRateLimited(
  key: string,
  windowMs: number,
  max: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return false;
  const recent = bucket.timestamps.filter((t) => now - t < windowMs);
  return recent.length >= max;
}

/** Records a consumption event against an ad-hoc key (e.g. a failed code). */
export function recordRateEvent(
  key: string,
  windowMs: number,
  max: number,
): { limited: boolean } {
  if (isRateLimited(key, windowMs, max)) return { limited: true };
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { limited: false };
}

/** Test helper: forget counters (kept local to this process). */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
