#!/usr/bin/env node

/**
 * Unicon MCP Server
 *
 * Provides Model Context Protocol (MCP) interface for Unicon icon library.
 * Connects AI assistants (Claude, Cursor) to 19,000+ icons from 9 libraries.
 *
 * This is a bridge that proxies MCP requests to the hosted Unicon API.
 *
 * Usage:
 *   npx @webrenew/unicon-mcp-server
 *
 * Configuration in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "unicon": {
 *         "command": "npx",
 *         "args": ["-y", "@webrenew/unicon-mcp-server"]
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE_URL =
  process.env.UNICON_API_URL || "https://unicon.sh/api/mcp";

// API token for authenticated access to user bundles
// Can be obtained by running: unicon login
function loadCliAuthToken(): string | null {
  try {
    const authPath = join(homedir(), ".unicon", "auth.json");
    if (!existsSync(authPath)) return null;
    const raw = readFileSync(authPath, "utf-8");
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed?.access_token || null;
  } catch {
    return null;
  }
}

const API_TOKEN = process.env.UNICON_API_TOKEN || loadCliAuthToken();

const MCP_PROTOCOL_VERSION = "2024-11-05";

/**
 * MCP JSON-RPC Response Types
 */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: {
    tools?: Array<{
      name: string;
      title?: string;
      description?: string;
      inputSchema?: unknown;
      outputSchema?: unknown;
      annotations?: unknown;
    }>;
    resources?: Array<{
      uri: string;
      name?: string;
      description?: string;
      mimeType?: string;
    }>;
    contents?: Array<{
      uri: string;
      mimeType?: string;
      text?: string;
    }>;
    content?: Array<{
      type: string;
      text?: string;
    }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

let requestId = 0;
let isInitialized = false;

/**
 * Initialize connection to the API (called once before first request)
 */
async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;

  await mcpRequest("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "unicon-bridge", version: "1.1.0" },
  });

  isInitialized = true;
}

/**
 * Build headers for API requests, including auth if available
 */
function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (API_TOKEN) {
    headers["Authorization"] = `Bearer ${API_TOKEN}`;
  }

  return headers;
}

/**
 * Send MCP JSON-RPC request to the API
 */
async function mcpRequest(
  method: string,
  params: Record<string, unknown> = {}
): Promise<JsonRpcResponse["result"]> {
  requestId++;

  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  // Parse JSON with proper error handling
  let data: JsonRpcResponse;
  try {
    data = (await response.json()) as JsonRpcResponse;
  } catch {
    const text = await response.text().catch(() => "[Could not read response]");
    throw new Error(`Invalid JSON response from API: ${text.slice(0, 200)}`);
  }

  if (data.error) {
    throw new Error(data.error.message || `API error (code: ${data.error.code})`);
  }

  return data.result;
}

/**
 * Create and configure MCP server
 */
const server = new Server(
  {
    name: "unicon",
    version: "1.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  await ensureInitialized();
  const result = await mcpRequest("tools/list", {});
  return { tools: result?.tools || [] };
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  await ensureInitialized();
  const result = await mcpRequest("resources/list", {});
  return { resources: result?.resources || [] };
});

/**
 * Read a resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  await ensureInitialized();
  const result = await mcpRequest("resources/read", {
    uri: request.params.uri,
  });

  return {
    contents: result?.contents || [],
  };
});

/**
 * Call a tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    await ensureInitialized();
    const result = await mcpRequest("tools/call", {
      name: request.params.name,
      arguments: request.params.arguments || {},
    });

    // Return the content directly from the API response
    // The API already formats batch outputs with identifying comments
    return {
      content: result?.content || [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
      structuredContent: result?.structuredContent,
      isError: result?.isError,
    };
  } catch (error: unknown) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}. Check your connection to ${API_BASE_URL}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start server with stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error("Unicon MCP Server running");
  console.error(`API endpoint: ${API_BASE_URL}`);
  if (API_TOKEN) {
    console.error("Authenticated: saved bundle tools available (list_my_bundles, get_my_bundle, create_my_bundle)");
  } else {
    console.error("Unauthenticated: set UNICON_API_TOKEN or run 'unicon login' to access saved bundles");
  }
  console.error("Ready for requests from AI assistants");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
