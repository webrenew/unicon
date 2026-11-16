import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { logSearch } from "@/lib/analytics";
import { checkPublicRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/analytics", () => ({
  logSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkPublicRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/request-ip", () => ({
  getTrustedClientIp: vi.fn().mockReturnValue("203.0.113.10"),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}));

const post = (body: unknown) =>
  new NextRequest("https://unicon.sh/api/search/analytics", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/search/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPublicRateLimit).mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
  });

  it("should record a valid local search as a text search", async () => {
    const response = await POST(post({ query: "  arrow ", sourceFilter: "lucide", resultCount: 42, responseTimeMs: 3 }));

    expect(response.status).toBe(204);
    expect(logSearch).toHaveBeenCalledWith({
      query: "arrow",
      sourceFilter: "lucide",
      resultCount: 42,
      responseTimeMs: 3,
      searchType: "text",
      cacheHit: false,
    });
  });

  it("should accept an event without optional fields", async () => {
    const response = await POST(post({ query: "home", resultCount: 0 }));

    expect(response.status).toBe(204);
    expect(logSearch).toHaveBeenCalledWith(expect.objectContaining({ query: "home", sourceFilter: undefined }));
  });

  it.each([
    ["missing query", { resultCount: 1 }],
    ["blank query", { query: "   ", resultCount: 1 }],
    ["oversized query", { query: "a".repeat(201), resultCount: 1 }],
    ["negative count", { query: "x", resultCount: -1 }],
    ["fractional count", { query: "x", resultCount: 1.5 }],
    ["string count", { query: "x", resultCount: "5" }],
    ["invalid source", { query: "x", resultCount: 1, sourceFilter: "<script>" }],
    ["huge response time", { query: "x", resultCount: 1, responseTimeMs: 10_000_000 }],
    ["non-object body", ["x"]],
  ])("should reject %s", async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(logSearch).not.toHaveBeenCalled();
  });

  it("should reject malformed JSON", async () => {
    expect((await POST(post("{not json"))).status).toBe(400);
  });

  it("should return 429 when rate limited", async () => {
    vi.mocked(checkPublicRateLimit).mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 0 });

    const response = await POST(post({ query: "arrow", resultCount: 1 }));

    expect(response.status).toBe(429);
    expect(logSearch).not.toHaveBeenCalled();
  });
});
