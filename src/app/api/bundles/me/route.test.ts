import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireApiAuth } from "@/lib/auth/api-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/auth/api-token", () => ({
  requireApiAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

describe("GET /api/bundles/me", () => {
  const requireApiAuthMock = vi.mocked(requireApiAuth);
  const createAdminClientMock = vi.mocked(createAdminClient);
  const checkRateLimitMock = vi.mocked(checkRateLimit);

  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });
  });

  it("returns bundles for every valid API token without a subscription check", async () => {
    requireApiAuthMock.mockResolvedValue({ userId: "user_free", scope: "bundles:read" });

    const bundle = {
      id: "bundle-1",
      name: "Free bundle",
      description: null,
      icon_count: 2,
      is_public: false,
      share_slug: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const order = vi.fn().mockResolvedValue({ data: [bundle], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createAdminClientMock.mockReturnValue({ from } as never);

    const response = await GET(
      new Request("https://example.com/api/bundles/me", {
        headers: { Authorization: "Bearer uni_free" },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    await expect(response.json()).resolves.toEqual({ bundles: [bundle], total: 1 });
    expect(checkRateLimitMock).toHaveBeenCalledWith("user_free");
    expect(from).toHaveBeenCalledWith("bundles");
    expect(eq).toHaveBeenCalledWith("user_id", "user_free");
  });
});
