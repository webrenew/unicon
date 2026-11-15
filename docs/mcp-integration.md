# Unicon MCP Server Integration Guide

Complete guide to integrating Unicon's icon library with AI assistants via the Model Context Protocol (MCP).

## Overview

The Unicon MCP Server allows AI assistants like Claude Desktop and Cursor to:
- Search through 19,000+ icons from 9 libraries
- Generate icon components in React, Vue, Svelte, or SVG
- Access icon metadata and library information
- Build complete icon sets for projects

## Architecture

Unicon supports two connection methods depending on your environment:

### Option 1: Local Bridge (Desktop Apps)

For **Claude Desktop**, **Cursor**, and other desktop applications that use stdio transport:

```
┌─────────────────────────────┐
│   Claude Desktop / Cursor    │
└──────────┬──────────────────┘
           │ MCP Protocol (stdio)
           │
┌──────────▼──────────────────┐
│  @webrenew/unicon-mcp-server│  (runs locally via npx)
│     (Local Bridge)           │
└──────────┬──────────────────┘
           │ HTTPS
           │
┌──────────▼──────────────────┐
│   unicon.sh/api/mcp        │  (hosted API)
└────────────────────────────┘
```

### Option 2: Direct URL (Cloud IDEs & Agents)

For **v0**, **Bolt**, **Lovable**, **cloud IDEs**, and other URL-based MCP clients:

```
┌─────────────────────────────┐
│   v0 / Cloud IDE / Agent    │
└──────────┬──────────────────┘
           │ MCP Protocol (Streamable HTTP)
           │
┌──────────▼──────────────────┐
│   unicon.sh/api/mcp        │  (direct connection)
└────────────────────────────┘
```

**MCP Endpoint URL:**
```
https://unicon.sh/api/mcp
```

**Why two options?**
- **Local bridge** - Required for desktop apps that only support stdio transport
- **Direct URL** - Simpler for cloud environments that support HTTP transport
- **Same API** - Both methods provide identical functionality
- **Fast** - API responses are cached at the edge

## Installation

### Claude Code (CLI)

Add the Unicon MCP server with a single command:

```bash
claude mcp add unicon -- npx -y @webrenew/unicon-mcp-server
```

**Verify installation:**

```bash
claude mcp list
```

You should see `unicon` in the list of configured servers.

### Claude Desktop

1. **Locate your config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add the MCP server:**

   ```json
   {
     "mcpServers": {
       "unicon": {
         "command": "npx",
         "args": ["-y", "@webrenew/unicon-mcp-server"]
       }
     }
   }
   ```

3. **Restart Claude Desktop completely** (Cmd+Q on macOS, not just close window)

4. **Verify installation:**
   - Open Claude Desktop
   - Look for the 🔌 icon in the bottom right
   - Click it to see available MCP servers
   - "unicon" should appear in the list

### Cursor IDE

1. **Open Cursor Settings** → MCP Servers

2. **Add new server:**

   ```json
   {
     "mcpServers": {
       "unicon": {
         "command": "npx",
         "args": ["-y", "@webrenew/unicon-mcp-server"]
       }
     }
   }
   ```

3. **Restart Cursor**

### Other MCP Clients (Desktop)

Any MCP-compatible desktop client can use Unicon with stdio transport:

```json
{
  "mcpServers": {
    "unicon": {
      "command": "npx",
      "args": ["-y", "@webrenew/unicon-mcp-server"]
    }
  }
}
```

---

## Cloud IDEs & Agent Code Editors

For cloud-based environments that can't run local processes, use the **Streamable HTTP endpoint** directly.

### v0 (Vercel)

Add Unicon as an MCP server in v0:

```
https://unicon.sh/api/mcp
```

### Bolt, Lovable, and Similar Tools

Configure the MCP endpoint URL:

```
https://unicon.sh/api/mcp
```

### Generic HTTP MCP Client

For any MCP client that supports Streamable HTTP transport:

**Endpoint:** `https://unicon.sh/api/mcp`

**Supported Methods:**
- `POST` - Send MCP requests (initialize, tools/call, etc.)
- `GET` - SSE stream for server-initiated messages
- `DELETE` - Close session

**Required Headers:**
```
Content-Type: application/json
Accept: application/json, text/event-stream
```

**Example - Initialize:**
```bash
curl -X POST https://unicon.sh/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "my-client", "version": "1.0.0" }
    }
  }'
```

**Example - List Tools:**
```bash
curl -X POST https://unicon.sh/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}'
```

**Example - Call Tool:**
```bash
curl -X POST https://unicon.sh/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_icons",
      "arguments": { "query": "arrow", "limit": 5 }
    }
  }'
```

### When to Use Which Method

| Environment | Method | Why |
|-------------|--------|-----|
| Claude Desktop | Local Bridge (npx) | Desktop apps require stdio transport |
| Cursor IDE | Local Bridge (npx) | Desktop apps require stdio transport |
| Claude Code CLI | Local Bridge (npx) | CLI tools use stdio transport |
| v0 (Vercel) | Direct URL | Cloud-based, supports HTTP transport |
| Bolt | Direct URL | Cloud-based, supports HTTP transport |
| Lovable | Direct URL | Cloud-based, supports HTTP transport |
| GitHub Codespaces | Direct URL | Cloud IDE, no local processes |
| Gitpod | Direct URL | Cloud IDE, no local processes |
| Custom Agents | Direct URL | HTTP is simpler to integrate |
| CI/CD Pipelines | Direct URL | No interactive process needed |

## Usage Examples

### Example 1: Search for Icons

**User prompt:**
> "Search for dashboard icons in the Lucide library"

**AI assistant will:**
1. Call `search_icons` tool with query "dashboard" and source "lucide"
2. Show results with icon IDs, names, and categories
3. Help you select the icons you need

**Expected output:**
```json
{
  "query": "dashboard",
  "total": 15,
  "results": [
    {
      "id": "lucide:layout-dashboard",
      "name": "LayoutDashboard",
      "category": "layout",
      "tags": ["dashboard", "grid", "layout"]
    },
    ...
  ]
}
```

### Example 2: Generate React Component

**User prompt:**
> "Get the React component for lucide:arrow-right with size 32 and strokeWidth 1.5"

**AI assistant will:**
1. Call `get_icon` tool with the icon ID and format "react"
2. Return ready-to-use React component code

**Generated code:**
```tsx
import React from 'react';

export interface ArrowRightProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

export function ArrowRight(iconProps: ArrowRightProps) {
  const { size = 32, strokeWidth = 1.5, ...props } = iconProps;
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );
}

ArrowRight.displayName = 'ArrowRight';
```

### Example 3: Generate Multiple Icons

**User prompt:**
> "Give me React components for home, settings, and user icons from Lucide"

**AI assistant will:**
1. Call `search_icons` to find the exact icon IDs
2. Call `get_multiple_icons` with the list of IDs
3. Return all components in one response

### Example 4: Different Frameworks

**Vue component:**
> "Generate a Vue component for heroicons:bell"

**Svelte component:**
> "Create a Svelte component for phosphor:heart with fill style"

**Plain SVG:**
> "Get the SVG code for simple-icons:github"

### Example 5: Browse Categories

**User prompt:**
> "What icon categories are available?"

**AI assistant will:**
1. Read `unicon://categories` resource
2. Show all available categories
3. Help you filter by category

### Example 6: Library Stats

**User prompt:**
> "How many icons does Unicon have? Which libraries are included?"

**AI assistant will:**
1. Read `unicon://stats` resource
2. Show total count and breakdown by library

## Available Tools

### `search_icons`

Search through 19,000+ icons using AI-powered semantic search.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query (e.g., "arrow", "dashboard") |
| `source` | string | ❌ | Filter by library (lucide, phosphor, etc.) |
| `category` | string | ❌ | Filter by category |
| `limit` | number | ❌ | Max results (default: 20, max: 100) |
| `includeCode` | boolean | ❌ | Return code with results (default: false) |
| `strokeWidth` | number | ❌ | Stroke width when includeCode=true (default: 2) |
| `normalizeStrokes` | boolean | ❌ | Normalize stroke widths, skipping fill icons (default: false) |

**Example:**
```typescript
{
  query: "navigation arrows",
  source: "lucide",
  limit: 10
}
```

### `get_icon`

Retrieve source code for a specific icon in any format.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iconId` | string | ✅ | Icon ID (format: `source:name`) |
| `format` | string | ❌ | Output format (svg, react, vue, svelte, json) |
| `size` | number | ❌ | Icon size in pixels (default: 24) |
| `strokeWidth` | number | ❌ | Stroke width (default: 2) |
| `normalizeStrokes` | boolean | ❌ | Normalize stroke widths, skipping fill icons (default: false) |

**Example:**
```typescript
{
  iconId: "lucide:arrow-right",
  format: "react",
  size: 32,
  strokeWidth: 1.5
}
```

### `get_multiple_icons`

Retrieve multiple icons in one request (max 50).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iconIds` | string[] | ✅ | Array of icon IDs |
| `format` | string | ❌ | Output format for all icons |
| `size` | number | ❌ | Icon size for all icons |
| `strokeWidth` | number | ❌ | Stroke width for all icons |
| `normalizeStrokes` | boolean | ❌ | Normalize stroke widths, skipping fill icons (default: false) |

**Example:**
```typescript
{
  iconIds: [
    "lucide:home",
    "lucide:settings",
    "lucide:user"
  ],
  format: "react",
  size: 24
}
```

### `get_starter_pack`

Get a curated starter pack of icons for common use cases.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `packId` | string | ✅ | Starter pack ID (dashboard, ecommerce, social, brand-ai) |
| `format` | string | ❌ | Output format for all icons |
| `size` | number | ❌ | Icon size for all icons |
| `strokeWidth` | number | ❌ | Stroke width for all icons |
| `normalizeStrokes` | boolean | ❌ | Normalize stroke widths, skipping fill icons (default: false) |

**Available Packs:**
- `dashboard` - Admin dashboard icons (home, settings, users, charts)
- `ecommerce` - Shopping icons (cart, payment, shipping)
- `social` - Social media icons (share, like, comment)
- `brand-ai` - AI/ML brand icons (OpenAI, Anthropic, etc.)

**Example:**
```typescript
{
  packId: "dashboard",
  format: "react",
  size: 24
}
```

## Authenticated Tools

Saved bundles require authentication. Every user with a valid API token can use these tools in their MCP client.

### Authentication

**Desktop/stdio (Claude Desktop, Claude Code, local MCP):**
1. Run `npx @webrenew/unicon login`
2. The MCP server auto-reads `~/.unicon/auth.json`
3. Optional override: set `UNICON_API_TOKEN`

**URL-based MCP clients:**
Send `Authorization: Bearer <token>` with your MCP requests.

### `list_my_bundles`

List all your saved bundles.

### `get_my_bundle`

Fetch a saved bundle by ID.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bundleId` | string | ✅ | Bundle ID (UUID) |
| `format` | string | ❌ | Output format (react, svg, json) |
| `includeCode` | boolean | ❌ | Include generated code (default: true) |

### `create_my_bundle`

Create and save a new bundle.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✅ | Bundle name |
| `iconIds` | string[] | ✅ | Array of icon IDs |
| `description` | string | ❌ | Bundle description |
| `strokePreset` | string | ❌ | thin \| regular \| bold |
| `normalizeStrokes` | boolean | ❌ | Normalize stroke widths |
| `targetStrokeWidth` | number | ❌ | Stroke width when normalizing |
| `normalizeViewbox` | boolean | ❌ | Normalize viewBox sizes |
| `targetViewbox` | string | ❌ | Target viewBox when normalizing |

## Available Resources

### `unicon://sources`

List all icon libraries with metadata.

**Returns:**
```json
[
  {
    "id": "lucide",
    "name": "Lucide Icons",
    "version": "0.460.0",
    "license": "ISC",
    "totalIcons": 1456
  },
  ...
]
```

### `unicon://categories`

List all available icon categories.

**Returns:**
```json
{
  "categories": [
    "arrows",
    "communication",
    "design",
    "development",
    "files",
    ...
  ]
}
```

### `unicon://stats`

Get library statistics.

**Returns:**
```json
{
  "totalIcons": 14700,
  "sources": [
    { "id": "lucide", "name": "Lucide Icons", "count": 1456 },
    { "id": "phosphor", "name": "Phosphor Icons", "count": 7488 },
    ...
  ]
}
```

### `unicon://starter_packs`

Get available starter packs for common use cases.

**Returns:**
```json
{
  "total": 4,
  "packs": [
    {
      "id": "dashboard",
      "name": "Dashboard Essentials",
      "description": "Essential icons for admin dashboards",
      "iconCount": 15,
      "icons": ["home", "settings", "users", ...]
    },
    ...
  ]
}
```

## Icon ID Format

All icons use the format: `source:icon-name`

**Examples:**
- `lucide:arrow-right`
- `phosphor:heart`
- `heroicons:bell`
- `simple-icons:github`

**Finding icon IDs:**
1. Use `search_icons` tool to find icons
2. Browse https://unicon.sh
3. Check the CLI: `unicon search "query"`

## Supported Formats

### React (TypeScript)

```typescript
export function IconName(props: IconNameProps) {
  // Full TypeScript support
  // Customizable size, strokeWidth
  // Spreads additional SVG props
}
```

### Vue 3 (Composition API)

```vue
<script setup lang="ts">
interface Props {
  size?: number | string;
  strokeWidth?: number | string;
}
// ...
</script>

<template>
  <svg><!-- ... --></svg>
</template>
```

### Svelte

```svelte
<script lang="ts">
  export let size: number | string = 24;
  export let strokeWidth: number | string = 2;
</script>

<svg {...$$restProps}>
  <!-- ... -->
</svg>
```

### SVG (Plain)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <!-- ... -->
</svg>
```

### JSON (Metadata)

```json
{
  "id": "lucide:arrow-right",
  "name": "ArrowRight",
  "source": "lucide",
  "category": "arrows",
  "tags": ["directional", "navigation"],
  "viewBox": "0 0 24 24"
}
```

## Advanced Configuration

### Custom API Endpoint (Development)

Point to a local Unicon instance:

```json
{
  "mcpServers": {
    "unicon": {
      "command": "npx",
      "args": ["-y", "@webrenew/unicon-mcp-server"],
      "env": {
        "UNICON_API_URL": "http://localhost:3000/api/mcp"
      }
    }
  }
}
```

### Local Development

```bash
# Clone Unicon repo
git clone https://github.com/webrenew/unicon.git
cd unicon/packages/mcp-server

# Install and build
npm install
npm run build

# Test locally
node dist/index.js
```

**Configure Claude to use local build:**

```json
{
  "mcpServers": {
    "unicon": {
      "command": "node",
      "args": ["/absolute/path/to/unicon/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Troubleshooting

### Server not appearing in Claude

**Symptoms:** Unicon doesn't show in MCP servers list

**Solutions:**
1. Verify JSON config is valid (no trailing commas!)
2. Restart Claude completely (Cmd+Q, not just close window)
3. Check logs: Help → Developer Tools → Console
4. Try running manually: `npx -y @webrenew/unicon-mcp-server`

### Connection errors

**Symptoms:** "Failed to communicate with Unicon API"

**Solutions:**
1. Check internet connection
2. Verify API is reachable: `curl https://unicon.sh/api/mcp`
3. Check for firewall/proxy blocking the request
4. Try setting custom API URL in config

### Icons not found

**Symptoms:** "Icon not found: xyz"

**Solutions:**
1. Verify icon ID format: `source:icon-name` (all lowercase)
2. Use `search_icons` to find the exact ID
3. Check icon exists: browse https://unicon.sh
4. Some icons may have variants (e.g., `phosphor:heart:fill`)

### Slow responses

**Symptoms:** Requests take > 2 seconds

**Solutions:**
1. First request may be slower (cold start)
2. Check API status: https://unicon.sh/api/mcp
3. Report persistent issues on GitHub

## Best Practices

### 1. Search Before Getting

Always search first to find the right icon:

```
❌ "Get me the home icon"  (ambiguous)
✅ "Search for home icons in Lucide, then get the react component"
```

### 2. Specify Library

Be specific about which library to use:

```
❌ "Search for arrow icons"  (14,000+ results)
✅ "Search for arrow icons in Lucide"  (focused results)
```

### 3. Batch Multiple Icons

Use `get_multiple_icons` for multiple icons:

```
❌ Making 10 separate get_icon calls
✅ One get_multiple_icons call with array of IDs
```

### 4. Use Semantic Search

Take advantage of semantic search:

```
"Find icons related to authentication and security"
"Search for icons I'd use on a dashboard"
"Get social media icons"
```

## Rate Limits

- **Search:** 100 requests per hour per user
- **Get Icon:** 500 requests per hour per user
- **Resources:** Unlimited (cached)
- **Bundles (authenticated):** 100 requests/minute

Need higher limits? Contact us for API key access.

## Privacy & Security

- **No tracking:** We don't log search queries or user data
- **Auth only for bundles:** Icon search/generation is anonymous; saved bundles require authentication
- **Open source:** Server code is available on GitHub
- **Hosted infrastructure:** API runs on Vercel Edge (GDPR compliant)

## Support

- **Documentation:** https://unicon.sh/docs
- **GitHub Issues:** https://github.com/webrenew/unicon/issues
- **Discussions:** https://github.com/webrenew/unicon/discussions
- **Email:** contact@webrenew.io

## What's Next?

- [x] ~~Icon packs (curated collections)~~ - **Available now!** Use `get_starter_pack`
- [x] ~~Direct URL access for cloud IDEs~~ - **Available now!** Use `https://unicon.sh/api/mcp`
- [ ] Custom icon uploads
- [ ] Team workspaces
- [ ] Icon variants (phosphor weights)
- [ ] Icon composition (combine multiple icons)

Have feature requests? [Open an issue!](https://github.com/webrenew/unicon/issues/new)

## License

MIT © WebRenew
