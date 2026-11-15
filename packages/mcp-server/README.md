# Unicon MCP Server

Model Context Protocol (MCP) server for the Unicon icon library. Connects AI assistants like Claude and Cursor to 19,000+ icons from 9 popular libraries.

## Features

- 🔍 **AI-Powered Search**: Semantic search across all icon libraries
- 🎨 **Multiple Formats**: Get icons as React, Vue, Svelte, SVG, or JSON
- 📦 **9 Icon Libraries**: Lucide, Phosphor, Hugeicons, Heroicons, Tabler, Feather, Remix, Simple Icons, Iconoir
- ⚡ **Fast**: Hosted API with local MCP bridge for optimal performance
- 🔐 **Saved Bundles**: Authenticate to access your saved icon bundles for free

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor IDE

Add to your Cursor MCP settings:

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

### Remote URL (Cloud IDEs & Agents)

For v0, Bolt, Lovable, and other URL-based MCP clients, connect directly via Streamable HTTP:

```
https://unicon.sh/api/mcp
```

No installation required — just add this URL as an MCP server in your tool's settings.

## Usage Examples

Once installed, you can ask your AI assistant:

### Search for Icons

```
"Search for arrow icons in the Lucide library"
"Find dashboard-related icons"
"Show me social media icons"
```

### Get Icon Code

```
"Get the React code for the home icon from Heroicons"
"Give me the SVG for lucide:arrow-right"
"Generate a Vue component for the settings icon"
```

### Get Multiple Icons

```
"Get React components for home, settings, and user icons from Lucide"
"Give me all the arrow icons from Phosphor as Svelte components"
```

## Available Tools

### `search_icons`

Search through 19,000+ icons using semantic search.

**Parameters:**
- `query` (required): Search query (e.g., "arrow", "dashboard")
- `source` (optional): Filter by library (lucide, phosphor, heroicons, etc.)
- `category` (optional): Filter by category
- `limit` (optional): Max results (default: 20, max: 100)
- `offset` (optional): Skip results for pagination (default: 0)
- `includeCode` (optional): Return code with results (default: false)
- `strokeWidth` (optional): Stroke width when includeCode=true (default: 2)
- `normalizeStrokes` (optional): Normalize stroke widths, skipping fill icons (default: false)

### `get_icon`

Retrieve source code for a specific icon.

**Parameters:**
- `iconId` (required): Icon ID (e.g., "lucide:arrow-right")
- `format` (optional): Output format (svg, react, vue, svelte, json) - default: react
- `size` (optional): Icon size in pixels - default: 24
- `strokeWidth` (optional): Stroke width for outline icons - default: 2
- `normalizeStrokes` (optional): Normalize stroke widths, skipping fill icons (default: false)

### `get_multiple_icons`

Retrieve multiple icons at once (max 50).

**Parameters:**
- `iconIds` (required): Array of icon IDs
- `format` (optional): Output format - default: react
- `size` (optional): Icon size - default: 24
- `strokeWidth` (optional): Stroke width - default: 2
- `normalizeStrokes` (optional): Normalize stroke widths, skipping fill icons (default: false)

### `get_starter_pack`

Get a curated starter pack of icons for common use cases.

**Parameters:**
- `packId` (required): Starter pack ID (e.g., "dashboard", "ecommerce", "social", "brand-ai-agents")
- `format` (optional): Output format - default: react
- `size` (optional): Icon size - default: 24
- `strokeWidth` (optional): Stroke width - default: 2
- `normalizeStrokes` (optional): Normalize stroke widths, skipping fill icons (default: false)

## Available Resources

### `unicon://sources`

List all available icon libraries with versions and icon counts.

### `unicon://categories`

List all icon categories for filtering searches.

### `unicon://stats`

Get total icon count and per-library statistics.

### `unicon://starter_packs`

List available starter packs with their icons.

## Authentication

Every user can create an API token for free to access their saved bundles via the MCP server.

### Step 1: Login via CLI

```bash
npx @webrenew/unicon login
```

This opens a browser window to authenticate. Once complete, your token is saved to `~/.unicon/auth.json`.

### Step 2: Use the Token (Auto-Loaded)

After logging in, the MCP server will automatically read `~/.unicon/auth.json`.

If you want to override that token (or run in a different environment), you can set `UNICON_API_TOKEN` manually:

**Claude Desktop:**

```json
{
  "mcpServers": {
    "unicon": {
      "command": "npx",
      "args": ["-y", "@webrenew/unicon-mcp-server"],
      "env": {
        "UNICON_API_TOKEN": "uni_your_token_here"
      }
    }
  }
}
```

**Cursor IDE:**

```json
{
  "mcpServers": {
    "unicon": {
      "command": "npx",
      "args": ["-y", "@webrenew/unicon-mcp-server"],
      "env": {
        "UNICON_API_TOKEN": "uni_your_token_here"
      }
    }
  }
}
```

### Authenticated Tools

Once authenticated, you get access to these additional tools:

#### `list_my_bundles`

List all your saved icon bundles.

**Example:**
```
"List my saved icon bundles"
```

#### `get_my_bundle`

Get icons from one of your saved bundles.

**Parameters:**
- `bundleId` (required): Bundle ID (UUID)
- `format` (optional): Output format (react, svg, json) - default: react
- `includeCode` (optional): Include generated code - default: true

#### `create_my_bundle`

Create and save a new bundle.

**Parameters:**
- `name` (required): Bundle name
- `iconIds` (required): Array of icon IDs
- `description` (optional): Bundle description
- `strokePreset` (optional): thin | regular | bold
- `normalizeStrokes` (optional): Normalize stroke widths
- `targetStrokeWidth` (optional): Stroke width when normalizing
- `normalizeViewbox` (optional): Normalize viewBox sizes
- `targetViewbox` (optional): Target viewBox when normalizing

**Example:**
```
"Get the icons from my dashboard bundle"
```

## Configuration

### Custom API Endpoint

Set a custom API endpoint (useful for development):

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

## Development

### Local Development

```bash
# Clone the repo
git clone https://github.com/webrenew/unicon.git
cd unicon/packages/mcp-server

# Install dependencies
npm install

# Build
npm run build

# Test locally
node dist/index.js
```

### Testing with Claude Desktop

1. Build the package locally
2. Update your Claude config to use the local version:

```json
{
  "mcpServers": {
    "unicon": {
      "command": "node",
      "args": ["/path/to/unicon/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Troubleshooting

### Server not showing in Claude

1. Check that your config file is valid JSON
2. Restart Claude Desktop completely
3. Check the MCP logs (Help → Developer Tools → Console)

### Connection errors

The server requires internet access to connect to the Unicon API at `https://unicon.sh`.

### Icons not found

Make sure you're using the correct icon ID format: `source:icon-name` (e.g., `lucide:arrow-right`).

Use the `search_icons` tool first to find the exact icon ID.

## Support

- 📖 Quick Start: https://github.com/WebRenew/unicon/blob/main/docs/mcp-quickstart.md
- 📚 Full Documentation: https://github.com/WebRenew/unicon/blob/main/docs/mcp-integration.md
- 🐛 Issues: https://github.com/webrenew/unicon/issues
- 💬 Discussions: https://github.com/webrenew/unicon/discussions

## License

MIT © WebRenew
