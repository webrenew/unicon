import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitResult } from "@/lib/rate-limit";

const originalKvRestApiUrl = process.env.KV_REST_API_URL;
const originalKvRestApiToken = process.env.KV_REST_API_TOKEN;

describe("rate-limit helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    if (typeof originalKvRestApiUrl === "string") {
      process.env.KV_REST_API_URL = originalKvRestApiUrl;
    } else {
      delete process.env.KV_REST_API_URL;
    }

    if (typeof originalKvRestApiToken === "string") {
      process.env.KV_REST_API_TOKEN = originalKvRestApiToken;
    } else {
      delete process.env.KV_REST_API_TOKEN;
    }

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns all rate-limit headers with policy/status metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-18T12:00:00.000Z"));

    const { getRateLimitHeaders } = await import("@/lib/rate-limit");

    const result: RateLimitResult = {
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 60_000,
      policy: "fail-closed",
      status: "degraded",
    };

    const headers = getRateLimitHeaders(result);

    expect(headers["X-RateLimit-Limit"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Policy"]).toBe("fail-closed");
    expect(headers["X-RateLimit-Status"]).toBe("degraded");
    expect(headers["Retry-After"]).toBe("60");
  });

  it("defaults policy/status headers for normal Upstash responses", async () => {
    const { getRateLimitHeaders } = await import("@/lib/rate-limit");

    const result: RateLimitResult = {
      success: true,
      limit: 100,
      remaining: 95,
      reset: 1700000000,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers["X-RateLimit-Policy"]).toBe("upstash");
    expect(headers["X-RateLimit-Status"]).toBe("normal");
  });

  it("fails closed for public and authenticated limit checks when KV is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const {
      checkPublicRateLimit,
      checkRateLimit,
      checkDeviceCodeRateLimit,
      checkDeviceTokenRateLimit,
    } = await import("@/lib/rate-limit");

    await expect(checkPublicRateLimit("203.0.113.10")).resolves.toMatchObject({
      success: false,
      limit: 60,
      remaining: 0,
      policy: "fail-closed",
      status: "degraded",
    });

    await expect(checkRateLimit("user_free")).resolves.toMatchObject({
      success: false,
      limit: 100,
      remaining: 0,
      policy: "fail-closed",
      status: "degraded",
    });

    await expect(checkDeviceCodeRateLimit("203.0.113.11")).resolves.toMatchObject({
      success: false,
      limit: 10,
      remaining: 0,
      policy: "fail-closed",
      status: "degraded",
    });

    await expect(checkDeviceTokenRateLimit("203.0.113.12")).resolves.toMatchObject({
      success: false,
      limit: 30,
      remaining: 0,
      policy: "fail-closed",
      status: "degraded",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
