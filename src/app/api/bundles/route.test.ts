import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type MockSupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  rpc: ReturnType<typeof vi.fn>;
};

describe("POST /api/bundles", () => {
  const createClientMock = vi.mocked(createClient);

  beforeEach(() => {
    vi.clearAllMocks();
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
