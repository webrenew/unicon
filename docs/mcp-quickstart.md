# Unicon MCP Server - Quick Start

Get started with Unicon's AI-powered icon library in 5 minutes.

## Installation

### Cloud IDEs & Agent Editors (v0, Bolt, Lovable)

For cloud-based environments, use the direct URL:

```
https://unicon.sh/api/mcp
```

Just add this URL as an MCP server in your tool's settings. No installation needed!

---

### Claude Code (CLI)

Add the Unicon MCP server with a single command:

```bash
npx @anthropic-ai/claude-code mcp add unicon -- npx -y @webrenew/unicon-mcp-server
```

Or if you have Claude Code installed globally:

```bash
claude mcp add unicon -- npx -y @webrenew/unicon-mcp-server
```

That's it! The server is now available in your Claude Code sessions.

### Claude Desktop

1. Open your Claude Desktop config:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

2. Add this configuration:

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

3. **Restart Claude Desktop** (complete quit and reopen)

4. Verify: Look for 🔌 icon in bottom right → "unicon" should appear

## First Steps

### 1. Explore What's Available

Try asking Claude:
> "What icon libraries are available in Unicon?"

Claude will read the `unicon://sources` resource and show you:
- Lucide Icons (1,456 icons)
- Phosphor Icons (7,488 icons)
- Heroicons (292 icons)
- And 6 more libraries!

### 2. Search for Icons

> "Search for arrow icons in Lucide"

Claude will show you:
```json
{
  "results": [
    { "id": "lucide:arrow-right", "name": "ArrowRight" },
    { "id": "lucide:arrow-left", "name": "ArrowLeft" },
    { "id": "lucide:arrow-up", "name": "ArrowUp" },
    ...
  ]
}
```

### 3. Get a React Component

> "Get the React component for lucide:arrow-right"

Claude will generate:
```tsx
import React from 'react';

export interface ArrowRightProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

export function ArrowRight(iconProps: ArrowRightProps) {
  const { size = 24, strokeWidth = 2, ...props } = iconProps;
  
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

Copy and paste directly into your project!

### 4. Get Multiple Icons

> "Give me React components for home, settings, user, and bell icons from Lucide"

Claude will:
1. Search for each icon
2. Generate all components at once
3. Return them ready to use

### 5. Try Other Frameworks

**Vue:**
> "Generate a Vue component for heroicons:bell"

**Svelte:**
> "Create a Svelte component for phosphor:heart"

**Plain SVG:**
> "Get the SVG for simple-icons:github"

### 6. Save a Bundle

Authenticate once (OAuth device flow):

```bash
npx @webrenew/unicon login
```

The local MCP server will automatically read `~/.unicon/auth.json`.

Then ask:

> "Create a bundle called 'dashboard' with lucide:home, lucide:settings, lucide:user"

## Example Workflows

### Building a Navigation Bar

> "I'm building a navigation bar. Search for icons for Home, Dashboard, Settings, and Profile in Lucide. Then give me React components for all of them with size 20."

### Social Media Icons

> "Get SVG code for Twitter, GitHub, LinkedIn, and Discord brand logos from Simple Icons"

### Icon Pack for Project

> "Search for all file-related icons in Heroicons and generate React components for the top 10"

## Pro Tips

### 🎯 Be Specific

```
❌ "Get home icon"
✅ "Get React component for lucide:home with size 32"
```

### 🔍 Search First

Always search before getting to find the exact icon ID:
```
1. "Search for authentication icons in Lucide"
2. "Get React component for lucide:lock"
```

### 📦 Batch Requests

Get multiple icons in one request:
```
❌ "Get home icon" → "Get settings icon" → "Get user icon"
✅ "Get React components for home, settings, and user icons from Lucide"
```

### 🎨 Customize on Request

Specify size, stroke width, and format:
```
"Get lucide:arrow-right as React component with size 32 and strokeWidth 1.5"
```

## Troubleshooting

### Unicon not showing up?

1. Check your JSON config is valid
2. Restart Claude completely (Cmd+Q on Mac)
3. Look at Developer Console for errors

### Icon not found?

1. Use exact icon ID format: `source:icon-name`
2. Search first to find the right ID
3. Check https://unicon.sh

### Slow responses?

First request may be slow (cold start). Subsequent requests are fast!

## Next Steps

- Read the [full MCP integration guide](./mcp-integration.md)
- Browse icons at https://unicon.sh
- Join discussions at https://github.com/webrenew/unicon/discussions

## Need Help?

- 🐛 Report bugs: https://github.com/webrenew/unicon/issues
- 💬 Ask questions: https://github.com/webrenew/unicon/discussions
- 📧 Email: contact@webrenew.io

---

**Enjoy using Unicon with Claude!** 🎉
