/**
 * Unicon MCP Streamable HTTP Endpoint
 *
 * This endpoint exposes the MCP server via Streamable HTTP transport for
 * integrations like v0, Bolt, Vercel AI, and other URL-based MCP clients.
 *
 * URL: https://unicon.sh/api/mcp
 *
 * CORS: Open access enabled for cloud IDE integrations (v0, Bolt, Lovable, etc.)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logger } from "@/lib/logger";
import { validateApiToken } from "@/lib/auth/api-token";
import { checkPublicRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-ip";
import {
  type AuthContext,
  registerSearchTools,
  registerIconTools,
  registerStarterPackTools,
  registerResources,
  registerBundleTools,
} from "./handlers";

// CORS headers for cross-origin access (v0, Bolt, Lovable, etc.)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id",
};

// Helper to add CORS headers to a response
function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Create MCP server with all tools and resources
function createMcpServer(authContext?: AuthContext) {
  const hasBundleAccess = !!authContext?.userId;

  const server = new McpServer({
    name: "unicon",
    version: "1.1.0",
    description: `Unicon: 19,000+ icons from 9 libraries (Lucide, Phosphor, Heroicons, etc.) in React/Vue/Svelte/SVG.

AVAILABLE TOOLS:
- search_icons: Search icons by keyword. Use includeCode=true to get ready-to-use components in one call.
- get_icon: Get a single icon by ID (e.g., "lucide:arrow-right").
- get_multiple_icons: Get multiple icons at once (up to 50).
- get_starter_pack: Get curated icon packs (shadcn-ui, dashboard, ecommerce, etc.).
${hasBundleAccess ? `
AUTHENTICATED TOOLS:
- list_my_bundles: List your saved icon bundles.
- get_my_bundle: Get icons from a saved bundle.
- create_my_bundle: Create and save a new bundle.
(Requires an API token.)` : ""}

QUICK START:
- For shadcn/ui: get_starter_pack({ packId: "shadcn-ui" })
- Search + code: search_icons({ query: "arrow", includeCode: true, limit: 5 })
- Specific icon: get_icon({ iconId: "lucide:home", format: "react" })

Read unicon://instructions for detailed usage.`,
  });

  // Register public tools
  registerSearchTools(server);
  registerIconTools(server);
  registerStarterPackTools(server);
  registerResources(server);

  // Register authenticated bundle tools
  if (hasBundleAccess && authContext) {
    registerBundleTools(server, authContext);
  }

  return server;
}

// Create transport for stateless mode (new transport per request)
// Note: Omitting sessionIdGenerator enables stateless mode (no session tracking)
function createTransport() {
  return new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
}

// Extract auth context from request headers
async function getAuthContext(request: Request): Promise<AuthContext | undefined> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return undefined;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token || !token.startsWith("uni_")) return undefined;

  try {
    const result = await validateApiToken(token);
    if (result.valid && result.userId) {
      return { userId: result.userId };
    }
  } catch (err) {
    logger.error("Auth context extraction error:", err);
  }

  return undefined;
}

// Shared handler for MCP requests (used by both POST and GET)
async function handleMcpRequest(request: Request, method: string): Promise<Response> {
  // Extract auth context if token provided
  const authContext = await getAuthContext(request);

  const server = createMcpServer(authContext);
  const transport = createTransport();

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    logger.error(`MCP ${method} Error:`, error);
    return withCors(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error",
          },
          id: null,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
  } finally {
    // Ensure server resources are cleaned up to prevent memory leaks
    try {
      await server.close();
    } catch (closeError) {
      logger.error(`MCP ${method} Close Error:`, closeError);
    }
  }
}

/**
 * POST /api/mcp - Handle MCP requests
 */
export async function POST(request: Request) {
  // Rate limit by trusted platform IP only.
  const ip = getTrustedClientIp(request);
  const rateLimit = await checkPublicRateLimit(ip);

  if (!rateLimit.success) {
    return withCors(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Rate limit exceeded. Please slow down.",
          },
          id: null,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...getRateLimitHeaders(rateLimit),
          },
        }
      )
    );
  }

  return handleMcpRequest(request, "POST");
}

/**
 * GET /api/mcp - SSE stream for server-initiated messages
 * In stateless mode, there are no server-initiated messages to stream.
 * Return 405 to prevent clients from polling/reconnecting in a loop.
 */
export async function GET() {
  return withCors(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Server does not support SSE streams in stateless mode. Use POST for requests.",
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST, OPTIONS",
        },
      }
    )
  );
}

/**
 * DELETE /api/mcp - Terminate session (stateless, so just acknowledge)
 */
export async function DELETE() {
  return withCors(new Response(null, { status: 200 }));
}

/**
 * OPTIONS /api/mcp - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}
