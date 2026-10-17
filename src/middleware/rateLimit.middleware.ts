import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const maxBuckets = 20_000;
let requestCount = 0;

const respondRateLimited = (res: Response, retryAfterMs: number): void => {
  res.setHeader('Retry After', Math.max(1, Math.ceil(retryAfterMs / 1000)));
  res.status(429).json({ success: false, statusCode: 429, error: 'Too many requests. Please try again later.' });
};

export const rateLimit = ({
  name,
  limit,
  windowMs,
  key,
}: {
  name: string;
  limit: number;
  windowMs: number;
  key: (req: Request) => string;
}) => (req: Request, res: Response, next: NextFunction): void => {
  const now = Date.now();
  requestCount += 1;
  if (requestCount % 100 === 0 || buckets.size >= maxBuckets) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const bucketKey = `${name}:${key(req)}`;
  let bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= maxBuckets) {
      let nextResetAt = Number.POSITIVE_INFINITY;
      for (const existingBucket of buckets.values()) {
        nextResetAt = Math.min(nextResetAt, existingBucket.resetAt);
      }
      respondRateLimited(res, nextResetAt - now);
      return;
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    respondRateLimited(res, bucket.resetAt - now);
    return;
  }

  next();
};

export const getRequestRateLimitKey = (req: Request): string =>
  req.ip ?? req.socket.remoteAddress ?? 'unknown';

export const getEmailRateLimitKey = (req: Request): string => {
  const ip = getRequestRateLimitKey(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;
  return `${ip}:${email ?? 'missing-email'}`;
};
