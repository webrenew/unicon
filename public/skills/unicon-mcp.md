---
name: unicon-mcp
description: Sets up and uses the Unicon MCP server, which gives AI assistants icon search and code generation for 19,000+ icons (Lucide, Phosphor, Hugeicons, Heroicons, Tabler, Feather, Remix, Iconoir, Simple Icons) through the tools search_icons, get_icon, get_multiple_icons, get_starter_pack, and saved-bundle tools. Use this skill whenever the user wants to connect, verify, or debug Unicon in Claude Code, Claude Desktop, Cursor, or another MCP client; mentions @webrenew/unicon-mcp-server, https://unicon.sh/api/mcp, or `unicon://` resources; or asks for icons while Unicon MCP tools are available. For the unicon CLI or the REST API without MCP, use the unicon skill.
license: MIT
compatibility: The local server needs Node.js 18+ and npx. The remote server needs an MCP client with Streamable HTTP support. Both need network access to https://unicon.sh.
metadata:
  author: webrenew
  version: "1.1.0"
  website: https://unicon.sh
  repository: https://github.com/WebRenew/unicon
  openclaw:
    emoji: "🔌"
    requires:
      bins: ["node", "npx"]
    install:
      - type: node
        package: "@webrenew/unicon-mcp-server"
        global: true
---

# Unicon MCP

The Unicon MCP server lets an assistant search icons and return ready-to-use
React, Vue, Svelte, SVG, or JSON code as tool calls, with no CLI involved.

There are two ways to connect:

- **Remote:** `https://unicon.sh/api/mcp`. Nothing to install. It uses
  Streamable HTTP, stateless; it has no SSE stream.
- **Local:** `npx -y @webrenew/unicon-mcp-server`. A stdio server that
  forwards requests to the remote endpoint. Use it for clients that support
  only stdio servers.

## Set up

### Claude Code

```bash
claude mcp add --transport http unicon https://unicon.sh/api/mcp
# or the local server:
claude mcp add unicon -- npx -y @webrenew/unicon-mcp-server
```

Add `--scope project` to save the server in `.mcp.json` for the whole team.

### Claude Desktop

Edit `claude_desktop_config.json`. On macOS it is in
`~/Library/Application Support/Claude/`, on Windows in `%APPDATA%\Claude\`.

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

Quit Claude Desktop completely (Cmd+Q on macOS) and start it again. Closing
the window does not reload the config.

### Cursor

Add the server to `.cursor/mcp.json` in the project, or to
`~/.cursor/mcp.json` for every project:

```json
{
  "mcpServers": {
    "unicon": {
      "url": "https://unicon.sh/api/mcp"
    }
  }
}
```

The `command`/`args` form from Claude Desktop also works.

### Other clients

Give the client the URL `https://unicon.sh/api/mcp` if it supports remote
(Streamable HTTP) servers. Otherwise give it the command
`npx -y @webrenew/unicon-mcp-server`.

## Verify

- Claude Code: `claude mcp list` shows `unicon` as connected. In a session,
  `/mcp` shows its tools.
- Claude Desktop and Cursor: the MCP or tools settings list `unicon` with its
  tools.
- In any client, a test request: "Search Unicon for a settings icon from
  Lucide."

## Use the tools

Icon IDs have the form `source:name`, for example `lucide:arrow-right`.
Search first, then use the IDs from the results; guessed IDs often do not
exist.

Work in this order, because it needs the fewest calls:

1. **Search with code.** `search_icons` with `includeCode: true` returns the
   code with the results, so one call is often enough. Set `source` to the
   library the project already uses, so the new icons match the existing ones.
2. **Exact icons.** Use `get_icon` for one known ID, or
   `get_multiple_icons` for up to 50 in one call.
3. **Common sets.** Use `get_starter_pack`. Read `unicon://starter_packs` for
   the pack IDs.

Write the returned code into the project's icon folder, and match the
format to the framework (`react`, `vue`, `svelte`, `svg`, or `json`).

### Tools

| Tool | Required | Optional (default) |
|------|----------|--------------------|
| `search_icons` | `query` (1–200 chars) | `source`, `category`, `limit` (20, max 100), `offset` (0), `includeCode` (false), `format` (react), `strokeWidth` (2), `normalizeStrokes` (false) |
| `get_icon` | `iconId` | `format` (react), `size` (24, 8–512), `strokeWidth` (2, 0.5–4), `normalizeStrokes` (false) |
| `get_multiple_icons` | `iconIds` (up to 50) | `format`, `size`, `strokeWidth`, `normalizeStrokes` |
| `get_starter_pack` | `packId` | `output` (`bundle` for one file, or `individual`), `format`, `size`, `strokeWidth`, `normalizeStrokes` |
| `list_my_bundles` | | Requires a token |
| `get_my_bundle` | `bundleId` (UUID) | `format` (react; `svg` or `json`), `includeCode` (true). Requires a token |
| `create_my_bundle` | `name`, `iconIds` | `description`, `strokePreset` (`thin`, `regular`, `bold`), `normalizeStrokes`, `targetStrokeWidth`, `normalizeViewbox`, `targetViewbox`. Requires a token |

`normalizeStrokes` sets one stroke width on stroke icons from different
libraries and leaves fill icons unchanged. Use it when a set mixes libraries.

### Resources

| URI | Contents |
|-----|----------|
| `unicon://instructions` | The server's usage guide |
| `unicon://sources` | Libraries and icon counts |
| `unicon://categories` | Categories |
| `unicon://stats` | Totals per library |
| `unicon://starter_packs` | Starter pack IDs and descriptions |

## Saved bundles

The `*_my_bundle` tools read and write the user's saved bundles on unicon.sh.
They need an API token, which starts with `uni_`:

- **Local server:** run `npx @webrenew/unicon login` once. The server reads
  `~/.unicon/auth.json`. You can set `UNICON_API_TOKEN` in the server's `env`
  instead.
- **Remote server:** create a token at https://unicon.sh/settings and send it
  as a header, for example
  `claude mcp add --transport http unicon https://unicon.sh/api/mcp --header "Authorization: Bearer uni_..."`.

Without a token, the search and icon tools still work. Only the bundle tools
return an authentication error.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `unicon` is missing from the client | The config JSON is valid. The client was fully restarted. For the local server, `npx -y @webrenew/unicon-mcp-server` starts without errors in a terminal |
| The first start is slow | The first `npx` run downloads the package. Later runs use the npm cache |
| `command not found: npx` | Install Node.js 18+, then restart the client so it sees the new `PATH` |
| An icon is not found | Search for it and copy the `source:name` ID from the results |
| A bundle tool returns an authentication error | Set a token as shown in [Saved bundles](#saved-bundles) |
| A client asks for an SSE endpoint | Use the local server. The remote endpoint supports only Streamable HTTP |
| Requests fail with `429` | The public limit is 60 requests per minute per IP. Wait, then use fewer, larger calls, such as `includeCode` or `get_multiple_icons` |
