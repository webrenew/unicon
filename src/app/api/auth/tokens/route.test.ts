import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

describe("POST /api/auth/tokens", () => {
  const createClientMock = vi.mocked(createClient);
  const createAdminClientMock = vi.mocked(createAdminClient);
  const checkRateLimitMock = vi.mocked(checkRateLimit);

  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
  });

  it("creates tokens for every signed-in user with rate limiting", async () => {
    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: { session_id: "session-1", access_token: "uni_test" },
      error: null,
    });
    createAdminClientMock.mockReturnValue({ rpc } as never);

    const response = await POST(
      new Request("https://example.com/api/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "CLI" }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      session_id: "session-1",
      access_token: "uni_test",
    });
    expect(checkRateLimitMock).toHaveBeenCalledWith("user-1");
    expect(rpc).toHaveBeenCalledWith("create_api_token_direct", {
      p_user_id: "user-1",
      p_name: "CLI",
      p_scope: "bundles:read",
    });
  });

  it("returns 429 without creating a token when rate limited", async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const response = await POST(
      new Request("https://example.com/api/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "CLI" }),
      })
    );

    expect(response.status).toBe(429);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});
