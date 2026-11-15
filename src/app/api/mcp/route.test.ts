import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { validateApiToken } from "@/lib/auth/api-token";
import { checkPublicRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-ip";
import {
  registerBundleTools,
  registerIconTools,
  registerResources,
  registerSearchTools,
  registerStarterPackTools,
} from "./handlers";

const mcpServerMocks = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  handleRequest: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    constructor(config: unknown) {
      void config;
    }

    connect = mcpServerMocks.connect;
    close = mcpServerMocks.close;
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => ({
  WebStandardStreamableHTTPServerTransport: class {
    constructor(opts: unknown) {
      void opts;
    }

    handleRequest = mcpServerMocks.handleRequest;
  },
}));

vi.mock("./handlers", () => ({
  registerSearchTools: vi.fn(),
  registerIconTools: vi.fn(),
  registerStarterPackTools: vi.fn(),
  registerResources: vi.fn(),
  registerBundleTools: vi.fn(),
}));

vi.mock("@/lib/auth/api-token", () => ({
  validateApiToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkPublicRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": "59",
    "X-RateLimit-Reset": "123",
  }),
}));

vi.mock("@/lib/request-ip", () => ({
  getTrustedClientIp: vi.fn(),
}));

describe("POST /api/mcp auth policy", () => {
  const validateApiTokenMock = vi.mocked(validateApiToken);
  const checkPublicRateLimitMock = vi.mocked(checkPublicRateLimit);
  const getTrustedClientIpMock = vi.mocked(getTrustedClientIp);

  beforeEach(() => {
    vi.clearAllMocks();

    checkPublicRateLimitMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 123,
    });

    getTrustedClientIpMock.mockReturnValue("203.0.113.10");

    mcpServerMocks.handleRequest.mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("registers bundle tools for valid API tokens without a Pro subscription", async () => {
    validateApiTokenMock.mockResolvedValue({
      valid: true,
      userId: "user_non_pro",
      scope: "bundles:read",
    });

    const response = await POST(
      new Request("https://example.com/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer uni_nonpro_token" },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(registerSearchTools).toHaveBeenCalledTimes(1);
    expect(registerIconTools).toHaveBeenCalledTimes(1);
    expect(registerStarterPackTools).toHaveBeenCalledTimes(1);
    expect(registerResources).toHaveBeenCalledTimes(1);
    expect(registerBundleTools).toHaveBeenCalledWith(expect.any(Object), {
      userId: "user_non_pro",
    });
  });

  it("registers bundle tools for valid API tokens", async () => {
    validateApiTokenMock.mockResolvedValue({
      valid: true,
      userId: "user_pro",
      scope: "bundles:read",
    });

    const response = await POST(
      new Request("https://example.com/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer uni_pro_token" },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(registerBundleTools).toHaveBeenCalledTimes(1);
    expect(registerBundleTools).toHaveBeenCalledWith(expect.any(Object), {
      userId: "user_pro",
    });
  });
});
