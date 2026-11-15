import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBearerToken, validateApiToken } from "@/lib/auth/api-token";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/api-token", () => ({
  extractBearerToken: vi.fn(),
  validateApiToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  getIconsByIds: vi.fn(),
}));

vi.mock("@/lib/icon-converters", () => ({
  generateReactBundle: vi.fn(),
  generateSvgBundle: vi.fn(),
  generateJsonBundle: vi.fn(),
}));

vi.mock("@/lib/icon-utils", () => ({
  normalizeIcons: vi.fn((icons) => icons),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("GET /api/bundles/me/[id] query validation", () => {
  const createAdminClientMock = vi.mocked(createAdminClient);
  const extractBearerTokenMock = vi.mocked(extractBearerToken);
  const validateApiTokenMock = vi.mocked(validateApiToken);
  const checkRateLimitMock = vi.mocked(checkRateLimit);
  const getRateLimitHeadersMock = vi.mocked(getRateLimitHeaders);

  beforeEach(() => {
    vi.clearAllMocks();
    extractBearerTokenMock.mockReturnValue("uni_token");
    validateApiTokenMock.mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });
    getRateLimitHeadersMock.mockReturnValue({});
  });

  it("returns 400 when format is not supported", async () => {
    const response = await GET(
      new Request("https://example.com/api/bundles/me/bundle-1?format=vue"),
      { params: Promise.resolve({ id: "bundle-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_format",
      message: "format must be one of: react, svg, json",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns 400 when strokeWidth is not numeric", async () => {
    const response = await GET(
      new Request("https://example.com/api/bundles/me/bundle-1?strokeWidth=abc"),
      { params: Promise.resolve({ id: "bundle-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_stroke_width",
      message: "strokeWidth must be greater than 0 and less than or equal to 10",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns 400 when strokeWidth is zero or negative", async () => {
    const response = await GET(
      new Request("https://example.com/api/bundles/me/bundle-1?strokeWidth=0"),
      { params: Promise.resolve({ id: "bundle-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_stroke_width",
      message: "strokeWidth must be greater than 0 and less than or equal to 10",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});
