/**
 * Rate Limiting with Upstash Redis
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

const RATE_LIMIT_WINDOW = "1 m";
const RATE_LIMIT_RESET_MS = 60_000;

const AUTHENTICATED_LIMIT = 100;
const PUBLIC_LIMIT = 60;
const DEVICE_CODE_LIMIT = 10;
const DEVICE_TOKEN_LIMIT = 30;

const kvRestApiUrl = process.env.KV_REST_API_URL;
const kvRestApiToken = process.env.KV_REST_API_TOKEN;

// Redis client is optional; missing config triggers fail-closed behavior.
const redis = kvRestApiUrl && kvRestApiToken
  ? new Redis({
      url: kvRestApiUrl,
      token: kvRestApiToken,
    })
  : null;

let hasLoggedMissingConfig = false;

function logMissingConfigOnce(): void {
  if (hasLoggedMissingConfig || redis) {
    return;
  }

  hasLoggedMissingConfig = true;
  logger.warn(
    "Rate limiting is running in fail-closed mode because KV_REST_API_URL/KV_REST_API_TOKEN are not configured."
  );
}

function createLimiter(limit: number, prefix: string): Ratelimit | null {
  if (!redis) {
    return null;
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, RATE_LIMIT_WINDOW),
    analytics: true,
    prefix,
  });
}

// Rate limiter for authenticated users: 100 requests per minute
export const authenticatedLimiter = createLimiter(AUTHENTICATED_LIMIT, "ratelimit:authenticated");

// Rate limiter for public/anonymous API access: 60 requests per minute per IP
export const publicLimiter = createLimiter(PUBLIC_LIMIT, "ratelimit:public");

// Rate limiter for device code creation: 10 requests per minute per IP
export const deviceCodeLimiter = createLimiter(DEVICE_CODE_LIMIT, "ratelimit:device-code");

// Rate limiter for device token polling: 30 requests per minute per IP
export const deviceTokenLimiter = createLimiter(DEVICE_TOKEN_LIMIT, "ratelimit:device-token");

export type RateLimitPolicy = "upstash" | "fail-closed";
export type RateLimitStatus = "normal" | "degraded";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  policy?: RateLimitPolicy;
  status?: RateLimitStatus;
}

function failClosedResult(limit: number): RateLimitResult {
  return {
    success: false,
    limit,
    remaining: 0,
    reset: Date.now() + RATE_LIMIT_RESET_MS,
    policy: "fail-closed",
    status: "degraded",
  };
}

async function runRateLimitCheck(
  limiter: Ratelimit | null,
  key: string,
  fallbackLimit: number,
  errorLabel: string
): Promise<RateLimitResult> {
  if (!limiter) {
    logMissingConfigOnce();
    return failClosedResult(fallbackLimit);
  }

  try {
    const result = await limiter.limit(key);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      policy: "upstash",
      status: "normal",
    };
  } catch (error) {
    logger.error(`${errorLabel} Entering fail-closed mode.`, error);
    return failClosedResult(fallbackLimit);
  }
}

/**
 * Check rate limit for a user
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  return runRateLimitCheck(
    authenticatedLimiter,
    userId,
    AUTHENTICATED_LIMIT,
    "Rate limit check failed."
  );
}

/**
 * Check rate limit for a public (unauthenticated) request by IP
 */
export async function checkPublicRateLimit(
  ip: string
): Promise<RateLimitResult> {
  return runRateLimitCheck(publicLimiter, ip, PUBLIC_LIMIT, "Public rate limit check failed.");
}

/**
 * Check rate limit for the device code endpoint by IP
 */
export async function checkDeviceCodeRateLimit(ip: string): Promise<RateLimitResult> {
  return runRateLimitCheck(
    deviceCodeLimiter,
    ip,
    DEVICE_CODE_LIMIT,
    "Device code rate limit check failed."
  );
}

/**
 * Check rate limit for the device token endpoint by IP
 */
export async function checkDeviceTokenRateLimit(ip: string): Promise<RateLimitResult> {
  return runRateLimitCheck(
    deviceTokenLimiter,
    ip,
    DEVICE_TOKEN_LIMIT,
    "Device token rate limit check failed."
  );
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfterSeconds = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));

  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "X-RateLimit-Policy": result.policy ?? "upstash",
    "X-RateLimit-Status": result.status ?? "normal",
    "Retry-After": String(retryAfterSeconds),
  };
}
