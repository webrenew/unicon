# Unicon MCP - Quick Reference

Quick command reference for using Unicon with Claude/Cursor.

## Installation

### Cloud IDEs (v0, Bolt, Lovable) - Direct URL

```
https://unicon.sh/api/mcp
```

Add this URL as an MCP server in your tool's settings. No installation needed!

---

### Claude Code (CLI) - One Command

```bash
npx @anthropic-ai/claude-code mcp add unicon -- npx -y @webrenew/unicon-mcp-server
```

### Claude Desktop - Manual Config

**Config location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Add to config:**
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

**Then:** Restart Claude completely (Cmd+Q on Mac)

## Common Prompts

### 🔍 Search Icons

```
"Search for arrow icons in Lucide"
"Find dashboard icons"
"Search for social media icons from Simple Icons"
"Show me all file-related icons in Heroicons"
```

### 📦 Get Single Icon

```
"Get React component for lucide:arrow-right"
"Generate Vue component for heroicons:bell"
"Create Svelte component for phosphor:heart"
"Get SVG code for simple-icons:github"
```

### 🎨 With Customization

```
"Get lucide:home as React with size 32"
"Get phosphor:star with strokeWidth 1.5"
"Generate lucide:arrow-right as Vue with size 20"
```

### 📚 Get Multiple Icons

```
"Give me React components for home, settings, user from Lucide"
"Get all arrow icons from Lucide as Svelte components"
"Generate social media icons (Twitter, GitHub, LinkedIn) as SVG"
```

### 💾 Saved Bundles

Authenticate once:

```bash
npx @webrenew/unicon login
```

The local MCP server will read `~/.unicon/auth.json` automatically.

```
"Create a bundle called 'dashboard' with lucide:home, lucide:settings, lucide:user"
"List my saved bundles"
"Get my bundle 123e4567-e89b-12d3-a456-426614174000 as React code"
```

### ℹ️ Get Information

```
"What icon libraries are available?"
"How many icons does Unicon have?"
"What categories exist?"
"Show me libraries and their icon counts"
```

## Icon ID Format

All icons use: `library:icon-name`

**Examples:**
- `lucide:arrow-right`
- `phosphor:heart`
- `heroicons:bell-alert`
- `simple-icons:github`

**Finding IDs:**
1. Search first: "Search for X icons"
2. Browse: https://unicon.sh
3. Use CLI: `unicon search "query"`

## Available Libraries

| Library | ID | Count | Style |
|---------|----|----|-------|
| Lucide | `lucide` | 1,456 | Outline |
| Phosphor | `phosphor` | 7,488 | Multiple weights |
| Heroicons | `heroicons` | 292 | Outline & Solid |
| Tabler | `tabler` | 3,000+ | Outline |
| Feather | `feather` | 287 | Outline |
| Remix | `remix` | 2,000+ | Line & Fill |
| Hugeicons | `hugeicons` | 3,000+ | Multiple styles |
| Simple Icons | `simple-icons` | 2,000+ | Brand logos |
| Iconoir | `iconoir` | 1,600+ | Outline |

## Output Formats

| Format | Extension | Use For |
|--------|-----------|---------|
| `react` | `.tsx` | React/Next.js projects |
| `vue` | `.vue` | Vue 3 projects |
| `svelte` | `.svelte` | Svelte projects |
| `svg` | `.svg` | Plain SVG anywhere |
| `json` | `.json` | Icon metadata only |

## Component Props (React Example)

```tsx
import { ArrowRight } from './icons/ArrowRight';

// All props are optional
<ArrowRight 
  size={32}              // number or string
  strokeWidth={1.5}      // number or string
  color="red"            // any valid CSS color
  className="icon"       // standard SVG props
  onClick={handler}      // standard React props
/>
```

## Resources

| URI | Description |
|-----|-------------|
| `unicon://sources` | List all icon libraries |
| `unicon://categories` | List all categories |
| `unicon://stats` | Total counts and stats |
| `unicon://starter_packs` | Curated icon packs |

## Tips & Tricks

### ✅ DO

- Search before getting to find the right icon
- Specify the library to narrow results
- Use semantic search: "icons for authentication"
- Get multiple icons in one request
- Specify format explicitly (react, vue, etc.)

### ❌ DON'T

- Guess icon IDs - search first
- Make many separate requests for multiple icons
- Forget to restart Claude after config changes
- Use uppercase in icon IDs (use `lucide:arrow-right` not `Lucide:ArrowRight`)

## Troubleshooting

### Server not showing
- Verify JSON is valid (no trailing commas)
- Restart Claude completely
- Check Developer Console for errors

### Icon not found
- Verify ID format: `library:icon-name`
- Search first to get exact ID
- Check icon exists at unicon.sh

### Slow responses
- First request may be slow (cold start)
- Subsequent requests are fast
- Check internet connection

## Support

- 📖 Full guide: docs/mcp-integration.md
- 🚀 Quick start: docs/mcp-quickstart.md
- 🐛 Report issues: github.com/webrenew/unicon/issues
- 💬 Ask questions: github.com/webrenew/unicon/discussions

## Example Workflow

**Task:** Add navigation icons to React app

1. **Search:**
   > "Search for navigation icons in Lucide - home, settings, user, bell"

2. **Get components:**
   > "Give me React components for lucide:home, lucide:settings, lucide:user, lucide:bell with size 24"

3. **Copy code** into your project

4. **Use:**
   ```tsx
   import { Home, Settings, User, Bell } from './icons';
   
   <nav>
     <Home />
     <Settings />
     <User />
     <Bell />
   </nav>
   ```

Done! 🎉

---

**Quick Links:**
- Website: https://unicon.sh
- GitHub: https://github.com/webrenew/unicon
- NPM: https://www.npmjs.com/package/@webrenew/unicon-mcp-server
