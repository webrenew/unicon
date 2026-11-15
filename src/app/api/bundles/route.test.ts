import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

type MockSupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  rpc: ReturnType<typeof vi.fn>;
};

describe("POST /api/bundles", () => {
  const createClientMock = vi.mocked(createClient);
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

  it("returns 401 when user is not authenticated", async () => {
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "unauthorized" },
        }),
      },
      rpc: vi.fn(),
    };

    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({ name: "test", icons: [] }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("sanitizes icon SVG payloads before create_bundle_atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ success: true, bundle: { id: "bundle-1" } }],
      error: null,
    });
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
    };

    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({
          name: "unsafe bundle",
          icons: [
            {
              id: "lucide:alert",
              svg: `<script>alert(1)</script><path d="M1 1" onload="evil()" style="fill:url(javascript:1)" />`,
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(201);
    const rpcArgs = rpc.mock.calls[0]?.[1] as { p_icons: Array<{ svg: string }> };
    const sanitizedSvg = rpcArgs.p_icons[0]?.svg;

    expect(sanitizedSvg).toContain(`<path d="M1 1"`);
    expect(sanitizedSvg).not.toContain("<script");
    expect(sanitizedSvg).not.toContain("onload=");
    expect(sanitizedSvg).not.toContain("style=");
    expect(sanitizedSvg).not.toContain("javascript:");
  });

  it("returns 403 for RPC permission denial without exposing database details", async () => {
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "Internal ownership guard details" },
      }),
    };
    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({ name: "test", icons: [] }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Permission denied" });
  });

  it("returns 409 when the account bundle cap is reached", async () => {
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: [{ success: false, error: "Bundle limit reached (250 per account)" }],
        error: null,
      }),
    };
    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({ name: "over-cap", icons: [] }),
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Bundle limit reached (250 per account)",
    });
  });

  it("returns 429 when bundle creation exceeds the authenticated rate limit", async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60_000,
    });
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn(),
    };
    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({ name: "test", icons: [] }),
      })
    );

    expect(response.status).toBe(429);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for bundles containing more than 200 icons", async () => {
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn(),
    };
    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({
          name: "oversized",
          icons: Array.from({ length: 201 }, (_, index) => ({ id: `icon-${index}` })),
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A bundle can contain at most 200 icons",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid icon payload arrays", async () => {
    const supabase: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn(),
    };

    createClientMock.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("https://example.com/api/bundles", {
        method: "POST",
        body: JSON.stringify({
          name: "invalid",
          icons: ["bad"],
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "icons must be an array of objects",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
