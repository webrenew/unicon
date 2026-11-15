/**
 * MCP Resource registrations: sources, categories, stats, starter_packs, instructions
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSources, getCategories, getTotalIconCount } from "@/lib/queries";
import { STARTER_PACKS } from "@/lib/starter-packs";

export function registerResources(server: McpServer) {
  server.registerResource(
    "sources",
    "unicon://sources",
    {
      description: "List all available icon libraries",
      mimeType: "application/json",
    },
    async () => {
      const sources = await getSources();
      return {
        contents: [
          {
            uri: "unicon://sources",
            mimeType: "application/json",
            text: JSON.stringify(sources, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    "categories",
    "unicon://categories",
    {
      description: "List all icon categories",
      mimeType: "application/json",
    },
    async () => {
      const categories = await getCategories();
      return {
        contents: [
          {
            uri: "unicon://categories",
            mimeType: "application/json",
            text: JSON.stringify({ categories }, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    "stats",
    "unicon://stats",
    {
      description: "Total icon count and per-library statistics",
      mimeType: "application/json",
    },
    async () => {
      const totalIcons = await getTotalIconCount();
      const sources = await getSources();
      const stats = {
        totalIcons,
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          count: s.totalIcons,
        })),
      };
      return {
        contents: [
          {
            uri: "unicon://stats",
            mimeType: "application/json",
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    "starter_packs",
    "unicon://starter_packs",
    {
      description: "Curated icon packs for common use cases",
      mimeType: "application/json",
    },
    async () => {
      const packs = {
        total: STARTER_PACKS.length,
        packs: STARTER_PACKS.map((pack) => ({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          color: pack.color,
          iconCount: pack.iconNames.length,
          icons: pack.iconNames,
        })),
      };
      return {
        contents: [
          {
            uri: "unicon://starter_packs",
            mimeType: "application/json",
            text: JSON.stringify(packs, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    "instructions",
    "unicon://instructions",
    {
      description: "How to use Unicon MCP - read this first to understand available tools",
      mimeType: "text/markdown",
    },
    async () => {
      const instructions = `# Unicon MCP Server

Access 19,000+ icons from 9 libraries (Lucide, Phosphor, Hugeicons, Heroicons, Tabler, Feather, Remix, Simple Icons, Iconoir).

## Available Tools

### 1. search_icons
Search for icons by keyword. Returns matching icons with IDs.

**Example:**
\`\`\`json
{ "query": "arrow", "limit": 10 }
\`\`\`

**With code included:**
\`\`\`json
{ "query": "arrow", "includeCode": true, "format": "react", "limit": 5 }
\`\`\`

### 2. get_icon
Get a single icon's code by ID.

**Example:**
\`\`\`json
{ "iconId": "lucide:arrow-right", "format": "react" }
\`\`\`

Icon IDs use format \`source:name\` (e.g., "lucide:home", "phosphor:user", "heroicons:cog").

### 3. get_multiple_icons
Get multiple icons at once (up to 50). Returns a single bundled file.

**Example:**
\`\`\`json
{ "iconIds": ["lucide:home", "lucide:settings", "lucide:user"], "format": "react" }
\`\`\`

### 4. get_starter_pack
Get a curated set of icons for common use cases.

**Popular packs:** shadcn-ui, dashboard, ecommerce, navigation, developer, brand-ai-agents, brand-ai

**Example:**
\`\`\`json
{ "packId": "shadcn-ui", "format": "react" }
\`\`\`

### 5. Authenticated bundle tools (requires UNICON_API_TOKEN)
Manage your saved bundles with an API token.

- list_my_bundles: List your saved bundles
- get_my_bundle: Fetch a saved bundle by ID (with optional code output)
- create_my_bundle: Save a new bundle to your account

## Supported Formats

- \`react\` (default) - React component with TypeScript
- \`svg\` - Raw SVG markup
- \`vue\` - Vue 3 SFC component
- \`svelte\` - Svelte component
- \`json\` - JSON with SVG paths

## Quick Workflows

**Adding icons to a React project:**
1. Search: \`search_icons({ query: "dashboard", includeCode: true, limit: 10 })\`
2. Or get specific: \`get_multiple_icons({ iconIds: ["lucide:home", "lucide:settings"] })\`
3. Copy the returned code to \`src/components/icons/\`

**Starting a new project:**
1. Get a starter pack: \`get_starter_pack({ packId: "shadcn-ui" })\`
2. Save to your icons directory

## Icon Libraries

| Library | Prefix | Style |
|---------|--------|-------|
| Lucide | lucide: | Outline, clean |
| Phosphor | phosphor: | Multiple weights |
| Heroicons | heroicons: | Outline/solid |
| Tabler | tabler: | Consistent stroke |
| Hugeicons | hugeicons: | Modern, detailed |
| Feather | feather: | Minimal |
| Remix | remix: | Versatile |
| Simple Icons | simple-icons: | Brand logos |
| Iconoir | iconoir: | European style |
`;
      return {
        contents: [
          {
            uri: "unicon://instructions",
            mimeType: "text/markdown",
            text: instructions,
          },
        ],
      };
    }
  );
}
